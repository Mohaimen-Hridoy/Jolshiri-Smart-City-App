const prisma = require('../config/db');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

/// Part 9: Notifications — the in-app feed backing every `notifyUser(...)`
/// call made across parts 2–9 (bookings, quotes, meetings, complaints,
/// payments, verification, ...).

/// GET /api/notifications/mine
const listMyNotifications = asyncHandler(async (req, res) => {
  const notifications = await prisma.appNotification.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ notifications });
});

/// PATCH /api/notifications/:id/read
const markRead = asyncHandler(async (req, res) => {
  const notification = await prisma.appNotification.findUnique({ where: { id: req.params.id } });
  if (!notification) throw new ApiError(404, 'Notification not found');
  if (notification.userId !== req.user.id) throw new ApiError(403, 'Not your notification');

  const updated = await prisma.appNotification.update({
    where: { id: notification.id },
    data: { isRead: true },
  });
  res.json({ notification: updated });
});

/// PATCH /api/notifications/read-all
const markAllRead = asyncHandler(async (req, res) => {
  await prisma.appNotification.updateMany({
    where: { userId: req.user.id, isRead: false },
    data: { isRead: true },
  });
  res.json({ success: true });
});

module.exports = { listMyNotifications, markRead, markAllRead };
