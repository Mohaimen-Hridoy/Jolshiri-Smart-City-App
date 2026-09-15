const prisma = require('../config/db');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { fileUrlFor } = require('../middleware/upload');
const { notifyUser } = require('../services/notification.service');
const {
  rentalCreateSchema,
  rentalUpdateSchema,
  viewingRequestCreateSchema,
  requestStatusUpdateSchema,
} = require('../utils/validation.part2');

/// Part 2: Plot & Property — To-Let side. RESIDENT_OWNERs list their own
/// units for rent; any authenticated user can request a viewing.

function assertOwnerOrAdmin(listing, user) {
  if (listing.ownerId !== user.id && user.role !== 'ADMIN') {
    throw new ApiError(403, 'You do not own this listing');
  }
}

/// GET /api/rentals?location=&minBedrooms=
const listRentals = asyncHandler(async (req, res) => {
  const { location, minBedrooms } = req.query;
  const where = {};
  if (location) where.location = { contains: location, mode: 'insensitive' };
  if (minBedrooms) where.bedrooms = { gte: Number(minBedrooms) };

  // owner (id/fullName) is included so the Flutter app can send a viewing
  // request and immediately know who to message about it, without a
  // second round trip.
  const rentals = await prisma.rentalListing.findMany({
    where,
    include: { owner: { select: { id: true, fullName: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ rentals });
});

/// GET /api/rentals/mine
const listMyRentals = asyncHandler(async (req, res) => {
  const rentals = await prisma.rentalListing.findMany({
    where: { ownerId: req.user.id },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ rentals });
});

/// GET /api/rentals/:id
const getRental = asyncHandler(async (req, res) => {
  const rental = await prisma.rentalListing.findUnique({ where: { id: req.params.id } });
  if (!rental) throw new ApiError(404, 'Rental listing not found');
  res.json({ rental });
});

/// POST /api/rentals
const createRental = asyncHandler(async (req, res) => {
  const parsed = rentalCreateSchema.safeParse({
    ...req.body,
    bedrooms: req.body.bedrooms !== undefined ? Number(req.body.bedrooms) : undefined,
  });
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message);

  const rental = await prisma.rentalListing.create({
    data: { ...parsed.data, ownerId: req.user.id, imageUrl: fileUrlFor(req, req.file) },
  });
  res.status(201).json({ rental });
});

/// PATCH /api/rentals/:id
const updateRental = asyncHandler(async (req, res) => {
  const existing = await prisma.rentalListing.findUnique({ where: { id: req.params.id } });
  if (!existing) throw new ApiError(404, 'Rental listing not found');
  assertOwnerOrAdmin(existing, req.user);

  const parsed = rentalUpdateSchema.safeParse({
    ...req.body,
    bedrooms: req.body.bedrooms !== undefined ? Number(req.body.bedrooms) : undefined,
  });
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message);

  const rental = await prisma.rentalListing.update({
    where: { id: req.params.id },
    data: { ...parsed.data, imageUrl: req.file ? fileUrlFor(req, req.file) : undefined },
    include: { owner: { select: { id: true, fullName: true } } },
  });
  res.json({ rental });
});

/// DELETE /api/rentals/:id
const deleteRental = asyncHandler(async (req, res) => {
  const existing = await prisma.rentalListing.findUnique({ where: { id: req.params.id } });
  if (!existing) throw new ApiError(404, 'Rental listing not found');
  assertOwnerOrAdmin(existing, req.user);

  await prisma.rentalListing.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

/// POST /api/rentals/:id/viewing-requests
const requestViewing = asyncHandler(async (req, res) => {
  const listing = await prisma.rentalListing.findUnique({ where: { id: req.params.id } });
  if (!listing) throw new ApiError(404, 'Rental listing not found');

  const parsed = viewingRequestCreateSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message);

  const request = await prisma.rentalViewingRequest.create({
    data: { ...parsed.data, listingId: listing.id, requesterId: req.user.id },
  });

  await notifyUser(
    listing.ownerId,
    'New viewing request',
    `${parsed.data.requesterName} requested a viewing for "${listing.title}".`
  );

  res.status(201).json({ request });
});

/// GET /api/rentals/:id/viewing-requests — owner/admin sees requests for their listing
const listViewingRequestsForListing = asyncHandler(async (req, res) => {
  const listing = await prisma.rentalListing.findUnique({ where: { id: req.params.id } });
  if (!listing) throw new ApiError(404, 'Rental listing not found');
  assertOwnerOrAdmin(listing, req.user);

  const requests = await prisma.rentalViewingRequest.findMany({
    where: { listingId: listing.id },
    include: { requester: { select: { id: true, fullName: true } } },
    orderBy: { requestedAt: 'desc' },
  });
  res.json({ requests });
});

/// GET /api/viewing-requests/for-my-listings — the calling RESIDENT_OWNER's
/// "Flat View Requests" inbox: every viewing request sent for any of their
/// own listings, across all properties, so they can approve/decline (and
/// message the requester) from one screen instead of per-listing.
const listViewingRequestsForMyListings = asyncHandler(async (req, res) => {
  const requests = await prisma.rentalViewingRequest.findMany({
    where: { listing: { ownerId: req.user.id } },
    include: {
      listing: true,
      requester: { select: { id: true, fullName: true } },
    },
    orderBy: { requestedAt: 'desc' },
  });
  res.json({ requests });
});

/// GET /api/viewing-requests — JOLSHIRI_MANAGEMENT admin overview of every
/// viewing request across all listings (Property Office tab).
const listAllViewingRequests = asyncHandler(async (req, res) => {
  const requests = await prisma.rentalViewingRequest.findMany({
    include: { listing: true },
    orderBy: { requestedAt: 'desc' },
  });
  res.json({ requests });
});

/// GET /api/viewing-requests/mine — the requester's own requests. Includes
/// the listing owner (id/fullName) so the Flutter "Flat View Requests"
/// screen can open a chat thread with them straight from the card.
const listMyViewingRequests = asyncHandler(async (req, res) => {
  const requests = await prisma.rentalViewingRequest.findMany({
    where: { requesterId: req.user.id },
    include: {
      listing: {
        select: {
          id: true,
          title: true,
          location: true,
          imageUrl: true,
          ownerId: true,
          owner: { select: { id: true, fullName: true } },
        },
      },
    },
    orderBy: { requestedAt: 'desc' },
  });
  res.json({ requests });
});

/// PATCH /api/viewing-requests/:id/status — listing owner accepts/declines/completes
const updateViewingRequestStatus = asyncHandler(async (req, res) => {
  const request = await prisma.rentalViewingRequest.findUnique({
    where: { id: req.params.id },
    include: { listing: true },
  });
  if (!request) throw new ApiError(404, 'Viewing request not found');
  assertOwnerOrAdmin(request.listing, req.user);

  const parsed = requestStatusUpdateSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message);

  const updated = await prisma.rentalViewingRequest.update({
    where: { id: request.id },
    data: { status: parsed.data.status },
  });

  await notifyUser(
    request.requesterId,
    'Viewing request update',
    `Your viewing request for "${request.listing.title}" is now ${parsed.data.status.toLowerCase()}.`
  );

  res.json({ request: updated });
});

module.exports = {
  listRentals,
  listMyRentals,
  getRental,
  createRental,
  updateRental,
  deleteRental,
  requestViewing,
  listViewingRequestsForListing,
  listAllViewingRequests,
  listMyViewingRequests,
  listViewingRequestsForMyListings,
  updateViewingRequestStatus,
};
