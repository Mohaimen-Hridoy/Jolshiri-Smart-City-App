const prisma = require('../config/db');
const { sendPush } = require('./pushNotification');

/// Shared helper used across parts 2–9: writes an AppNotification row (so
/// it shows up in the Flutter app's notification feed) and fires the
/// (mocked) push notification. `client` lets callers pass a `tx` when this
/// needs to happen inside a Prisma transaction; defaults to the normal
/// prisma client otherwise.
async function notifyUser(userId, title, message, client = prisma) {
  const notification = await client.appNotification.create({
    data: { userId, title, message },
  });
  // Fire-and-forget — a push failure should never fail the request that
  // triggered it (e.g. a booking status update).
  sendPush(userId, title, message).catch(() => {});
  return notification;
}

module.exports = { notifyUser };
