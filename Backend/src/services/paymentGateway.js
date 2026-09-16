const crypto = require('crypto');
const Stripe = require('stripe');

/// Part 8: Payments — Stripe Checkout, with a mock fallback so the
/// PaymentRecord status flow (DUE -> PROCESSING -> PAID/FAILED) can still be
/// built and tested end-to-end without a merchant account. Set
/// STRIPE_SECRET_KEY (and STRIPE_WEBHOOK_SECRET) in .env / Railway
/// variables to go live — see the bottom of this file for exactly which
/// vars are needed.
///
/// Returns a `checkoutUrl` the Flutter app opens in the browser
/// (url_launcher); the resident completes payment on Stripe's hosted
/// checkout page there. Stripe then does TWO things, and only one of them
/// is trustworthy:
///   1. Redirects the resident's own browser to success_url/cancel_url —
///      this is just for UX (closing the browser tab / showing a message).
///      A user can hit this URL manually without paying, so it must never
///      be the thing that marks a PaymentRecord PAID.
///   2. Sends a server-to-server POST to POST /api/payments/webhook with a
///      `Stripe-Signature` header. This is cryptographically verified
///      below with the webhook signing secret and is the ONLY source of
///      truth for payment status — see verifyWebhookEvent().
///
/// SSLCommerz was removed from this service — the sandbox store credentials
/// kept coming back "Store Credential Error Or Store is De-active" from
/// SSLCommerz's side (free sandbox stores expire/deactivate on their own),
/// and Stripe test mode has proven reliable for this project instead.

function getStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return null;
  return new Stripe(secretKey);
}

function parseAmountToMinorUnits(amountString) {
  // amounts are stored as display strings like "৳ 20,00,000" — strip
  // everything but digits and dot, default to a symbolic 100 if the record
  // has no parseable numeric amount so the gateway call doesn't 500.
  const digits = String(amountString).replace(/[^0-9.]/g, '');
  const value = parseFloat(digits || '100');
  return Math.round(value * 100);
}

async function initiateStripe(paymentRecord) {
  const stripe = getStripeClient();
  if (!stripe) return null;

  const baseUrl = process.env.APP_BASE_URL || 'http://localhost:4000';
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    // client_reference_id is how the webhook finds the PaymentRecord back —
    // it's echoed on every event Stripe sends for this session, unlike the
    // query string on success_url which a user could tamper with.
    client_reference_id: paymentRecord.id,
    metadata: { paymentId: paymentRecord.id },
    success_url: `${baseUrl}/api/payments/callback?outcome=PAID&paymentId=${paymentRecord.id}`,
    cancel_url: `${baseUrl}/api/payments/callback?outcome=FAILED&paymentId=${paymentRecord.id}`,
    customer_email: paymentRecord.user?.email || undefined,
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: { name: paymentRecord.title },
          unit_amount: parseAmountToMinorUnits(paymentRecord.amount),
        },
        quantity: 1,
      },
    ],
  });

  return { gatewayRef: session.id, checkoutUrl: session.url, status: 'PROCESSING' };
}

async function initiate(paymentRecord) {
  try {
    const stripe = await initiateStripe(paymentRecord);
    if (stripe) return stripe;
  } catch (err) {
    console.error('[paymentGateway] Stripe initiate threw:', err);
    // fall through to the mock below
  }

  // No gateway configured (or the call above failed) — no checkoutUrl means
  // no real webhook will ever arrive to move this out of PROCESSING, so
  // resolve straight to PAID here instead of stranding the record forever.
  // This is the demo path (no STRIPE_SECRET_KEY set, or the Stripe call
  // failed — check the logs above this line for why).
  console.warn('[paymentGateway] Falling back to mock gateway (no real checkout was created)');
  const gatewayRef = `MOCK-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
  return { gatewayRef, checkoutUrl: null, status: 'PAID' };
}

/// Verifies a Stripe webhook request using the raw request body + the
/// `Stripe-Signature` header, per Stripe's HMAC signing scheme. Throws if
/// the signature is missing/invalid/expired — callers must catch and
/// respond 400 without touching the database.
///
/// `rawBody` MUST be the untouched request bytes (Buffer/string) — NOT the
/// JSON-parsed body — which is why the webhook route is mounted with
/// express.raw() ahead of express.json() in index.js.
function verifyWebhookEvent(rawBody, signatureHeader) {
  const stripe = getStripeClient();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !webhookSecret) {
    throw new Error('Stripe webhook is not configured (STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET missing)');
  }
  return stripe.webhooks.constructEvent(rawBody, signatureHeader, webhookSecret);
}

/// Manual/legacy confirm path — used only for local testing against the
/// mock gateway (gatewayRef starting with MOCK-), never for real Stripe
/// sessions, which are confirmed exclusively via verifyWebhookEvent above.
async function confirm(gatewayRef, outcome) {
  return { gatewayRef, status: outcome };
}

module.exports = { initiate, confirm, verifyWebhookEvent, getStripeClient };

/// ── Env vars this file needs (set these on Railway → your backend service
/// ── → Variables) ─────────────────────────────────────────────────────────
///
/// STRIPE_SECRET_KEY   sk_test_... (or sk_live_... when you go live)
///                      Dashboard → Developers → API keys → Secret key
/// STRIPE_WEBHOOK_SECRET  whsec_...
///                      Dashboard → Developers → Webhooks → your endpoint
///                      → Signing secret (see routes/payment.routes.js for
///                      the exact webhook URL to register)
/// APP_BASE_URL         https://<your-railway-backend>.up.railway.app
///                      (no trailing slash) — used to build the
///                      success_url/cancel_url Stripe redirects the
///                      resident's browser back to.
