import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { createTournament, getApiErrorMessage } from "../api/client";
import { useTheme, ThemeColors } from "../theme";
import { GameSport } from "../types";

type Props = {
  navigation: {
    goBack: () => void;
    navigate: (screen: string, params?: Record<string, unknown>) => void;
  };
};

const SPORTS: { value: GameSport; label: string; icon: string }[] = [
  { value: "soccer", label: "Soccer", icon: "football-outline" },
  { value: "basketball", label: "Basketball", icon: "basketball-outline" },
  { value: "football", label: "Football", icon: "american-football-outline" },
  { value: "baseball", label: "Baseball", icon: "baseball-outline" },
  { value: "tennis", label: "Tennis", icon: "tennisball-outline" },
  { value: "pickleball", label: "Pickleball", icon: "tennisball-outline" },
];

const TEAM_SIZES = [4, 8, 16, 32];

export default function CreateTournamentScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sport, setSport] = useState<GameSport>("soccer");
  const [maxTeams, setMaxTeams] = useState(8);
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert("Error", "Please enter a tournament name");
      return;
    }

    setCreating(true);
    try {
      const tournament = await createTournament({
        name: name.trim(),
        sport,
        description: description.trim() || undefined,
        max_teams: maxTeams,
      });

      Alert.alert("Success", `Tournament "${tournament.name}" created successfully!`, [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      Alert.alert("Error", getApiErrorMessage(err, "Failed to create tournament"));
    } finally {
      setCreating(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.headerText} />
        </TouchableOpacity>
        <Text style={styles.title}>Create Tournament</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={styles.content}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>TOURNAMENT NAME</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Chicago Cup, Summer League..."
              placeholderTextColor={colors.placeholder}
              autoCapitalize="words"
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>SPORT</Text>
            <View style={styles.sportsRow}>
              {SPORTS.map((s) => {
                const isEnabled = s.value === "soccer";
                const isActive = sport === s.value;
                return (
                  <TouchableOpacity
                    key={s.value}
                    style={[
                      styles.sportChip,
                      isActive && styles.sportChipActive,
                      !isEnabled && styles.sportChipDisabled,
                    ]}
                    onPress={() => isEnabled && setSport(s.value)}
                    disabled={!isEnabled}
                    activeOpacity={isEnabled ? 0.7 : 1}
                  >
                    <Ionicons
                      name={s.icon as keyof typeof Ionicons.glyphMap}
                      size={18}
                      color={isActive ? colors.textInverse : isEnabled ? colors.textMuted : colors.placeholder}
                    />
                    <Text style={[
                      styles.sportChipText,
                      isActive && styles.sportChipTextActive,
                      !isEnabled && styles.sportChipTextDisabled,
                    ]}>
                      {s.label}
                    </Text>
                    {!isEnabled && <Text style={styles.comingSoonBadge}>SOON</Text>}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>MAX TEAMS</Text>
            <View style={styles.teamSizesRow}>
              {TEAM_SIZES.map((size) => (
                <TouchableOpacity
                  key={size}
                  style={[styles.teamSizeChip, maxTeams === size && styles.teamSizeChipActive]}
                  onPress={() => setMaxTeams(size)}
                >
                  <Text style={[styles.teamSizeText, maxTeams === size && styles.teamSizeTextActive]}>
                    {size}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>DESCRIPTION (OPTIONAL)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Tournament rules, prizes, schedule..."
              placeholderTextColor={colors.placeholder}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.infoCard}>
            <Ionicons name="information-circle-outline" size={20} color={colors.success} />
            <Text style={styles.infoText}>
              After creating the tournament, you can register teams and generate the bracket.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          style={[styles.createButton, creating && styles.createButtonDisabled]}
          onPress={handleCreate}
          disabled={creating}
        >
          {creating ? (
            <ActivityIndicator color={colors.textInverse} />
          ) : (
            <>
              <Text style={styles.createButtonText}>Create Tournament</Text>
              <Ionicons name="arrow-forward" size={20} color={colors.textInverse} />
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingVertical: 16,
      backgroundColor: colors.headerBackground,
    },
    backButton: {
      width: 40,
      height: 40,
      justifyContent: "center",
      alignItems: "center",
    },
    title: {
      fontSize: 20,
      fontWeight: "bold",
      color: colors.headerText,
    },
    keyboardView: {
      flex: 1,
    },
    content: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: 20,
      paddingTop: 20,
    },
    section: {
      marginBottom: 24,
    },
    sectionLabel: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.textMuted,
      marginBottom: 12,
      letterSpacing: 1,
    },
    input: {
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      borderRadius: 12,
      padding: 16,
      fontSize: 16,
      color: colors.inputText,
    },
    textArea: {
      minHeight: 100,
      paddingTop: 16,
    },
    sportsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    sportChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 20,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    sportChipActive: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    sportChipText: {
      fontSize: 14,
      color: colors.textMuted,
      fontWeight: "500",
    },
    sportChipDisabled: {
      opacity: 0.4,
    },
    sportChipTextDisabled: {
      color: colors.placeholder,
    },
    comingSoonBadge: {
      fontSize: 8,
      fontWeight: "700",
      color: colors.accent,
      marginLeft: 4,
      backgroundColor: "rgba(232, 106, 51, 0.2)",
      paddingHorizontal: 4,
      paddingVertical: 2,
      borderRadius: 4,
    },
    sportChipTextActive: {
      color: colors.textInverse,
    },
    teamSizesRow: {
      flexDirection: "row",
      gap: 12,
    },
    teamSizeChip: {
      width: 56,
      height: 56,
      borderRadius: 12,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: "center",
      alignItems: "center",
    },
    teamSizeChipActive: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    teamSizeText: {
      fontSize: 18,
      fontWeight: "bold",
      color: colors.textMuted,
    },
    teamSizeTextActive: {
      color: colors.textInverse,
    },
    infoCard: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
      borderLeftWidth: 3,
      borderLeftColor: colors.success,
    },
    infoText: {
      flex: 1,
      fontSize: 14,
      color: colors.textMuted,
      lineHeight: 20,
    },
    footer: {
      paddingHorizontal: 20,
      paddingTop: 16,
      backgroundColor: colors.background,
    },
    createButton: {
      backgroundColor: colors.accent,
      borderRadius: 12,
      paddingVertical: 16,
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      gap: 8,
    },
    createButtonDisabled: {
      opacity: 0.6,
    },
    createButtonText: {
      fontSize: 16,
      fontWeight: "bold",
      color: colors.textInverse,
    },
  });
}
