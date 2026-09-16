const { getFirebaseAdmin } = require('../config/firebase');

/// Sends a push notification via Firebase Cloud Messaging.
/// Falls back to a mock log if Firebase is not configured.
async function sendPush(userId, title, message) {
  const admin = getFirebaseAdmin();

  if (!admin) {
    console.log(`[push:mock] -> user ${userId}: ${title} — ${message}`);
    return { delivered: false, mocked: true };
  }

  try {
    // Look up the user's FCM token from DB
    const prisma = require('../config/db');
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { fcmToken: true },
    });

    if (!user?.fcmToken) {
      console.log(`[push] No FCM token for user ${userId}`);
      return { delivered: false, reason: 'no_token' };
    }

    await admin.messaging().send({
      token: user.fcmToken,
      notification: { title, body: message },
      android: { priority: 'high' },
      apns: { payload: { aps: { sound: 'default' } } },
    });

    console.log(`[push] Sent to user ${userId}: ${title}`);
    return { delivered: true };
  } catch (err) {
    console.error(`[push] Failed for user ${userId}:`, err.message);
    return { delivered: false, error: err.message };
  }
}

module.exports = { sendPush };
