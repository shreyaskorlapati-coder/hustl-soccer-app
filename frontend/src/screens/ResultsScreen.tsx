import { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";

import { getApiErrorMessage, searchPlaces } from "../api/client";
import PlaceCard from "../components/PlaceCard";
import { useTheme, ThemeColors } from "../theme";
import { Place, RootStackParamList } from "../types";

type Props = NativeStackScreenProps<RootStackParamList, "Results">;

export default function ResultsScreen({ route, navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
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
        console.error("Failed to load nearby places", err);
        if (!cancelled) {
          setError(getApiErrorMessage(err, "Couldn't load nearby facilities. Pull to retry."));
        }
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
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.stateText}>Finding nearby fields…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.stateText}>{error}</Text>
      </View>
    );
  }

  if (places.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyIcon}>🔍</Text>
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

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: colors.headerBackground,
    padding: 16,
    paddingBottom: 12,
  },
  headerText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.headerText,
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: colors.background,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  stateText: {
    fontSize: 16,
    color: colors.text,
    marginTop: 12,
    textAlign: "center",
    fontWeight: "600",
  },
  stateSubtext: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 6,
    textAlign: "center",
  },
});
}
