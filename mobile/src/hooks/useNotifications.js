import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import messaging from '@react-native-firebase/messaging';
import { FCM_TOPIC } from '../config';

// Show notifications when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export function useNotifications(onNotification) {
  const notificationListener = useRef();
  const responseListener = useRef();

  useEffect(() => {
    if (!Device.isDevice) {
      console.warn('[Notifications] Push notifications require a real device');
      return;
    }

    const setup = async () => {
      // 1. Request permission
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        console.warn('[Notifications] Permission not granted');
        return;
      }

      // 2. Subscribe to Ring alerts topic
      await messaging().subscribeToTopic(FCM_TOPIC);
      console.log(`[Notifications] Subscribed to topic: ${FCM_TOPIC}`);

      // 3. Foreground FCM messages — show as local notification
      const unsubscribeForeground = messaging().onMessage(async remoteMessage => {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: remoteMessage.notification?.title || '🚨 Motion Detected',
            body: remoteMessage.notification?.body || '',
            data: remoteMessage.data,
          },
          trigger: null,
        });
        if (onNotification) onNotification(remoteMessage);
      });

      // 4. App opened from background notification
      messaging().onNotificationOpenedApp(remoteMessage => {
        if (onNotification) onNotification(remoteMessage);
      });

      return () => unsubscribeForeground();
    };

    setup();

    notificationListener.current = Notifications.addNotificationReceivedListener(
      notification => console.log('[Notifications] Received:', notification)
    );
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      response => console.log('[Notifications] Tapped:', response)
    );

    return () => {
      Notifications.removeNotificationSubscription(notificationListener.current);
      Notifications.removeNotificationSubscription(responseListener.current);
    };
  }, []);
}
