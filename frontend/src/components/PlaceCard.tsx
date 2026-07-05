import React from "react";
import { Linking, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";

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

export default function PlaceCard({ place, onViewOnMap }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.name}>{place.name}</Text>
      <Text style={styles.meta}>
        {place.distance_miles} mi away{place.sport ? ` · ${place.sport}` : ""}
      </Text>
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

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  name: { fontSize: 16, fontWeight: "700", color: "#1a1a1a" },
  meta: { fontSize: 13, color: "#666", marginTop: 4 },
  actions: { flexDirection: "row", marginTop: 12 },
  button: {
    backgroundColor: "#1e88e5",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    marginRight: 10,
  },
  secondaryButton: { backgroundColor: "#eef3fb" },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  secondaryButtonText: { color: "#1e88e5" },
});
