import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { deleteNotification, Notification } from "../api/client";
import { useNotifications } from "../context/NotificationContext";
import { useTheme, Colors } from "../theme";
import { RootStackParamList } from "../types";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

function getNotificationIcon(type: string): string {
  if (type.includes("game")) return "🏟️";
  if (type.includes("team")) return "👥";
  if (type.includes("tournament")) return "🏆";
  return "🔔";
}

function formatTimeAgo(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export default function NotificationsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const { notifications, unreadCount, isLoading, fetchNotifications, markAsRead } =
    useNotifications();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchNotifications();
    setRefreshing(false);
  }, [fetchNotifications]);

  const handleMarkAllRead = useCallback(async () => {
    await markAsRead(undefined, true);
  }, [markAsRead]);

  const handleNotificationPress = useCallback(
    async (notification: Notification) => {
      if (!notification.is_read) {
        await markAsRead([notification.id]);
      }

      if (notification.reference_type && notification.reference_id) {
        switch (notification.reference_type) {
          case "game":
            navigation.navigate("GameDetails", { gameId: notification.reference_id });
            break;
          case "team":
            navigation.navigate("TeamDetails", { teamId: notification.reference_id });
            break;
          case "tournament":
            navigation.navigate("TournamentDetails", {
              tournamentId: notification.reference_id,
            });
            break;
        }
      }
    },
    [markAsRead, navigation]
  );

  const handleDelete = useCallback(
    async (notificationId: string) => {
      try {
        await deleteNotification(notificationId);
        await fetchNotifications();
      } catch (error) {
        console.error("Failed to delete notification:", error);
      }
    },
    [fetchNotifications]
  );

  const renderNotification = useCallback(
    ({ item }: { item: Notification }) => (
      <TouchableOpacity
        style={[styles.notificationCard, { backgroundColor: colors.card }, !item.is_read && { backgroundColor: colors.primaryLight, borderLeftWidth: 3, borderLeftColor: colors.accent }]}
        onPress={() => handleNotificationPress(item)}
        activeOpacity={0.7}
      >
        <View style={[styles.iconContainer, { backgroundColor: colors.primary }]}>
          <Text style={styles.icon}>{getNotificationIcon(item.notification_type)}</Text>
        </View>
        <View style={styles.contentContainer}>
          <View style={styles.headerRow}>
            <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
              {item.title}
            </Text>
            {!item.is_read && <View style={[styles.unreadDot, { backgroundColor: colors.accent }]} />}
          </View>
          <Text style={[styles.body, { color: colors.textMuted }]} numberOfLines={2}>
            {item.body}
          </Text>
          <Text style={[styles.time, { color: colors.textMuted }]}>{formatTimeAgo(item.created_at)}</Text>
        </View>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDelete(item.id)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={[styles.deleteText, { color: colors.textMuted }]}>×</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    ),
    [handleNotificationPress, handleDelete, colors]
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.headerBackground }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={[styles.backText, { color: colors.textInverse }]}>‹</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textInverse }]}>Notifications</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate("NotificationSettings")}
          style={styles.settingsButton}
        >
          <Text style={styles.settingsIcon}>⚙️</Text>
        </TouchableOpacity>
      </View>

      {unreadCount > 0 && (
        <View style={[styles.actionsBar, { borderBottomColor: colors.border }]}>
          <Text style={[styles.unreadText, { color: colors.textMuted }]}>{unreadCount} unread</Text>
          <TouchableOpacity onPress={handleMarkAllRead}>
            <Text style={[styles.markAllText, { color: colors.accent }]}>Mark all as read</Text>
          </TouchableOpacity>
        </View>
      )}

      {isLoading && notifications.length === 0 && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.accentOrange} />
        </View>
      )}
      
      {!isLoading && notifications.length === 0 && (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>🔔</Text>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No notifications yet</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
            You'll see updates about your games, teams, and tournaments here
          </Text>
        </View>
      )}
      
      {notifications.length > 0 && (
        <FlatList
          data={notifications}
          renderItem={renderNotification}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={Colors.accentOrange}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  backText: {
    fontSize: 32,
    fontWeight: "300",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  settingsButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  settingsIcon: {
    fontSize: 20,
  },
  actionsBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  unreadText: {
    fontSize: 14,
  },
  markAllText: {
    fontSize: 14,
    fontWeight: "600",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  notificationCard: {
    flexDirection: "row",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  icon: {
    fontSize: 20,
  },
  contentContainer: {
    flex: 1,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    flex: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 8,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 6,
  },
  time: {
    fontSize: 12,
  },
  deleteButton: {
    width: 28,
    height: 28,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  deleteText: {
    fontSize: 24,
    fontWeight: "300",
  },
});
