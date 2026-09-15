const crypto = require('crypto');
const prisma = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { sendOtpEmail } = require('../services/emailService');

/// Part 9: Admin KPI/report aggregation — powers the AdminShell dashboard's
/// summary cards. All counts are cheap grouped queries; nothing here does
/// N+1 lookups.

/// GET /api/admin/kpis
const getKpis = asyncHandler(async (req, res) => {
  const [
    usersByRole,
    rentalCount,
    pendingViewingRequests,
    developerCount,
    providerCount,
    unverifiedDevelopers,
    unverifiedProviders,
    bookingsByStatus,
    quotesByStatus,
    upcomingMeetings,
    activeProjects,
    stagesPendingApproval,
    complaintsByStatus,
    paymentsByStatus,
    openSecurityReports,
  ] = await Promise.all([
    prisma.user.groupBy({ by: ['role'], _count: true }),
    prisma.rentalListing.count(),
    prisma.rentalViewingRequest.count({ where: { status: 'PENDING' } }),
    prisma.developer.count(),
    prisma.serviceProvider.count(),
    prisma.developer.count({ where: { verified: false } }),
    prisma.serviceProvider.count({ where: { verified: false } }),
    prisma.serviceBooking.groupBy({ by: ['status'], _count: true }),
    prisma.quoteRequest.groupBy({ by: ['status'], _count: true }),
    prisma.developerMeeting.count({ where: { status: { in: ['PENDING', 'CONFIRMED'] }, scheduledFor: { gte: new Date() } } }),
    prisma.constructionProject.count({ where: { permitStatus: 'APPROVED' } }),
    prisma.constructionStage.count({ where: { status: 'PENDING_APPROVAL' } }),
    prisma.complaint.groupBy({ by: ['status'], _count: true }),
    prisma.paymentRecord.groupBy({ by: ['status'], _count: true }),
    prisma.securityReport.count({ where: { status: 'Open' } }),
  ]);

  const toMap = (rows, key) => Object.fromEntries(rows.map((r) => [r[key], r._count]));

  res.json({
    kpis: {
      usersByRole: toMap(usersByRole, 'role'),
      rentalCount,
      pendingViewingRequests,
      developerCount,
      providerCount,
      unverifiedDevelopers,
      unverifiedProviders,
      bookingsByStatus: toMap(bookingsByStatus, 'status'),
      quotesByStatus: toMap(quotesByStatus, 'status'),
      upcomingMeetings,
      activeProjects,
      stagesPendingApproval,
      complaintsByStatus: toMap(complaintsByStatus, 'status'),
      paymentsByStatus: toMap(paymentsByStatus, 'status'),
      openSecurityReports,
    },
  });
});

/// GET /api/admin/users?role=&search=
/// Lists all registered users. Supports filtering by role and a free-text
/// search over fullName and email (case-insensitive).
const listUsers = asyncHandler(async (req, res) => {
  const { role, search } = req.query;
  const where = {};
  if (role) where.role = role;
  if (search) {
    where.OR = [
      { fullName: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
  }
  const users = await prisma.user.findMany({
    where,
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      role: true,
      adminType: true,
      accountStatus: true,
      address: true,
      plotNumber: true,
      sectorNumber: true,
      constructionStatus: true,
      rentStatus: true,
      isEmailVerified: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ users });
});

/// GET /api/admin/users/:id
const getUser = asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
    select: {
      id: true, fullName: true, email: true, phone: true, role: true,
      adminType: true, accountStatus: true, address: true, plotNumber: true,
      sectorNumber: true, constructionStatus: true, rentStatus: true,
      createdAt: true, developerProfile: true, providerProfile: true,
    },
  });
  if (!user) throw new ApiError(404, 'User not found');
  res.json({ user });
});

/// PATCH /api/admin/users/:id — update a user's account status (suspend, ban, or reactivate).
/// Any admin type can suspend/reactivate; SYSTEM_MODERATOR can also ban.
/// Body: { action: 'suspend' | 'unsuspend' | 'ban' }
const updateUser = asyncHandler(async (req, res) => {
  const { action } = req.body;
  if (!action || !['suspend', 'unsuspend', 'ban'].includes(action)) {
    throw new ApiError(400, 'action must be one of: suspend, unsuspend, ban');
  }

  // Only SYSTEM_MODERATOR can permanently ban a user.
  if (action === 'ban' && req.user.adminType !== 'SYSTEM_MODERATOR') {
    throw new ApiError(403, 'Only a System Moderator can ban users');
  }

  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) throw new ApiError(404, 'User not found');
  if (user.id === req.user.id) throw new ApiError(400, 'You cannot change your own account status');

  // Map action to accountStatus field values.
  // 'suspend' -> SUSPENDED, 'ban' -> BANNED, 'unsuspend' -> ACTIVE.
  const accountStatus = action === 'suspend' ? 'SUSPENDED'
    : action === 'ban' ? 'BANNED'
    : 'ACTIVE';

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { accountStatus },
    select: {
      id: true, fullName: true, email: true, role: true, adminType: true,
      accountStatus: true,
    },
  });

  res.json({ user: updated });
});

/// DELETE /api/admin/users/:id — SYSTEM_MODERATOR: remove a user account.
/// Also cascades to their developer/provider profile via Prisma relations.
const deleteUser = asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) throw new ApiError(404, 'User not found');
  // Prevent self-deletion
  if (user.id === req.user.id) throw new ApiError(400, 'You cannot delete your own account');

  await prisma.user.delete({ where: { id: user.id } });
  res.status(204).send();
});

/// POST /api/admin/users/:id/reset-password
/// Admin-initiated password reset: generates a 6-digit OTP (reusing the same
/// resetToken/resetTokenExpiry fields as the self-service forgot-password
/// flow) and emails it to the user. The user then completes the reset via
/// the normal POST /api/auth/reset-password endpoint with that code.
const adminResetPassword = asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) throw new ApiError(404, 'User not found');

  const otp = crypto.randomInt(100000, 999999).toString();
  const resetTokenExpiry = new Date(Date.now() + 15 * 60 * 1000);

  await prisma.user.update({
    where: { id: user.id },
    data: { resetToken: otp, resetTokenExpiry },
  });

  const emailResult = await sendOtpEmail(user.email, otp);

  // In development without Gmail configured, surface the OTP so the flow
  // can still be tested end-to-end.
  const devToken = (!emailResult.sent && process.env.NODE_ENV !== 'production')
    ? otp
    : undefined;

  res.json({
    message: `A password reset code has been sent to ${user.email}`,
    ...(devToken ? { token: devToken } : {}),
  });
});

/// POST /api/admin/users/:id/verify
/// Marks a user's account as email-verified. Useful when a resident/provider
/// can't receive the signup OTP (delivery issues, typo'd inbox, etc.) and a
/// moderator needs to unblock their account manually.
const verifyUser = asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) throw new ApiError(404, 'User not found');

  if (user.isEmailVerified) {
    return res.json({ message: `${user.fullName} is already verified` });
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { isEmailVerified: true, signupOtp: null, signupOtpExpiry: null },
    select: {
      id: true, fullName: true, email: true, role: true, adminType: true,
      isEmailVerified: true,
    },
  });

  res.json({ message: `${updated.fullName} has been verified`, user: updated });
});

/// GET /api/admin/plots
/// Returns all resident-owner accounts as a "plot archive" — the
/// developer dashboard reads this to show the full plot registry.
/// Available to any authenticated ADMIN; developer and moderator dashboards
/// use this for the Plot Archive tab.
const listPlots = asyncHandler(async (req, res) => {
  const { sector, status, search } = req.query;
  const where = { role: 'RESIDENT_OWNER' };

  if (sector) where.sectorNumber = parseInt(sector, 10);
  if (status) where.constructionStatus = status;
  if (search) {
    where.OR = [
      { fullName: { contains: search, mode: 'insensitive' } },
      { plotNumber: { contains: search, mode: 'insensitive' } },
    ];
  }

  const residents = await prisma.user.findMany({
    where,
    select: {
      plotNumber: true,
      sectorNumber: true,
      constructionStatus: true,
      fullName: true,
      createdAt: true,
      constructionAsOwner: {
        select: { developer: { select: { companyName: true } } },
        take: 1,
        orderBy: { createdAt: 'desc' },
      },
    },
    orderBy: [{ sectorNumber: 'asc' }, { plotNumber: 'asc' }],
  });

  const plots = residents
    .filter((r) => r.plotNumber) // skip accounts without a plot number
    .map((r) => ({
      plotNumber: r.plotNumber,
      sectorNumber: r.sectorNumber,
      constructionStatus: r.constructionStatus ?? 'NOT_STARTED',
      ownerName: r.fullName,
      developerCompany: r.constructionAsOwner[0]?.developer?.companyName ?? null,
      lastUpdated: r.createdAt.toISOString().slice(0, 7), // "YYYY-MM"
    }));

  res.json({ plots });
});

module.exports = {
  getKpis, listUsers, getUser, updateUser, deleteUser, listPlots,
  adminResetPassword, verifyUser,
};

