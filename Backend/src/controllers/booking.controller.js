const prisma = require('../config/db');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { notifyUser } = require('../services/notification.service');
const {
  bookingCreateSchema,
  quoteCreateSchema,
  requestStatusUpdateSchema,
} = require('../utils/validation.part2');

/// Part 4: Bookings & Quotes. ServiceBooking is resident -> provider,
/// QuoteRequest is resident -> developer. Both share the same
/// pending/accepted/declined/completed status flow (RequestStatus).

// ── Service Bookings ─────────────────────────────────────────────────────

/// POST /api/bookings
const createBooking = asyncHandler(async (req, res) => {
  const parsed = bookingCreateSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message);

  const provider = await prisma.serviceProvider.findUnique({ where: { id: parsed.data.providerId } });
  if (!provider) throw new ApiError(404, 'Service provider not found');

  const booking = await prisma.serviceBooking.create({
    data: { ...parsed.data, customerId: req.user.id },
  });

  await notifyUser(
    provider.userId,
    'New booking request',
    `${req.user.fullName} requested "${parsed.data.serviceType}" service.`
  );

  res.status(201).json({ booking });
});

/// GET /api/bookings/mine — customer's own bookings
const listMyBookings = asyncHandler(async (req, res) => {
  const bookings = await prisma.serviceBooking.findMany({
    where: { customerId: req.user.id },
    include: { provider: true },
    orderBy: { requestedAt: 'desc' },
  });
  res.json({ bookings });
});

/// GET /api/bookings/provider — the calling SERVICE_PROVIDER's incoming bookings
const listProviderBookings = asyncHandler(async (req, res) => {
  const provider = await prisma.serviceProvider.findUnique({ where: { userId: req.user.id } });
  if (!provider) throw new ApiError(404, 'No service provider profile for this account');

  const bookings = await prisma.serviceBooking.findMany({
    where: { providerId: provider.id },
    include: { customer: { select: { fullName: true, phone: true } } },
    orderBy: { requestedAt: 'desc' },
  });
  res.json({ bookings });
});

/// PATCH /api/bookings/:id/status — the provider accepts/declines/completes
const updateBookingStatus = asyncHandler(async (req, res) => {
  const booking = await prisma.serviceBooking.findUnique({
    where: { id: req.params.id },
    include: { provider: true },
  });
  if (!booking) throw new ApiError(404, 'Booking not found');
  if (booking.provider.userId !== req.user.id && req.user.role !== 'ADMIN') {
    throw new ApiError(403, 'Only the assigned provider can update this booking');
  }

  const parsed = requestStatusUpdateSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message);

  const updated = await prisma.serviceBooking.update({
    where: { id: booking.id },
    data: { status: parsed.data.status },
  });

  await notifyUser(
    booking.customerId,
    'Booking update',
    `Your "${booking.serviceType}" booking is now ${parsed.data.status.toLowerCase()}.`
  );

  res.json({ booking: updated });
});

/// PATCH /api/bookings/:id/reviewed — the customer marks their completed
/// booking as reviewed, right after submitting a rating/review, so the
/// "rate & review" card only shows once (ServiceBooking.reviewed in
/// app_models.dart).
const markBookingReviewed = asyncHandler(async (req, res) => {
  const booking = await prisma.serviceBooking.findUnique({ where: { id: req.params.id } });
  if (!booking) throw new ApiError(404, 'Booking not found');
  if (booking.customerId !== req.user.id) {
    throw new ApiError(403, 'Only the customer who booked this can mark it as reviewed');
  }

  const updated = await prisma.serviceBooking.update({
    where: { id: booking.id },
    data: { reviewed: true },
  });

  res.json({ booking: updated });
});

// ── Quote Requests ────────────────────────────────────────────────────────

/// POST /api/quotes
const createQuote = asyncHandler(async (req, res) => {
  const parsed = quoteCreateSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message);

  const developer = await prisma.developer.findUnique({ where: { id: parsed.data.developerId } });
  if (!developer) throw new ApiError(404, 'Developer not found');

  const quote = await prisma.quoteRequest.create({
    data: { ...parsed.data, customerId: req.user.id },
  });

  await notifyUser(
    developer.userId,
    'New quote request',
    `${req.user.fullName} requested a quote for a ${parsed.data.projectType} project.`
  );

  res.status(201).json({ quote });
});

/// GET /api/quotes/mine
const listMyQuotes = asyncHandler(async (req, res) => {
  const quotes = await prisma.quoteRequest.findMany({
    where: { customerId: req.user.id },
    include: { developer: true },
    orderBy: { requestedAt: 'desc' },
  });
  res.json({ quotes });
});

/// GET /api/quotes/developer — the calling DEVELOPER's incoming quote requests
const listDeveloperQuotes = asyncHandler(async (req, res) => {
  const developer = await prisma.developer.findUnique({ where: { userId: req.user.id } });
  if (!developer) throw new ApiError(404, 'No developer profile for this account');

  const quotes = await prisma.quoteRequest.findMany({
    where: { developerId: developer.id },
    include: { customer: { select: { fullName: true, phone: true } } },
    orderBy: { requestedAt: 'desc' },
  });
  res.json({ quotes });
});

/// PATCH /api/quotes/:id/status
const updateQuoteStatus = asyncHandler(async (req, res) => {
  const quote = await prisma.quoteRequest.findUnique({
    where: { id: req.params.id },
    include: { developer: true },
  });
  if (!quote) throw new ApiError(404, 'Quote request not found');
  if (quote.developer.userId !== req.user.id && req.user.role !== 'ADMIN') {
    throw new ApiError(403, 'Only the assigned developer can update this quote request');
  }

  const parsed = requestStatusUpdateSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message);

  const updated = await prisma.quoteRequest.update({
    where: { id: quote.id },
    data: { status: parsed.data.status },
  });

  await notifyUser(
    quote.customerId,
    'Quote request update',
    `Your quote request for a ${quote.projectType} project is now ${parsed.data.status.toLowerCase()}.`
  );

  res.json({ quote: updated });
});

module.exports = {
  createBooking,
  listMyBookings,
  listProviderBookings,
  updateBookingStatus,
  markBookingReviewed,
  createQuote,
  listMyQuotes,
  listDeveloperQuotes,
  updateQuoteStatus,
};
