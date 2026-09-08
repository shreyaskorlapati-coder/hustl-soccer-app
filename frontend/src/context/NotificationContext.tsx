import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  ReactNode,
} from "react";

import {
  getUnreadNotificationCount,
  listNotifications,
  markNotificationsRead,
  Notification,
  NotificationsResponse,
  registerDeviceToken,
} from "../api/client";
import { useAuth } from "./AuthContext";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  expoPushToken: string | null;
  fetchNotifications: (unreadOnly?: boolean) => Promise<void>;
  markAsRead: (notificationIds?: string[], markAll?: boolean) => Promise<void>;
  refreshUnreadCount: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

interface NotificationProviderProps {
  readonly children: ReactNode;
}

async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (!Device.isDevice) {
    console.log("Push notifications require a physical device");
    return null;
  }

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      console.log("Push notification permission not granted");
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync();
    
    console.log("Expo Push Token:", tokenData.data);
    return tokenData.data;
  } catch (error) {
    console.error("Error getting push token:", error);
    return null;
  }
}

export function NotificationProvider({ children }: NotificationProviderProps) {
  const { isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);

  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  const refreshUnreadCount = useCallback(async () => {
    if (!isAuthenticated) return;
    
    try {
      const { unread_count } = await getUnreadNotificationCount();
      setUnreadCount(unread_count);
    } catch (error) {
      console.error("Failed to fetch unread count:", error);
    }
  }, [isAuthenticated]);

  const fetchNotifications = useCallback(
    async (unreadOnly: boolean = false) => {
      if (!isAuthenticated) return;

      setIsLoading(true);
      try {
        const response: NotificationsResponse = await listNotifications({
          limit: 50,
          unread_only: unreadOnly,
        });
        setNotifications(response.results);
        setUnreadCount(response.unread_count);
      } catch (error) {
        console.error("Failed to fetch notifications:", error);
      } finally {
        setIsLoading(false);
      }
    },
    [isAuthenticated]
  );

  const markAsRead = useCallback(
    async (notificationIds?: string[], markAll: boolean = false) => {
      if (!isAuthenticated) return;

      try {
        await markNotificationsRead(notificationIds, markAll);
        
        if (markAll) {
          setNotifications((prev) =>
            prev.map((n) => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
          );
          setUnreadCount(0);
        } else if (notificationIds) {
          setNotifications((prev) =>
            prev.map((n) =>
              notificationIds.includes(n.id)
                ? { ...n, is_read: true, read_at: new Date().toISOString() }
                : n
            )
          );
          setUnreadCount((prev) => Math.max(0, prev - notificationIds.length));
        }
      } catch (error) {
        console.error("Failed to mark notifications as read:", error);
      }
    },
    [isAuthenticated]
  );

  useEffect(() => {
    if (!isAuthenticated) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    async function setupPushNotifications() {
      const token = await registerForPushNotificationsAsync();
      setExpoPushToken(token);

      if (token) {
        try {
          const platform = Platform.OS === "ios" ? "ios" : "android";
          await registerDeviceToken({
            token,
            platform,
            device_name: Device.modelName || undefined,
          });
          console.log("Device token registered with backend");
        } catch (error) {
          console.error("Failed to register device token:", error);
        }
      }
    }

    setupPushNotifications();
    fetchNotifications();

    notificationListener.current = Notifications.addNotificationReceivedListener(
      (notification: Notifications.Notification) => {
        console.log("Notification received:", notification);
        refreshUnreadCount();
        fetchNotifications();
      }
    );

    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response: Notifications.NotificationResponse) => {
        console.log("Notification response:", response);
        const data = response.notification.request.content.data as Record<string, unknown>;
        
        if (data?.notification_id) {
          markAsRead([data.notification_id as string]);
        }
      }
    );

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, [isAuthenticated, fetchNotifications, refreshUnreadCount, markAsRead]);

  useEffect(() => {
    if (!isAuthenticated) return;

    const interval = setInterval(refreshUnreadCount, 60000);
    return () => clearInterval(interval);
  }, [isAuthenticated, refreshUnreadCount]);

  const value: NotificationContextType = useMemo(
    () => ({
      notifications,
      unreadCount,
      isLoading,
      expoPushToken,
      fetchNotifications,
      markAsRead,
      refreshUnreadCount,
    }),
    [notifications, unreadCount, isLoading, expoPushToken, fetchNotifications, markAsRead, refreshUnreadCount]
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications(): NotificationContextType {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error("useNotifications must be used within a NotificationProvider");
  }
  return context;
}
