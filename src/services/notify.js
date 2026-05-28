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
 * Notification priority matrix based on AI classification + time of day
 *
 * classification | time       | priority
 * ------------------------------------------------
 * person         | night      | HIGH  (push + sound)
 * person         | day        | MEDIUM (push)
 * vehicle        | any        | MEDIUM (push)
 * package        | any        | LOW   (push, no sound)
 * animal         | any        | SILENT (log only)
 * unknown        | any        | MEDIUM (push)
 */
function resolveNotificationPriority({ classification, confidence, timestamp }) {
  const hour = new Date(timestamp).getHours();
  const isNight = hour < 6 || hour >= 22;

  // Low confidence — don't spam with uncertain detections
  if (confidence > 0 && confidence < 0.4) return 'silent';

  switch (classification) {
    case 'person':
      return isNight ? 'high' : 'medium';
    case 'vehicle':
      return 'medium';
    case 'package':
      return 'low';
    case 'animal':
      return 'silent';
    default:
      return 'medium';
  }
}

/**
 * Send a push notification via Firebase Cloud Messaging
 * with smart priority routing based on AI classification
 *
 * @param {object} opts
 * @param {string} opts.title             - Notification title
 * @param {string} opts.body              - Notification body
 * @param {string} opts.clipUrl           - URL of the video clip
 * @param {string} [opts.classification]  - AI classification result
 * @param {number} [opts.confidence]      - AI confidence score (0-1)
 * @param {string} [opts.timestamp]       - ISO timestamp of the event
 * @param {string} [opts.deviceName]      - Camera name
 */
async function sendPushNotification({ title, body, clipUrl, classification, confidence, timestamp, deviceName }) {
  const priority = resolveNotificationPriority({
    classification: classification || 'unknown',
    confidence: confidence || 0,
    timestamp: timestamp || new Date().toISOString(),
  });

  // Silent priority — log but don't push
  if (priority === 'silent') {
    console.log(`[notify] Silent event skipped — classification: ${classification}, device: ${deviceName}`);
    return { skipped: true, priority, reason: 'silent_classification' };
  }

  const androidPriority = priority === 'high' ? 'high' : 'normal';
  const sound = priority === 'high' ? 'default' : priority === 'medium' ? 'default' : null;
  const badge = priority === 'high' ? 1 : 0;

  const message = {
    topic: 'ring-motion-alerts',
    notification: { title, body },
    data: {
      clipUrl: clipUrl || '',
      classification: classification || 'unknown',
      confidence: String(confidence || 0),
      priority,
    },
    android: {
      priority: androidPriority,
      notification: {
        sound: sound || undefined,
        notificationPriority: priority === 'high' ? 'PRIORITY_HIGH' : 'PRIORITY_DEFAULT',
      },
    },
    apns: {
      payload: {
        aps: {
          sound: sound || undefined,
          badge,
          'interruption-level': priority === 'high' ? 'time-sensitive' : 'active',
        },
      },
    },
  };

  const response = await admin.messaging().send(message);
  console.log(`[notify] Push sent — priority: ${priority}, classification: ${classification}, id: ${response}`);
  return { response, priority, skipped: false };
}

module.exports = { sendPushNotification, resolveNotificationPriority };
