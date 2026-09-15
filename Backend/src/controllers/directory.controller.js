const prisma = require('../config/db');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { notifyUser } = require('../services/notification.service');
const {
  developerUpdateSchema,
  providerUpdateSchema,
  reviewCreateSchema,
} = require('../utils/validation.part2');

/// Part 3: Developer & Service Provider Directory.

// ── Developers ────────────────────────────────────────────────────────────

/// GET /api/developers?specialty=&verified=true
const listDevelopers = asyncHandler(async (req, res) => {
  const { specialty, verified } = req.query;
  const where = {};
  if (specialty) where.specialty = { contains: specialty, mode: 'insensitive' };
  if (verified !== undefined) where.verified = verified === 'true';

  const developers = await prisma.developer.findMany({
    where,
    include: { user: { select: { fullName: true, email: true } } },
    orderBy: { rating: 'desc' },
  });
  res.json({ developers });
});

/// GET /api/developers/:id
const getDeveloper = asyncHandler(async (req, res) => {
  const developer = await prisma.developer.findUnique({
    where: { id: req.params.id },
    include: { user: { select: { fullName: true, email: true } } },
  });
  if (!developer) throw new ApiError(404, 'Developer not found');
  res.json({ developer });
});

/// GET /api/developers/me — the logged-in developer's own profile
const getMyDeveloperProfile = asyncHandler(async (req, res) => {
  const developer = await prisma.developer.findUnique({ where: { userId: req.user.id } });
  if (!developer) throw new ApiError(404, 'No developer profile for this account');
  res.json({ developer });
});

/// PATCH /api/developers/me — the logged-in developer edits their own
/// companyName / contact / specialty without needing to know their own
/// Developer.id first.
const updateMyDeveloperProfile = asyncHandler(async (req, res) => {
  const developer = await prisma.developer.findUnique({ where: { userId: req.user.id } });
  if (!developer) throw new ApiError(404, 'No developer profile for this account');

  const parsed = developerUpdateSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message);

  const updated = await prisma.developer.update({ where: { id: developer.id }, data: parsed.data });
  res.json({ developer: updated });
});

/// PATCH /api/developers/:id — the developer editing their own profile
const updateDeveloper = asyncHandler(async (req, res) => {
  const developer = await prisma.developer.findUnique({ where: { id: req.params.id } });
  if (!developer) throw new ApiError(404, 'Developer not found');
  if (developer.userId !== req.user.id && req.user.role !== 'ADMIN') {
    throw new ApiError(403, 'You can only edit your own profile');
  }

  const parsed = developerUpdateSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message);

  const updated = await prisma.developer.update({ where: { id: developer.id }, data: parsed.data });
  res.json({ developer: updated });
});

/// PATCH /api/developers/:id/verify — admin only
const verifyDeveloper = asyncHandler(async (req, res) => {
  const developer = await prisma.developer.findUnique({ where: { id: req.params.id } });
  if (!developer) throw new ApiError(404, 'Developer not found');

  const updated = await prisma.developer.update({
    where: { id: developer.id },
    data: { verified: req.body.verified !== false },
  });

  // Bug fix: notifyUser writes an AppNotification row and fires a push.
  // It was previously awaited unguarded here, so if it ever threw (e.g. a
  // transient DB hiccup writing the notification row) the whole verify
  // request would 500 — the admin's approve/reject tap would appear to do
  // nothing even though nothing was actually wrong with the verification
  // itself. The verification is already saved above; a notification
  // failure must never roll that back or block the response.
  try {
    await notifyUser(
      developer.userId,
      'Verification update',
      updated.verified
        ? 'Your developer profile has been verified by Jolshiri Management.'
        : 'Your developer profile verification has been revoked.'
    );
  } catch (err) {
    console.error('notifyUser failed after verifyDeveloper:', err);
  }

  res.json({ developer: updated });
});

// ── Service Providers ────────────────────────────────────────────────────

/// GET /api/providers?serviceType=&verified=true
const listProviders = asyncHandler(async (req, res) => {
  const { serviceType, verified } = req.query;
  const where = {};
  if (serviceType) where.serviceType = { contains: serviceType, mode: 'insensitive' };
  if (verified !== undefined) where.verified = verified === 'true';

  const providers = await prisma.serviceProvider.findMany({ where, orderBy: { rating: 'desc' } });
  res.json({ providers });
});

/// GET /api/providers/:id
const getProvider = asyncHandler(async (req, res) => {
  const provider = await prisma.serviceProvider.findUnique({ where: { id: req.params.id } });
  if (!provider) throw new ApiError(404, 'Service provider not found');
  res.json({ provider });
});

/// GET /api/providers/me — the logged-in service provider's own profile
const getMyProviderProfile = asyncHandler(async (req, res) => {
  const provider = await prisma.serviceProvider.findUnique({ where: { userId: req.user.id } });
  if (!provider) throw new ApiError(404, 'No service provider profile for this account');
  res.json({ provider });
});

/// PATCH /api/providers/me — the logged-in service provider edits their own
/// name / serviceType / phone without needing to know their own
/// ServiceProvider.id first.
const updateMyProviderProfile = asyncHandler(async (req, res) => {
  const provider = await prisma.serviceProvider.findUnique({ where: { userId: req.user.id } });
  if (!provider) throw new ApiError(404, 'No service provider profile for this account');

  const parsed = providerUpdateSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message);

  const updated = await prisma.serviceProvider.update({
    where: { id: provider.id },
    data: parsed.data,
  });
  res.json({ provider: updated });
});

/// PATCH /api/providers/:id
const updateProvider = asyncHandler(async (req, res) => {
  const provider = await prisma.serviceProvider.findUnique({ where: { id: req.params.id } });
  if (!provider) throw new ApiError(404, 'Service provider not found');
  if (provider.userId !== req.user.id && req.user.role !== 'ADMIN') {
    throw new ApiError(403, 'You can only edit your own profile');
  }

  const parsed = providerUpdateSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message);

  const updated = await prisma.serviceProvider.update({
    where: { id: provider.id },
    data: parsed.data,
  });
  res.json({ provider: updated });
});

/// PATCH /api/providers/:id/verify — admin only
const verifyProvider = asyncHandler(async (req, res) => {
  const provider = await prisma.serviceProvider.findUnique({ where: { id: req.params.id } });
  if (!provider) throw new ApiError(404, 'Service provider not found');

  const updated = await prisma.serviceProvider.update({
    where: { id: provider.id },
    data: { verified: req.body.verified !== false },
  });

  // Same fix as verifyDeveloper above — never let a notification hiccup
  // block or fail the verify response itself.
  try {
    await notifyUser(
      provider.userId,
      'Verification update',
      updated.verified
        ? 'Your service provider profile has been verified by Jolshiri Management.'
        : 'Your service provider profile verification has been revoked.'
    );
  } catch (err) {
    console.error('notifyUser failed after verifyProvider:', err);
  }

  res.json({ provider: updated });
});

/// POST /api/providers/:id/reviews — a resident reviews a provider
const addReview = asyncHandler(async (req, res) => {
  const provider = await prisma.serviceProvider.findUnique({ where: { id: req.params.id } });
  if (!provider) throw new ApiError(404, 'Service provider not found');

  const parsed = reviewCreateSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message);

  const review = await prisma.$transaction(async (tx) => {
    const created = await tx.serviceReview.create({
      data: { ...parsed.data, providerId: provider.id, residentId: req.user.id },
    });

    // Recompute the provider's rolling average rating + review count.
    const agg = await tx.serviceReview.aggregate({
      where: { providerId: provider.id },
      _avg: { rating: true },
      _count: true,
    });
    await tx.serviceProvider.update({
      where: { id: provider.id },
      data: { rating: agg._avg.rating || 0, reviews: agg._count },
    });

    return created;
  });

  await notifyUser(
    provider.userId,
    'New review',
    `You received a new ${parsed.data.rating}-star review.`
  );

  res.status(201).json({ review });
});

/// GET /api/providers/:id/reviews
const listReviews = asyncHandler(async (req, res) => {
  const reviews = await prisma.serviceReview.findMany({
    where: { providerId: req.params.id },
    include: { resident: { select: { fullName: true } } },
    orderBy: { reviewedAt: 'desc' },
  });
  res.json({ reviews });
});

module.exports = {
  listDevelopers,
  getDeveloper,
  getMyDeveloperProfile,
  updateMyDeveloperProfile,
  updateDeveloper,
  verifyDeveloper,
  listProviders,
  getProvider,
  getMyProviderProfile,
  updateMyProviderProfile,
  updateProvider,
  verifyProvider,
  addReview,
  listReviews,
};
