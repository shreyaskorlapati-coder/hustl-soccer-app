import { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";

import { searchPlaces } from "../api/client";
import PlaceCard from "../components/PlaceCard";
import { Place, RootStackParamList } from "../types";

type Props = NativeStackScreenProps<RootStackParamList, "Results">;

export default function ResultsScreen({ route, navigation }: Props) {
  const { lat, lon, sport, radius, locationLabel } = route.params;
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await searchPlaces(lat, lon, sport, radius);
        if (!cancelled) setPlaces(data.results);
      } catch (err) {
        if (!cancelled) setError("Couldn't load nearby facilities. Pull to retry.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [lat, lon, sport, radius]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1e88e5" />
        <Text style={styles.stateText}>Finding nearby fields…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.stateText}>{error}</Text>
      </View>
    );
  }

  if (places.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.stateText}>No sports facilities found nearby</Text>
        <Text style={styles.stateSubtext}>Try a larger radius or a different sport.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>
          {places.length} places near {locationLabel}
        </Text>
      </View>
      <FlatList
        data={places}
        keyExtractor={(item) => `${item.osm_type}-${item.osm_id}`}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <PlaceCard
            place={item}
            onViewOnMap={() => navigation.navigate("Map", { lat, lon, places, locationLabel })}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f6f8" },
  header: { padding: 16, paddingBottom: 8 },
  headerText: { fontSize: 15, fontWeight: "600", color: "#333" },
  list: { paddingHorizontal: 16, paddingBottom: 24 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  stateText: { fontSize: 15, color: "#555", marginTop: 12, textAlign: "center" },
  stateSubtext: { fontSize: 13, color: "#999", marginTop: 6, textAlign: "center" },
});
