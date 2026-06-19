import { useState, useEffect, useRef } from 'react';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { useAuthStore } from '../stores/useAuthStore';
import { userService } from '../services/userService';

// Determine if we're running in Expo Go
const isExpoGo = Constants.executionEnvironment === 'storeClient';

let Notifications: any = null;
if (!isExpoGo) {
  try {
    Notifications = require('expo-notifications');
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  } catch (e) {
    console.log("Could not load expo-notifications", e);
  }
}

export function usePushNotifications() {
  const [expoPushToken, setExpoPushToken] = useState('');
  const [notification, setNotification] = useState<any>(undefined);
  const notificationListener = useRef<any>(null);
  const responseListener = useRef<any>(null);
  const { user, accessToken } = useAuthStore();
  const pushTokenRegisteredRef = useRef<boolean>(false);

  useEffect(() => {
    if (isExpoGo || !Notifications) {
      console.log("Push notifications are disabled in Expo Go (SDK 53+).");
      return;
    }

    registerForPushNotificationsAsync()
      .then(token => {
        if (token) {
          setExpoPushToken(token);
        }
      })
      .catch((error: any) => setExpoPushToken(`${error}`));

    notificationListener.current = Notifications.addNotificationReceivedListener((notification: any) => {
      setNotification(notification);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener((response: any) => {
      console.log(response);
    });

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, []);

  useEffect(() => {
    // Send token to backend if user is logged in
    if (expoPushToken && user?.id && accessToken && !pushTokenRegisteredRef.current) {
      userService.updatePushToken(accessToken, user.tenantId, expoPushToken)
        .then(() => {
          pushTokenRegisteredRef.current = true;
        })
        .catch((error) => console.error("Failed to update push token:", error));
    }
  }, [expoPushToken, user?.id, accessToken]);

  return { expoPushToken, notification };
}

async function registerForPushNotificationsAsync() {
  if (isExpoGo || !Notifications) return;

  let token;

  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return;
    }
    
    // Use the actual project ID from app.config.js/app.json if available
    const projectId = Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId;
    if (projectId) {
      token = await Notifications.getExpoPushTokenAsync({
        projectId,
      });
    } else {
      token = await Notifications.getExpoPushTokenAsync();
    }
  } else {
    console.log('Must use physical device for Push Notifications');
  }

  return token?.data;
}
