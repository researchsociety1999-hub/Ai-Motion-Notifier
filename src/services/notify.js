const admin = require('firebase-admin');

// Initialize Firebase Admin SDK once
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

/**
 * Send a push notification via Firebase Cloud Messaging
 * @param {object} opts
 * @param {string} opts.title - Notification title
 * @param {string} opts.body  - Notification body
 * @param {string} opts.clipUrl - URL of the video clip
 */
async function sendPushNotification({ title, body, clipUrl }) {
  // In production: fetch FCM token from DB for the user
  // For now, use a placeholder topic — replace with real user FCM tokens
  const message = {
    topic: 'ring-motion-alerts',
    notification: { title, body },
    data: { clipUrl: clipUrl || '' },
    android: { priority: 'high' },
    apns: { payload: { aps: { sound: 'default', badge: 1 } } },
  };

  const response = await admin.messaging().send(message);
  console.log('Push notification sent:', response);
  return response;
}

module.exports = { sendPushNotification };
