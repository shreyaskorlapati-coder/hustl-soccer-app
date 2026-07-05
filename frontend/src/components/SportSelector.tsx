import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { Sport } from "../types";

const SPORTS: { value: Sport; label: string }[] = [
  { value: "soccer", label: "Soccer" },
  { value: "basketball", label: "Basketball" },
  { value: "tennis", label: "Tennis" },
  { value: "baseball", label: "Baseball" },
  { value: "volleyball", label: "Volleyball" },
  { value: "golf", label: "Golf" },
  { value: "swimming", label: "Swimming" },
  { value: "general", label: "Any" },
];

interface Props {
  value: Sport;
  onChange: (sport: Sport) => void;
}

export default function SportSelector({ value, onChange }: Props) {
  return (
    <View style={styles.container}>
      {SPORTS.map((s) => (
        <TouchableOpacity
          key={s.value}
          style={[styles.chip, value === s.value && styles.chipSelected]}
          onPress={() => onChange(s.value)}
        >
          <Text style={[styles.chipText, value === s.value && styles.chipTextSelected]}>
            {s.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: "row", flexWrap: "wrap" },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#ccc",
    marginRight: 8,
    marginBottom: 8,
  },
  chipSelected: { backgroundColor: "#1e88e5", borderColor: "#1e88e5" },
  chipText: { color: "#333", fontSize: 14 },
  chipTextSelected: { color: "#fff", fontWeight: "600" },
});
