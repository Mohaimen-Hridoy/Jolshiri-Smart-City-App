const crypto = require('crypto');
const prisma = require('../config/db');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { notifyUser } = require('../services/notification.service');
const paymentGateway = require('../services/paymentGateway');
const { paymentCreateSchema, paymentCallbackSchema } = require('../utils/validation.part3');
// Soil test fees are just PaymentRecords with purpose SOIL_TEST_FEE — once
// one settles as PAID we need to advance the linked SoilTestApplication
// (REQUESTED -> PERMIT_GRANTED -> PAYMENT_DONE -> COMPLETED flow lives in
// soilTest.controller.js).
const { handleSoilTestPaymentPaid } = require('./soilTest.controller');

/// Part 8: Payments. status flow: DUE -> (pay) -> PROCESSING -> (gateway
/// callback) -> PAID | FAILED. See services/paymentGateway.js for how to
/// swap the mock gateway for bKash/Nagad, or reconfigure Stripe.

function assertOwnerOrAdmin(record, user) {
  if (record.userId !== user.id && user.role !== 'ADMIN') {
    throw new ApiError(403, 'You do not have access to this payment record');
  }
}

/// POST /api/payments — admin creates a DUE record for a user
/// (e.g. a consultation fee or development agreement charge)
const createPayment = asyncHandler(async (req, res) => {
  const parsed = paymentCreateSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message);

  const user = await prisma.user.findUnique({ where: { id: parsed.data.userId } });
  if (!user) throw new ApiError(404, 'User not found');

  const payment = await prisma.paymentRecord.create({
    data: { ...parsed.data, reference: `JLS-${crypto.randomBytes(5).toString('hex').toUpperCase()}` },
  });

  await notifyUser(user.id, 'Payment due', `"${payment.title}" — ${payment.amount} is now due.`);

  res.status(201).json({ payment });
});

/// GET /api/payments/mine
const listMyPayments = asyncHandler(async (req, res) => {
  const payments = await prisma.paymentRecord.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ payments });
});

/// GET /api/payments — admin, filterable by status
const listPayments = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const where = status ? { status } : {};
  const payments = await prisma.paymentRecord.findMany({
    where,
    include: { user: { select: { fullName: true, email: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ payments });
});

/// GET /api/payments/:id
const getPayment = asyncHandler(async (req, res) => {
  const payment = await prisma.paymentRecord.findUnique({ where: { id: req.params.id } });
  if (!payment) throw new ApiError(404, 'Payment record not found');
  assertOwnerOrAdmin(payment, req.user);
  res.json({ payment });
});

/// POST /api/payments/:id/pay — the owner initiates payment through the
/// gateway; moves DUE -> PROCESSING and returns a mock gatewayRef the
/// Flutter app would normally use to open the checkout webview.
const initiatePayment = asyncHandler(async (req, res) => {
  const payment = await prisma.paymentRecord.findUnique({
    where: { id: req.params.id },
    include: { user: { select: { fullName: true, email: true, phone: true, address: true } } },
  });
  if (!payment) throw new ApiError(404, 'Payment record not found');
  assertOwnerOrAdmin(payment, req.user);
  if (payment.status !== 'DUE' && payment.status !== 'FAILED') {
    throw new ApiError(400, `Payment is already ${payment.status.toLowerCase()}`);
  }

  const { gatewayRef, checkoutUrl, status } = await paymentGateway.initiate(payment);

  const updated = await prisma.paymentRecord.update({
    where: { id: payment.id },
    data: { status, gatewayRef },
  });

  if (updated.status === 'PAID') {
    await handleSoilTestPaymentPaid(updated.id);
  }

  // checkoutUrl is only present when Stripe is actually configured (see
  // services/paymentGateway.js) — the Flutter app opens it in the browser
  // when set, or just shows the mock "paid" state when it's null.
  res.json({ payment: updated, gatewayRef, checkoutUrl });
});

/// Applies a gateway-confirmed outcome to a PaymentRecord: updates status,
/// advances the linked soil-test application on PAID, and notifies the
/// user. Skips the update/notification if the record is already in that
/// status, since Stripe delivers webhooks at-least-once and may retry.
async function applyOutcome(payment, status) {
  if (payment.status === status) return payment;

  const updated = await prisma.paymentRecord.update({
    where: { id: payment.id },
    data: { status },
  });

  if (updated.status === 'PAID') {
    await handleSoilTestPaymentPaid(updated.id);
  }

  await notifyUser(
    payment.userId,
    'Payment update',
    status === 'PAID' ? `"${payment.title}" has been paid.` : `"${payment.title}" payment failed. Please try again.`
  );

  return updated;
}

/// GET/POST /api/payments/callback — where the resident's own BROWSER
/// lands after Stripe Checkout (success_url/cancel_url). Display-only: a
/// user could hit this URL manually without ever paying, so it must never
/// set payment status itself — it just reports whatever status is already
/// on the record (real Stripe payments are confirmed by stripeWebhook
/// below, which usually lands moments before or after this redirect).
const paymentCallback = asyncHandler(async (req, res) => {
  const paymentId = req.query.paymentId || req.body?.paymentId;
  const payment = paymentId ? await prisma.paymentRecord.findUnique({ where: { id: paymentId } }) : null;
  const status = payment?.status || 'PROCESSING';

  if (req.method === 'GET') {
    const message =
      status === 'PAID'
        ? { heading: 'Payment successful', body: 'You can close this window and return to the Jolshiri app.' }
        : status === 'FAILED'
          ? { heading: 'Payment failed', body: 'You can close this window and try again from the Jolshiri app.' }
          : {
              heading: 'Confirming your payment…',
              body: 'This usually takes just a few seconds. Please check the Jolshiri app shortly.',
            };
    res.send(
      `<html><body style="font-family:sans-serif;text-align:center;padding:40px">` +
        `<h2>${message.heading}</h2><p>${message.body}</p></body></html>`
    );
    return;
  }

  res.json({ payment });
});

/// POST /api/payments/webhook — called by STRIPE'S SERVERS, not the
/// browser. Signature-verified (see services/paymentGateway.js), so this
/// is the only place a real Stripe payment is ever marked PAID/FAILED.
/// Registered with express.raw() in src/index.js so req.body is the exact
/// bytes Stripe signed.
const stripeWebhook = asyncHandler(async (req, res) => {
  let event;
  try {
    event = paymentGateway.verifyWebhookEvent(req.body, req.headers['stripe-signature']);
  } catch (err) {
    console.error('[payments] webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  const session = event.data.object;
  const paymentId = session.client_reference_id || session.metadata?.paymentId;

  const outcomeByEventType = {
    'checkout.session.completed': session.payment_status === 'paid' ? 'PAID' : null,
    'checkout.session.async_payment_succeeded': 'PAID',
    'checkout.session.async_payment_failed': 'FAILED',
    'checkout.session.expired': 'FAILED',
  };
  const status = outcomeByEventType[event.type];

  if (!status) {
    // Event we don't act on (e.g. a still-pending async payment method) —
    // acknowledge it anyway so Stripe doesn't keep retrying.
    return res.json({ received: true });
  }
  if (!paymentId) {
    console.error(`[payments] webhook ${event.type} had no client_reference_id/metadata.paymentId`);
    return res.json({ received: true });
  }

  const payment = paymentId
    ? await prisma.paymentRecord.findUnique({ where: { id: paymentId } })
    : await prisma.paymentRecord.findFirst({ where: { gatewayRef: session.id } });
  if (!payment) {
    console.error(`[payments] webhook ${event.type} referenced unknown payment ${paymentId}`);
    return res.json({ received: true });
  }

  await applyOutcome(payment, status);
  res.json({ received: true });
});

/// POST /api/payments/callback (legacy body shape `{ gatewayRef, outcome }`)
/// is for manually resolving MOCK- gateway records in dev/testing only —
/// real Stripe sessions are never confirmed this way (see stripeWebhook
/// above). Admin-only so it can't be used to mark someone else's payment
/// paid.
const manualConfirmPayment = asyncHandler(async (req, res) => {
  if (req.user.role !== 'ADMIN') throw new ApiError(403, 'Admin only');
  const parsed = paymentCallbackSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, 'Unrecognised payment callback payload');

  const payment = await prisma.paymentRecord.findFirst({ where: { gatewayRef: parsed.data.gatewayRef } });
  if (!payment) throw new ApiError(404, 'Payment record not found');

  const confirmed = await paymentGateway.confirm(parsed.data.gatewayRef, parsed.data.outcome);
  const updated = await applyOutcome(payment, confirmed.status);
  res.json({ payment: updated });
});

module.exports = {
  createPayment,
  listMyPayments,
  listPayments,
  getPayment,
  initiatePayment,
  paymentCallback,
  stripeWebhook,
  manualConfirmPayment,
};
