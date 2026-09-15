const crypto = require('crypto');
const prisma = require('../config/db');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { notifyUser } = require('../services/notification.service');
const { soilTestCreateSchema, soilTestStatusSchema } = require('../utils/validation.part3');

/// Part 6: Construction Lifecycle — Soil Test Applications. Full flow:
///
///   REQUESTED --(Authority grants permit)--> PERMIT_GRANTED
///     --(resident pays the fee, see handleSoilTestPaymentPaid below)-->
///   PAYMENT_DONE --(Authority runs the test)--> COMPLETED
///
/// REJECTED can follow REQUESTED or PERMIT_GRANTED. Mirrors
/// SoilTestApplication / SoilTestStatus in app_models.dart.

const SOIL_TEST_FEE_AMOUNT = '৳ 2,000';

// Which statuses an admin may move an application into, keyed by its
// current status. PAYMENT_DONE is never in here — that transition only
// ever happens automatically once the linked payment settles as PAID (see
// handleSoilTestPaymentPaid, called from payment.controller.js).
const ADMIN_ALLOWED_TRANSITIONS = {
  REQUESTED: ['PERMIT_GRANTED', 'REJECTED'],
  PERMIT_GRANTED: ['REJECTED'],
  PAYMENT_DONE: ['COMPLETED'],
};

/// POST /api/construction/soil-tests — resident applies
const createSoilTest = asyncHandler(async (req, res) => {
  const parsed = soilTestCreateSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message);

  const application = await prisma.soilTestApplication.create({
    data: { ...parsed.data, applicantId: req.user.id },
  });

  res.status(201).json({ application });
});

/// GET /api/construction/soil-tests/mine — the calling resident's own applications
const listMySoilTests = asyncHandler(async (req, res) => {
  const applications = await prisma.soilTestApplication.findMany({
    where: { applicantId: req.user.id },
    include: { payment: true },
    orderBy: { appliedAt: 'desc' },
  });
  res.json({ applications });
});

/// GET /api/construction/soil-tests — JOLSHIRI_MANAGEMENT admin, all applications
const listSoilTests = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const where = status ? { status } : {};
  const applications = await prisma.soilTestApplication.findMany({
    where,
    include: { applicant: { select: { fullName: true, phone: true } }, payment: true },
    orderBy: { appliedAt: 'desc' },
  });
  res.json({ applications });
});

/// PATCH /api/construction/soil-tests/:id/status — admin grants the permit,
/// marks the test completed, or rejects the application. Granting the
/// permit also raises the soil test fee PaymentRecord the resident pays
/// from the Payments screen; marking COMPLETED tells the resident their
/// document is ready.
const updateSoilTestStatus = asyncHandler(async (req, res) => {
  const existing = await prisma.soilTestApplication.findUnique({ where: { id: req.params.id } });
  if (!existing) throw new ApiError(404, 'Soil test application not found');

  const parsed = soilTestStatusSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message);

  const nextStatus = parsed.data.status;
  if (nextStatus === 'PAYMENT_DONE') {
    throw new ApiError(400, 'Payment status is set automatically once the resident pays, not manually');
  }
  const allowedNext = ADMIN_ALLOWED_TRANSITIONS[existing.status] || [];
  if (!allowedNext.includes(nextStatus)) {
    throw new ApiError(400, `Cannot move a ${existing.status} application to ${nextStatus}`);
  }

  // Granting the permit raises the fee the resident must pay before the
  // testing can be marked complete.
  let payment = null;
  if (nextStatus === 'PERMIT_GRANTED') {
    payment = await prisma.paymentRecord.create({
      data: {
        userId: existing.applicantId,
        title: 'Soil Test Application Fee',
        description: `Soil test fee for "${existing.projectName}" (${existing.plotReference}).`,
        purpose: 'SOIL_TEST_FEE',
        amount: SOIL_TEST_FEE_AMOUNT,
        reference: `JLS-${crypto.randomBytes(5).toString('hex').toUpperCase()}`,
      },
    });
  }

  const application = await prisma.soilTestApplication.update({
    where: { id: existing.id },
    data: {
      status: nextStatus,
      ...(parsed.data.note !== undefined ? { note: parsed.data.note } : {}),
      ...(payment ? { paymentId: payment.id } : {}),
    },
  });

  const messages = {
    PERMIT_GRANTED: `Your soil testing permit for "${application.projectName}" has been granted. Pay the testing fee from Payments to schedule your visit.`,
    REJECTED: `Your soil test application for "${application.projectName}" was rejected.`,
    COMPLETED: 'Your soil testing document is ready to be received.',
  };
  await notifyUser(application.applicantId, 'Soil test update', messages[nextStatus]);

  res.json({ application, payment });
});

/// Called by payment.controller.js right after a PaymentRecord settles as
/// PAID. If that payment is the fee for a PERMIT_GRANTED soil test
/// application, moves it to PAYMENT_DONE and lets every JOLSHIRI_MANAGEMENT
/// admin know so one of them can run the test and mark it completed.
const handleSoilTestPaymentPaid = async (paymentId) => {
  const application = await prisma.soilTestApplication.findUnique({ where: { paymentId } });
  if (!application || application.status !== 'PERMIT_GRANTED') return;

  const updated = await prisma.soilTestApplication.update({
    where: { id: application.id },
    data: { status: 'PAYMENT_DONE' },
  });

  const authorityAdmins = await prisma.user.findMany({
    where: { role: 'ADMIN', adminType: 'JOLSHIRI_MANAGEMENT' },
    select: { id: true },
  });
  await Promise.all(
    authorityAdmins.map((admin) =>
      notifyUser(
        admin.id,
        'Soil test payment received',
        `Payment done for "${updated.projectName}" (${updated.plotReference}). You can now mark the testing as completed.`
      )
    )
  );
};

module.exports = {
  createSoilTest,
  listMySoilTests,
  listSoilTests,
  updateSoilTestStatus,
  handleSoilTestPaymentPaid,
};
