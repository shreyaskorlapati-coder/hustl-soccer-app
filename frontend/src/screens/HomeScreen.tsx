import { NativeStackScreenProps } from "@react-navigation/native-stack";
import Slider from "@react-native-community/slider";
import * as Location from "expo-location";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
} from "react-native";

import { geocodeLocation } from "../api/client";
import SportSelector from "../components/SportSelector";
import { RootStackParamList, Sport } from "../types";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

const METERS_PER_KM = 1000;

export default function HomeScreen({ navigation }: Props) {
  const [locationText, setLocationText] = useState("");
  const [sport, setSport] = useState<Sport>("soccer");
  const [radiusKm, setRadiusKm] = useState(5);
  const [loading, setLoading] = useState(false);

  async function handleUseGPS() {
    setLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Location permission denied",
          "Enter a location manually below to search instead."
        );
        return;
      }
      const position = await Location.getCurrentPositionAsync({});
      navigation.navigate("Results", {
        lat: position.coords.latitude,
        lon: position.coords.longitude,
        sport,
        radius: radiusKm * METERS_PER_KM,
        locationLabel: "Current Location",
      });
    } catch (err) {
      Alert.alert("Couldn't get your location", "Enter a location manually below instead.");
    } finally {
      setLoading(false);
    }
  }

  async function handleManualSearch() {
    if (!locationText.trim()) {
      Alert.alert("Enter a location", "Type a city, address, or zip code to search.");
      return;
    }
    setLoading(true);
    try {
      const geo = await geocodeLocation(locationText.trim());
      navigation.navigate("Results", {
        lat: geo.lat,
        lon: geo.lon,
        sport,
        radius: radiusKm * METERS_PER_KM,
        locationLabel: geo.display_name,
      });
    } catch (err) {
      Alert.alert("Location not found", "Try a different search term.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Find Sports Facilities</Text>

      <TouchableOpacity style={styles.gpsButton} onPress={handleUseGPS} disabled={loading}>
        <Text style={styles.gpsButtonText}>Use My Current Location</Text>
      </TouchableOpacity>

      <Text style={styles.orText}>or search a location</Text>
      <TextInput
        style={styles.input}
        placeholder="City, address, or zip code"
        value={locationText}
        onChangeText={setLocationText}
        returnKeyType="search"
        onSubmitEditing={handleManualSearch}
      />

      <Text style={styles.label}>Sport</Text>
      <SportSelector value={sport} onChange={setSport} />

      <Text style={styles.label}>Search Radius: {radiusKm} km</Text>
      <Slider
        style={styles.slider}
        minimumValue={1}
        maximumValue={25}
        step={1}
        value={radiusKm}
        onValueChange={setRadiusKm}
        minimumTrackTintColor="#1e88e5"
      />

      <TouchableOpacity style={styles.searchButton} onPress={handleManualSearch} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.searchButtonText}>Search</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  title: { fontSize: 26, fontWeight: "800", marginBottom: 24, color: "#1a1a1a" },
  gpsButton: {
    backgroundColor: "#1e88e5",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  gpsButtonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  orText: { textAlign: "center", color: "#888", marginVertical: 14 },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
  },
  label: { fontSize: 15, fontWeight: "700", marginTop: 24, marginBottom: 10, color: "#1a1a1a" },
  slider: { width: "100%", height: 40 },
  searchButton: {
    backgroundColor: "#0d47a1",
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 30,
  },
  searchButtonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
