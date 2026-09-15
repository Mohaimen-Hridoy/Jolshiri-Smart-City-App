const express = require('express');
const {
  createPayment,
  listMyPayments,
  listPayments,
  getPayment,
  initiatePayment,
  paymentCallback,
  stripeWebhook,
  manualConfirmPayment,
} = require('../controllers/payment.controller');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.post('/', authenticate, authorize('ADMIN'), createPayment);
router.get('/mine', authenticate, listMyPayments);
router.get('/', authenticate, authorize('ADMIN'), listPayments);
// /callback and /webhook must be registered BEFORE /:id so Express does not
// interpret those literal strings as a payment id UUID.
//
// /callback — the resident's BROWSER lands here after Stripe Checkout
// (success_url/cancel_url). Display-only: it does NOT change payment
// status, since a user could hit this URL manually without paying. No JWT
// is available here (it's Stripe's redirect, not our Flutter app), so it
// stays outside `authenticate`.
router.post('/callback', paymentCallback);
router.get('/callback', paymentCallback);
// /webhook — Stripe's SERVER calls this directly (not the browser) with a
// `Stripe-Signature` header. This is the only endpoint allowed to actually
// flip a PaymentRecord to PAID/FAILED for a real Stripe session — see
// services/paymentGateway.js#verifyWebhookEvent. Needs the raw request
// body for signature verification, so express.raw() runs ahead of the
// app-wide express.json() for this one route (wired in src/index.js).
router.post('/webhook', stripeWebhook);
// Dev/testing only — manually resolve a MOCK- gateway record. Admin-gated
// (see controllers/payment.controller.js#manualConfirmPayment); real
// Stripe sessions never go through this.
router.post('/manual-confirm', authenticate, authorize('ADMIN'), manualConfirmPayment);
router.get('/:id', authenticate, getPayment);
router.post('/:id/pay', authenticate, initiatePayment);

module.exports = router;
