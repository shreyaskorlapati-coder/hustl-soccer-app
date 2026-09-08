import React, { useMemo } from "react";
import { Linking, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { useTheme, ThemeColors } from "../theme";
import { Place } from "../types";

interface Props {
  place: Place;
  onViewOnMap: () => void;
}

function openDirections(lat: number, lon: number, label: string) {
  const encodedLabel = encodeURIComponent(label);
  const url = Platform.select({
    ios: `maps://?daddr=${lat},${lon}&q=${encodedLabel}`,
    android: `geo:${lat},${lon}?q=${lat},${lon}(${encodedLabel})`,
    default: `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=18/${lat}/${lon}`,
  });
  if (url) Linking.openURL(url);
}

function getSportIcon(sport: string | null): string {
  const icons: Record<string, string> = {
    soccer: "⚽",
    basketball: "🏀",
    tennis: "🎾",
    baseball: "⚾",
    volleyball: "🏐",
    golf: "⛳",
    swimming: "🏊",
  };
  return sport ? icons[sport] || "🏟️" : "🏟️";
}

export default function PlaceCard({ place, onViewOnMap }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.icon}>{getSportIcon(place.sport)}</Text>
        <View style={styles.headerText}>
          <Text style={styles.name}>{place.name}</Text>
          <Text style={styles.meta}>
            {place.distance_miles} mi away{place.sport ? ` · ${place.sport}` : ""}
          </Text>
        </View>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.button}
          onPress={() => openDirections(place.lat, place.lon, place.name)}
        >
          <Text style={styles.buttonText}>Directions</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, styles.secondaryButton]} onPress={onViewOnMap}>
          <Text style={[styles.buttonText, styles.secondaryButtonText]}>View on Map</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.inputBorder,
    },
    header: {
      flexDirection: "row",
      alignItems: "flex-start",
    },
    icon: {
      fontSize: 28,
      marginRight: 12,
    },
    headerText: {
      flex: 1,
    },
    name: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.text,
    },
    meta: {
      fontSize: 13,
      color: colors.textMuted,
      marginTop: 4,
    },
    actions: {
      flexDirection: "row",
      marginTop: 14,
    },
    button: {
      backgroundColor: colors.accent,
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 8,
      marginRight: 10,
    },
    secondaryButton: {
      backgroundColor: "transparent",
      borderWidth: 1,
      borderColor: colors.accent,
    },
    buttonText: {
      color: colors.textInverse,
      fontWeight: "600",
      fontSize: 13,
    },
    secondaryButtonText: {
      color: colors.accent,
    },
  });
}
