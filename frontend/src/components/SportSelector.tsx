import React, { useMemo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { useTheme, ThemeColors } from "../theme";
import { Sport } from "../types";

const SPORTS: { value: Sport; label: string; icon: string }[] = [
  { value: "soccer", label: "Soccer", icon: "⚽" },
  { value: "basketball", label: "Basketball", icon: "🏀" },
  { value: "football", label: "Football", icon: "🏈" },
  { value: "baseball", label: "Baseball", icon: "⚾" },
  { value: "tennis", label: "Tennis", icon: "🎾" },
  { value: "pickleball", label: "Pickleball", icon: "🏓" },
  { value: "general", label: "Any", icon: "🏟️" },
];

interface Props {
  value: Sport;
  onChange: (sport: Sport) => void;
}

export default function SportSelector({ value, onChange }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      {SPORTS.map((s) => (
        <TouchableOpacity
          key={s.value}
          style={[styles.chip, value === s.value && styles.chipSelected]}
          onPress={() => onChange(s.value)}
        >
          <Text style={styles.chipIcon}>{s.icon}</Text>
          <Text style={[styles.chipText, value === s.value && styles.chipTextSelected]}>
            {s.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 25,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.inputBorder,
    },
    chipSelected: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    chipIcon: {
      fontSize: 16,
      marginRight: 6,
    },
    chipText: {
      color: colors.textMuted,
      fontSize: 14,
      fontWeight: "500",
    },
    chipTextSelected: {
      color: colors.textInverse,
      fontWeight: "600",
    },
  });
}
