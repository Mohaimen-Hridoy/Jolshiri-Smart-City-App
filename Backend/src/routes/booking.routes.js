const express = require('express');
const {
  createBooking,
  listMyBookings,
  listProviderBookings,
  updateBookingStatus,
  markBookingReviewed,
  createQuote,
  listMyQuotes,
  listDeveloperQuotes,
  updateQuoteStatus,
} = require('../controllers/booking.controller');
const { authenticate, authorize } = require('../middleware/auth');

const bookingRouter = express.Router();
bookingRouter.post('/', authenticate, authorize('RESIDENT_OWNER'), createBooking);
bookingRouter.get('/mine', authenticate, listMyBookings);
bookingRouter.get('/provider', authenticate, authorize('SERVICE_PROVIDER'), listProviderBookings);
bookingRouter.patch('/:id/status', authenticate, authorize('SERVICE_PROVIDER', 'ADMIN'), updateBookingStatus);
bookingRouter.patch('/:id/reviewed', authenticate, authorize('RESIDENT_OWNER'), markBookingReviewed);

const quoteRouter = express.Router();
quoteRouter.post('/', authenticate, authorize('RESIDENT_OWNER'), createQuote);
quoteRouter.get('/mine', authenticate, listMyQuotes);
quoteRouter.get('/developer', authenticate, authorize('DEVELOPER'), listDeveloperQuotes);
quoteRouter.patch('/:id/status', authenticate, authorize('DEVELOPER', 'ADMIN'), updateQuoteStatus);

module.exports = { bookingRouter, quoteRouter };
