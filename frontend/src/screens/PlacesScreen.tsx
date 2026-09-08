import * as Location from "expo-location";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { geocodeLocation, searchSavedPlacesNearby, SavedPlaceWithDistance } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useTheme, ThemeColors } from "../theme";

function getSportIcon(sport: string | null): string {
  switch (sport) {
    case "soccer": return "⚽";
    case "basketball": return "🏀";
    case "volleyball": return "🏐";
    case "tennis": return "🎾";
    case "baseball": return "⚾";
    case "football": return "🏈";
    default: return "📍";
  }
}

export default function PlacesScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const firstName = user?.name?.split(" ")[0] ?? "Player";
  
  const [places, setPlaces] = useState<SavedPlaceWithDistance[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null);

  const fetchPlaces = useCallback(async (lat: number, lon: number) => {
    try {
      const response = await searchSavedPlacesNearby(lat, lon, undefined, 50000);
      setPlaces(response.results);
    } catch (error) {
      console.error("Failed to fetch places:", error);
      setPlaces([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const initializeLocation = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const position = await Location.getCurrentPositionAsync({});
        const loc = { lat: position.coords.latitude, lon: position.coords.longitude };
        setUserLocation(loc);
        fetchPlaces(loc.lat, loc.lon);
      } else {
        setLoading(false);
      }
    } catch {
      setLoading(false);
    }
  }, [fetchPlaces]);

  useEffect(() => {
    initializeLocation();
  }, [initializeLocation]);

  function handleRefresh() {
    if (userLocation) {
      setRefreshing(true);
      fetchPlaces(userLocation.lat, userLocation.lon);
    }
  }

  async function handleSearch() {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const geo = await geocodeLocation(searchQuery.trim());
      setUserLocation({ lat: geo.lat, lon: geo.lon });
      await fetchPlaces(geo.lat, geo.lon);
    } catch {
      Alert.alert("Search Failed", "Could not find that location.");
    } finally {
      setIsSearching(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.greeting}>Hello, {firstName} 👋</Text>
        <Text style={styles.title}>Saved Places</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.accent} />}
      >
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search by location..."
            placeholderTextColor={colors.placeholder}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
          <TouchableOpacity style={styles.searchButton} onPress={handleSearch} disabled={isSearching}>
            {isSearching ? <ActivityIndicator size="small" color={colors.textInverse} /> : <Text style={styles.searchButtonText}>🔍</Text>}
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color={colors.accent} size="large" />
            <Text style={styles.loadingText}>Finding nearby places...</Text>
          </View>
        ) : places.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📍</Text>
            <Text style={styles.emptyText}>No saved places nearby</Text>
            <Text style={styles.emptySubtext}>Places you name when creating games will appear here</Text>
          </View>
        ) : (
          <>
            <Text style={styles.resultsCount}>{places.length} places found</Text>
            {places.map((place) => (
              <TouchableOpacity key={place.id} style={styles.placeCard}>
                <View style={styles.placeIconContainer}>
                  <Text style={styles.placeIcon}>{getSportIcon(place.sport)}</Text>
                </View>
                <View style={styles.placeInfo}>
                  <Text style={styles.placeName}>{place.name}</Text>
                  <Text style={styles.placeMeta}>{place.distance_miles} mi · {place.sport || "General"}</Text>
                  {place.address ? <Text style={styles.placeAddress} numberOfLines={1}>{place.address}</Text> : null}
                </View>
                <View style={styles.placeActions}>
                  <TouchableOpacity style={styles.actionButton}>
                    <Text style={styles.actionButtonText}>📍</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { backgroundColor: colors.headerBackground, paddingTop: 60, paddingBottom: 20, paddingHorizontal: 20 },
  greeting: { fontSize: 14, color: "rgba(255,255,255,0.7)", marginBottom: 4 },
  title: { fontSize: 28, fontWeight: "800", color: colors.headerText },
  scrollView: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 100 },
  searchContainer: { flexDirection: "row", marginBottom: 20 },
  searchInput: { flex: 1, backgroundColor: colors.inputBackground, borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 12, borderTopRightRadius: 0, borderBottomRightRadius: 0, padding: 14, fontSize: 15, color: colors.inputText },
  searchButton: { backgroundColor: colors.primary, paddingHorizontal: 20, borderRadius: 12, borderTopLeftRadius: 0, borderBottomLeftRadius: 0, justifyContent: "center", alignItems: "center" },
  searchButtonText: { fontSize: 18 },
  loadingContainer: { padding: 40, alignItems: "center" },
  loadingText: { color: colors.textMuted, marginTop: 12, fontSize: 14 },
  emptyState: { backgroundColor: colors.card, borderRadius: 12, padding: 40, alignItems: "center" },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyText: { color: colors.text, fontSize: 18, fontWeight: "600" },
  emptySubtext: { color: colors.textMuted, fontSize: 14, marginTop: 4, textAlign: "center" },
  resultsCount: { fontSize: 12, color: colors.textMuted, marginBottom: 16, letterSpacing: 0.5 },
  placeCard: { flexDirection: "row", alignItems: "center", backgroundColor: colors.card, borderRadius: 12, padding: 16, marginBottom: 12 },
  placeIconContainer: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primary, justifyContent: "center", alignItems: "center", marginRight: 12 },
  placeIcon: { fontSize: 24 },
  placeInfo: { flex: 1 },
  placeName: { fontSize: 16, fontWeight: "700", color: colors.text, marginBottom: 4 },
  placeMeta: { fontSize: 13, color: colors.accent, fontWeight: "500" },
  placeAddress: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  placeActions: { marginLeft: 8 },
  actionButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.inputBorder, justifyContent: "center", alignItems: "center" },
  actionButtonText: { fontSize: 18 },
});
}
