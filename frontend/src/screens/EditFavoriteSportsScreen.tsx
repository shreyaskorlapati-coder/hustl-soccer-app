import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { updateCurrentUser, getApiErrorMessage } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useTheme, ThemeColors } from "../theme";

type Props = {
  navigation: {
    goBack: () => void;
  };
};

const SPORTS = [
  { id: "soccer", label: "Soccer", icon: "⚽", description: "The beautiful game" },
  { id: "basketball", label: "Basketball", icon: "🏀", description: "Hoops and slam dunks" },
  { id: "football", label: "Football", icon: "🏈", description: "American football" },
  { id: "baseball", label: "Baseball", icon: "⚾", description: "America's pastime" },
  { id: "tennis", label: "Tennis", icon: "🎾", description: "Singles or doubles" },
  { id: "pickleball", label: "Pickleball", icon: "🏓", description: "Fast-growing paddle sport" },
];

export default function EditFavoriteSportsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { user, updateUser } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [selectedSports, setSelectedSports] = useState<string[]>(
    user?.favorite_sports || []
  );
  const [saving, setSaving] = useState(false);

  const hasChanges = JSON.stringify(selectedSports.sort()) !== 
    JSON.stringify((user?.favorite_sports || []).sort());

  const toggleSport = (sportId: string) => {
    setSelectedSports((prev) =>
      prev.includes(sportId)
        ? prev.filter((id) => id !== sportId)
        : [...prev, sportId]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updatedUser = await updateCurrentUser({
        favorite_sports: selectedSports,
      });

      if (updateUser) {
        updateUser({
          ...user!,
          favorite_sports: updatedUser.favorite_sports,
        });
      }

      Alert.alert("Success", "Your favorite sports have been updated", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      Alert.alert("Error", getApiErrorMessage(err, "Failed to update favorite sports"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.headerText} />
        </TouchableOpacity>
        <Text style={styles.title}>Favorite Sports</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.subtitle}>
          Select the sports you're interested in. We'll personalize your feed and suggest relevant games.
        </Text>

        <View style={styles.sportsGrid}>
          {SPORTS.map((sport) => {
            const isSelected = selectedSports.includes(sport.id);
            return (
              <TouchableOpacity
                key={sport.id}
                style={[styles.sportCard, isSelected && styles.sportCardSelected]}
                onPress={() => toggleSport(sport.id)}
                activeOpacity={0.7}
              >
                <View style={styles.sportIconContainer}>
                  <Text style={styles.sportIcon}>{sport.icon}</Text>
                  {isSelected && (
                    <View style={styles.checkBadge}>
                      <Ionicons name="checkmark" size={12} color={colors.textInverse} />
                    </View>
                  )}
                </View>
                <Text style={[styles.sportLabel, isSelected && styles.sportLabelSelected]}>
                  {sport.label}
                </Text>
                <Text style={styles.sportDescription}>{sport.description}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {selectedSports.length > 0 && (
          <View style={styles.selectedInfo}>
            <Ionicons name="heart" size={16} color={colors.accent} />
            <Text style={styles.selectedText}>
              {selectedSports.length} sport{selectedSports.length !== 1 ? "s" : ""} selected
            </Text>
          </View>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          style={[
            styles.saveButton,
            (!hasChanges || saving) && styles.saveButtonDisabled,
          ]}
          onPress={handleSave}
          disabled={!hasChanges || saving}
        >
          {saving ? (
            <ActivityIndicator color={colors.textInverse} />
          ) : (
            <>
              <Ionicons name="checkmark" size={20} color={colors.textInverse} />
              <Text style={styles.saveButtonText}>Save Changes</Text>
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
    content: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: 20,
      paddingTop: 20,
    },
    subtitle: {
      fontSize: 14,
      color: colors.textMuted,
      lineHeight: 20,
      marginBottom: 24,
    },
    sportsGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 12,
    },
    sportCard: {
      width: "47%",
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      borderWidth: 2,
      borderColor: colors.inputBorder,
    },
    sportCardSelected: {
      borderColor: colors.accent,
      backgroundColor: colors.primaryLight,
    },
    sportIconContainer: {
      position: "relative",
      alignSelf: "flex-start",
      marginBottom: 12,
    },
    sportIcon: {
      fontSize: 40,
    },
    checkBadge: {
      position: "absolute",
      top: -4,
      right: -8,
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: colors.accent,
      justifyContent: "center",
      alignItems: "center",
    },
    sportLabel: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.text,
      marginBottom: 4,
    },
    sportLabelSelected: {
      color: colors.accent,
    },
    sportDescription: {
      fontSize: 12,
      color: colors.textMuted,
    },
    selectedInfo: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      marginTop: 24,
      paddingVertical: 12,
      backgroundColor: colors.card,
      borderRadius: 8,
    },
    selectedText: {
      fontSize: 14,
      color: colors.textMuted,
    },
    footer: {
      paddingHorizontal: 20,
      paddingTop: 16,
      backgroundColor: colors.background,
      borderTopWidth: 1,
      borderTopColor: colors.inputBorder,
    },
    saveButton: {
      backgroundColor: colors.accent,
      borderRadius: 12,
      paddingVertical: 16,
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      gap: 8,
    },
    saveButtonDisabled: {
      opacity: 0.5,
    },
    saveButtonText: {
      fontSize: 16,
      fontWeight: "bold",
      color: colors.textInverse,
    },
  });
}
