import { useNavigation } from "@react-navigation/native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  getNotificationPreferences,
  NotificationPreferences,
  updateNotificationPreferences,
} from "../api/client";
import { useTheme, ThemeColors } from "../theme";

interface ToggleRowProps {
  readonly label: string;
  readonly description?: string;
  readonly value: boolean;
  readonly onValueChange: (value: boolean) => void;
  readonly styles: ReturnType<typeof createStyles>;
  readonly colors: ThemeColors;
}

function ToggleRow({ label, description, value, onValueChange, styles, colors }: ToggleRowProps) {
  return (
    <View style={styles.toggleRow}>
      <View style={styles.toggleInfo}>
        <Text style={styles.toggleLabel}>{label}</Text>
        {description ? <Text style={styles.toggleDescription}>{description}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.inputBorder, true: colors.primary }}
        thumbColor={value ? colors.accent : colors.textMuted}
      />
    </View>
  );
}

export default function NotificationSettingsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadPreferences();
  }, []);

  async function loadPreferences() {
    try {
      const prefs = await getNotificationPreferences();
      setPreferences(prefs);
    } catch (error) {
      console.error("Failed to load notification preferences:", error);
      Alert.alert("Error", "Failed to load notification settings");
    } finally {
      setIsLoading(false);
    }
  }

  const updatePreference = useCallback(
    async (key: keyof NotificationPreferences, value: boolean) => {
      if (!preferences) return;

      const previousPrefs = preferences;
      const updatedPrefs = { ...preferences, [key]: value };
      setPreferences(updatedPrefs);

      try {
        setIsSaving(true);
        await updateNotificationPreferences({ [key]: value });
      } catch (error) {
        console.error("Failed to update preference:", error);
        setPreferences(previousPrefs);
        Alert.alert("Error", "Failed to save preference");
      } finally {
        setIsSaving(false);
      }
    },
    [preferences]
  );

  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!preferences) {
    return (
      <View style={[styles.container, styles.loadingContainer, { paddingTop: insets.top }]}>
        <Text style={styles.errorText}>Failed to load settings</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notification Settings</Text>
        <View style={styles.placeholder} />
      </View>

      {isSaving && (
        <View style={styles.savingIndicator}>
          <ActivityIndicator size="small" color={colors.accent} />
          <Text style={styles.savingText}>Saving...</Text>
        </View>
      )}

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Game Notifications</Text>
          <View style={styles.card}>
            <ToggleRow
              styles={styles}
              colors={colors}
              label="Game Reminders"
              description="Get reminded before your scheduled games"
              value={preferences.game_reminders}
              onValueChange={(v) => updatePreference("game_reminders", v)}
            />
            <View style={styles.divider} />
            <ToggleRow
              styles={styles}
              colors={colors}
              label="Player Joined"
              description="When someone joins your game"
              value={preferences.game_player_joined}
              onValueChange={(v) => updatePreference("game_player_joined", v)}
            />
            <View style={styles.divider} />
            <ToggleRow
              styles={styles}
              colors={colors}
              label="Player Left"
              description="When someone leaves your game"
              value={preferences.game_player_left}
              onValueChange={(v) => updatePreference("game_player_left", v)}
            />
            <View style={styles.divider} />
            <ToggleRow
              styles={styles}
              colors={colors}
              label="Game Cancelled"
              description="When a game you joined is cancelled"
              value={preferences.game_cancelled}
              onValueChange={(v) => updatePreference("game_cancelled", v)}
            />
            <View style={styles.divider} />
            <ToggleRow
              styles={styles}
              colors={colors}
              label="Game Updates"
              description="Changes to game details (time, location, etc.)"
              value={preferences.game_updated}
              onValueChange={(v) => updatePreference("game_updated", v)}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Team Notifications</Text>
          <View style={styles.card}>
            <ToggleRow
              styles={styles}
              colors={colors}
              label="Team Invitations"
              description="When you're invited to join a team"
              value={preferences.team_invitations}
              onValueChange={(v) => updatePreference("team_invitations", v)}
            />
            <View style={styles.divider} />
            <ToggleRow
              styles={styles}
              colors={colors}
              label="Member Joined"
              description="When someone joins your team"
              value={preferences.team_member_joined}
              onValueChange={(v) => updatePreference("team_member_joined", v)}
            />
            <View style={styles.divider} />
            <ToggleRow
              styles={styles}
              colors={colors}
              label="Member Left"
              description="When someone leaves your team"
              value={preferences.team_member_left}
              onValueChange={(v) => updatePreference("team_member_left", v)}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tournament Notifications</Text>
          <View style={styles.card}>
            <ToggleRow
              styles={styles}
              colors={colors}
              label="Tournament Updates"
              description="Registration, bracket generation, etc."
              value={preferences.tournament_updates}
              onValueChange={(v) => updatePreference("tournament_updates", v)}
            />
            <View style={styles.divider} />
            <ToggleRow
              styles={styles}
              colors={colors}
              label="Match Reminders"
              description="Reminders before your tournament matches"
              value={preferences.tournament_match_reminders}
              onValueChange={(v) => updatePreference("tournament_match_reminders", v)}
            />
            <View style={styles.divider} />
            <ToggleRow
              styles={styles}
              colors={colors}
              label="Match Results"
              description="When match scores are posted"
              value={preferences.tournament_results}
              onValueChange={(v) => updatePreference("tournament_results", v)}
            />
          </View>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoIcon}>💡</Text>
          <Text style={styles.infoText}>
            Push notifications require permissions to be enabled on your device. Make sure
            notifications are allowed for this app in your device settings.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.headerBackground,
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
    color: colors.headerText,
    fontWeight: "300",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.headerText,
  },
  placeholder: {
    width: 40,
  },
  savingIndicator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    backgroundColor: colors.card,
  },
  savingText: {
    fontSize: 12,
    color: colors.accent,
    marginLeft: 8,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.accent,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 12,
    marginLeft: 4,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    overflow: "hidden",
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  toggleInfo: {
    flex: 1,
    marginRight: 16,
  },
  toggleLabel: {
    fontSize: 16,
    fontWeight: "500",
    color: colors.text,
  },
  toggleDescription: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: colors.inputBorder,
    marginHorizontal: 16,
  },
  infoCard: {
    flexDirection: "row",
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  infoIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
  },
  errorText: {
    fontSize: 16,
    color: colors.textMuted,
  },
});
}
