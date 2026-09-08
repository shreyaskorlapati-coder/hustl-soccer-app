import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import Constants from "expo-constants";
import * as Location from "expo-location";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, {
  LongPressEvent,
  MapPressEvent,
  Marker,
  PoiClickEvent,
  PROVIDER_DEFAULT,
  PROVIDER_GOOGLE,
  Region,
} from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { createPlace, getApiErrorMessage } from "../api/client";
import { useTheme, ThemeColors } from "../theme";
import { GameSport, PickedMapPlace, RootStackParamList } from "../types";

type Props = NativeStackScreenProps<RootStackParamList, "PickMapLocation">;

const FALLBACK_REGION: Region = {
  latitude: 39.8283,
  longitude: -98.5795,
  latitudeDelta: 25,
  longitudeDelta: 25,
};

const MAX_NAME_LENGTH = 255;
const MAX_ADDRESS_LENGTH = 500;

const SPORT_TO_API: Record<string, string> = {
  soccer: "soccer",
  basketball: "basketball",
  football: "general",
  baseball: "baseball",
  volleyball: "volleyball",
  other: "general",
};

function hasGoogleMapsApiKey(): boolean {
  // On Android, the key is in AndroidManifest.xml, so always use Google provider
  // On iOS, the key is in Info.plist
  // The key is embedded at build time, so we can assume it's available
  if (Platform.OS === "android" || Platform.OS === "ios") {
    return true;
  }
  // Fallback check for web or other platforms
  const expoConfig = Constants.expoConfig;
  return Boolean(
    expoConfig?.ios?.config?.googleMapsApiKey ||
      expoConfig?.android?.config?.googleMaps?.apiKey ||
      expoConfig?.extra?.googleMapsApiKey
  );
}

function isValidCoordinate(lat: number, lon: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}

function formatAddress(geo: Location.LocationGeocodedAddress): string {
  const street =
    geo.streetNumber && geo.street
      ? `${geo.streetNumber} ${geo.street}`
      : geo.street;
  const parts = [street, geo.city, geo.region, geo.postalCode, geo.country].filter(
    (part): part is string => Boolean(part)
  );
  return parts.join(", ");
}

export default function PickMapLocationScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const sport: GameSport = route.params?.sport ?? "soccer";

  const mapRef = useRef<MapView>(null);
  const reverseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRegionRef = useRef<Region | null>(null);

  const [region, setRegion] = useState<Region>(FALLBACK_REGION);
  const [isLocating, setIsLocating] = useState(true);
  const [pin, setPin] = useState<{ latitude: number; longitude: number } | null>(null);
  const [placeName, setPlaceName] = useState("");
  const placeNameRef = useRef("");
  const [address, setAddress] = useState("");
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Only use Google Maps if API key is configured; otherwise use default provider
  const mapProvider = hasGoogleMapsApiKey() ? PROVIDER_GOOGLE : PROVIDER_DEFAULT;

  useEffect(() => {
    let cancelled = false;

    async function centerOnUser() {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted" || cancelled) {
          return;
        }
        const position = await Location.getCurrentPositionAsync({});
        if (cancelled) return;
        const nextRegion: Region = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          latitudeDelta: 0.04,
          longitudeDelta: 0.04,
        };
        setRegion(nextRegion);
        pendingRegionRef.current = nextRegion;
        mapRef.current?.animateToRegion(nextRegion, 600);
      } catch {
        // Keep the fallback region if location is unavailable.
      } finally {
        if (!cancelled) setIsLocating(false);
      }
    }

    centerOnUser();
    return () => {
      cancelled = true;
      if (reverseTimeoutRef.current) {
        clearTimeout(reverseTimeoutRef.current);
      }
    };
  }, []);

  const lookupAddress = useCallback(async (latitude: number, longitude: number, suggestedName?: string) => {
    if (!isValidCoordinate(latitude, longitude)) {
      return;
    }

    setIsGeocoding(true);
    try {
      const results = await Location.reverseGeocodeAsync({ latitude, longitude });
      const first = results[0];
      if (first) {
        const formatted = formatAddress(first).slice(0, MAX_ADDRESS_LENGTH);
        setAddress(formatted);
        if (suggestedName) {
          const nextName = suggestedName.slice(0, MAX_NAME_LENGTH);
          placeNameRef.current = nextName;
          setPlaceName(nextName);
        } else if (!placeNameRef.current.trim()) {
          const fallback = first.name || first.street || formatted || "Dropped pin";
          const nextName = fallback.slice(0, MAX_NAME_LENGTH);
          placeNameRef.current = nextName;
          setPlaceName(nextName);
        }
      } else if (suggestedName) {
        const nextName = suggestedName.slice(0, MAX_NAME_LENGTH);
        placeNameRef.current = nextName;
        setPlaceName(nextName);
        setAddress("");
      } else if (!placeNameRef.current.trim()) {
        placeNameRef.current = "Dropped pin";
        setPlaceName("Dropped pin");
      }
    } catch {
      if (suggestedName) {
        const nextName = suggestedName.slice(0, MAX_NAME_LENGTH);
        placeNameRef.current = nextName;
        setPlaceName(nextName);
      } else if (!placeNameRef.current.trim()) {
        placeNameRef.current = "Dropped pin";
        setPlaceName("Dropped pin");
      }
    } finally {
      setIsGeocoding(false);
    }
  }, []);

  const dropPin = useCallback((latitude: number, longitude: number, suggestedName?: string) => {
    if (!isValidCoordinate(latitude, longitude)) {
      Alert.alert("Invalid Location", "Please pick a point on the map.");
      return;
    }

    setPin({ latitude, longitude });
    if (suggestedName) {
      const nextName = suggestedName.slice(0, MAX_NAME_LENGTH);
      placeNameRef.current = nextName;
      setPlaceName(nextName);
    }

    if (reverseTimeoutRef.current) {
      clearTimeout(reverseTimeoutRef.current);
    }
    reverseTimeoutRef.current = setTimeout(() => {
      lookupAddress(latitude, longitude, suggestedName);
    }, 250);
  }, [lookupAddress]);

  function handleMapPress(event: MapPressEvent) {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    dropPin(latitude, longitude);
  }

  function handleLongPress(event: LongPressEvent) {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    dropPin(latitude, longitude);
  }

  function handlePoiClick(event: PoiClickEvent) {
    const { coordinate, name } = event.nativeEvent;
    dropPin(coordinate.latitude, coordinate.longitude, name);
  }

  async function handleSave() {
    const name = placeName.trim();
    if (!name) {
      Alert.alert("Name Required", "Give this location a name before saving.");
      return;
    }
    if (name.length > MAX_NAME_LENGTH) {
      Alert.alert("Name Too Long", `Please keep the name under ${MAX_NAME_LENGTH} characters.`);
      return;
    }
    if (!pin || !isValidCoordinate(pin.latitude, pin.longitude)) {
      Alert.alert("Pick a Location", "Tap the map to drop a pin first.");
      return;
    }

    setIsSaving(true);
    try {
      const saved = await createPlace({
        name,
        lat: pin.latitude,
        lon: pin.longitude,
        sport: SPORT_TO_API[sport] || sport,
        address: address.trim() ? address.trim().slice(0, MAX_ADDRESS_LENGTH) : undefined,
        tags: { source: "map" },
      });

      const pickedPlace: PickedMapPlace = {
        id: String(saved.id),
        name: saved.name,
        lat: saved.lat,
        lon: saved.lon,
        sport: saved.sport,
        address: saved.address,
        distance_miles: 0,
        tags: saved.tags || { source: "map" },
        isSaved: true,
      };

      if (route.params?.returnTo === "CreateTournamentGames" && route.params.tournamentId) {
        navigation.navigate("CreateTournamentGames", {
          tournamentId: route.params.tournamentId,
          pickedPlace,
        });
      } else {
        navigation.navigate("CreateGame", { pickedPlace });
      }
    } catch (error) {
      Alert.alert("Could Not Save", getApiErrorMessage(error, "Failed to save this location. Please try again."));
    } finally {
      setIsSaving(false);
    }
  }

  const canSave = Boolean(pin && placeName.trim()) && !isSaving;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} accessibilityRole="button">
          <Ionicons name="arrow-back" size={22} color={colors.textInverse} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>CHOOSE ON MAP</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.mapWrap}>
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={mapProvider}
          initialRegion={region}
          showsUserLocation
          showsMyLocationButton
          showsPointsOfInterest
          toolbarEnabled={false}
          onPress={handleMapPress}
          onLongPress={handleLongPress}
          onPoiClick={handlePoiClick}
          onMapReady={() => {
            const pending = pendingRegionRef.current;
            if (pending) {
              mapRef.current?.animateToRegion(pending, 600);
            }
          }}
        >
          {pin ? (
            <Marker
              coordinate={pin}
              draggable
              pinColor={colors.accent}
              title={placeName || "Selected location"}
              description={address || undefined}
              onDragEnd={(event) => {
                const { latitude, longitude } = event.nativeEvent.coordinate;
                dropPin(latitude, longitude);
              }}
            />
          ) : null}
        </MapView>

        {isLocating ? (
          <View style={styles.mapOverlay}>
            <ActivityIndicator color={colors.accent} />
            <Text style={styles.mapOverlayText}>Finding your location…</Text>
          </View>
        ) : null}
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <Text style={styles.hint}>
            Tap a place or anywhere on the map to drop a pin. Drag the pin to adjust.
          </Text>

          <Text style={styles.label}>LOCATION NAME</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Riverside Soccer Field"
            placeholderTextColor={colors.placeholder}
            value={placeName}
            onChangeText={(text) => {
              const next = text.slice(0, MAX_NAME_LENGTH);
              placeNameRef.current = next;
              setPlaceName(next);
            }}
            maxLength={MAX_NAME_LENGTH}
            returnKeyType="done"
          />

          <View style={styles.addressRow}>
            {isGeocoding ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : (
              <Ionicons name="location-outline" size={16} color={colors.textMuted} />
            )}
            <Text style={styles.addressText} numberOfLines={2}>
              {address || (pin ? "Resolving address…" : "No pin dropped yet")}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.saveButton, !canSave && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={!canSave}
            accessibilityRole="button"
            accessibilityLabel="Save map location"
          >
            {isSaving ? (
              <ActivityIndicator color={colors.textInverse} />
            ) : (
              <Text style={styles.saveButtonText}>SAVE LOCATION</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingBottom: 16,
      backgroundColor: colors.headerBackground,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: "rgba(255,255,255,0.1)",
      justifyContent: "center",
      alignItems: "center",
    },
    headerTitle: {
      fontSize: 16,
      fontWeight: "800",
      color: colors.headerText,
      letterSpacing: 1.5,
    },
    headerSpacer: {
      width: 40,
    },
    mapWrap: {
      flex: 1,
    },
    map: {
      flex: 1,
    },
    mapOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(255,255,255,0.55)",
      justifyContent: "center",
      alignItems: "center",
      gap: 8,
    },
    mapOverlayText: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "600",
    },
    sheet: {
      backgroundColor: colors.card,
      paddingHorizontal: 20,
      paddingTop: 16,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      borderTopWidth: 1,
      borderColor: colors.border,
    },
    hint: {
      fontSize: 13,
      color: colors.textMuted,
      marginBottom: 14,
      lineHeight: 18,
    },
    label: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.textMuted,
      letterSpacing: 1,
      marginBottom: 8,
    },
    input: {
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      borderRadius: 12,
      padding: 14,
      fontSize: 15,
      color: colors.inputText,
    },
    addressRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginTop: 12,
      marginBottom: 16,
    },
    addressText: {
      flex: 1,
      fontSize: 13,
      color: colors.textSecondary,
    },
    saveButton: {
      backgroundColor: colors.accent,
      paddingVertical: 16,
      borderRadius: 12,
      alignItems: "center",
    },
    saveButtonDisabled: {
      opacity: 0.5,
    },
    saveButtonText: {
      fontSize: 15,
      fontWeight: "800",
      color: colors.textInverse,
      letterSpacing: 1.5,
    },
  });
}
