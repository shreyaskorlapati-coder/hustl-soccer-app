import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as Location from "expo-location";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  SavedPlace,
  SavedPlaceWithDistance,
  Tournament,
  TournamentTeam,
  createGame,
  createPlace,
  generateBracket,
  geocodeLocation,
  getApiErrorMessage,
  getTournament,
  searchPlaces,
  searchPlacesByName,
  searchSavedPlacesNearby,
  setMatchTeams,
} from "../api/client";
import { useTheme, ThemeColors } from "../theme";
import { GameSport, Place, RootStackParamList, Sport } from "../types";

type Props = NativeStackScreenProps<RootStackParamList, "CreateTournamentGames">;

type SearchResultPlace = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  sport: string | null;
  distance_miles: number;
  tags: Record<string, string>;
  isSaved: boolean;
  address?: string | null;
};

type GameSlot = {
  team1Id: string | null;
  team2Id: string | null;
};

type TeamPickerTarget = {
  slotIndex: number;
  position: 1 | 2;
};

const ROUND_LABELS: Record<string, string> = {
  R32: "Round of 32",
  R16: "Round of 16",
  QF: "Quarterfinals",
  SF: "Semifinals",
  FINAL: "Final",
};

const SPORT_TO_API: Record<string, string> = {
  soccer: "soccer",
  basketball: "basketball",
  football: "general",
  baseball: "baseball",
  volleyball: "volleyball",
  other: "general",
};

const MAX_LOCATION_LENGTH = 500;

function toApiSport(sport: string): GameSport {
  const value = sport.toLowerCase();
  if (value === "soccer" || value === "basketball" || value === "football" || value === "baseball") {
    return value;
  }
  return "other";
}

function formatDate(d: Date): string {
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${month}/${day}/${d.getFullYear()}`;
}

function formatTime(d: Date): string {
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${String(hours).padStart(2, "0")}:${minutes} ${ampm}`;
}

function defaultGameDate(): Date {
  const next = new Date();
  next.setDate(next.getDate() + 1);
  next.setHours(18, 0, 0, 0);
  return next;
}

function teamById(teams: TournamentTeam[], id: string | null): TournamentTeam | undefined {
  if (!id) return undefined;
  return teams.find((team) => team.id === id);
}

function defaultSlots(teams: TournamentTeam[]): GameSlot[] {
  const gameCount = Math.floor(teams.length / 2);
  return Array.from({ length: gameCount }, (_, index) => ({
    team1Id: teams[index * 2]?.id ?? null,
    team2Id: teams[index * 2 + 1]?.id ?? null,
  }));
}

function usedTeamIds(slots: GameSlot[], except?: TeamPickerTarget): Set<string> {
  const used = new Set<string>();
  slots.forEach((slot, index) => {
    if (slot.team1Id && !(except?.slotIndex === index && except.position === 1)) {
      used.add(slot.team1Id);
    }
    if (slot.team2Id && !(except?.slotIndex === index && except.position === 2)) {
      used.add(slot.team2Id);
    }
  });
  return used;
}

export default function CreateTournamentGamesScreen({ navigation, route }: Readonly<Props>) {
  const { tournamentId } = route.params;
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [slots, setSlots] = useState<GameSlot[]>([]);
  const [picker, setPicker] = useState<TeamPickerTarget | null>(null);

  const [locationQuery, setLocationQuery] = useState("");
  const [selectedPlace, setSelectedPlace] = useState<SearchResultPlace | null>(null);
  const [customPlaceName, setCustomPlaceName] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResultPlace[]>([]);
  const [dbSearchResults, setDbSearchResults] = useState<SavedPlace[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isDbSearching, setIsDbSearching] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [showDbResults, setShowDbResults] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isSavingPlace, setIsSavingPlace] = useState(false);

  const [date, setDate] = useState(defaultGameDate);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [creating, setCreating] = useState(false);

  const selectedSport = toApiSport(tournament?.sport ?? "soccer");
  const isUnnamedPlace = Boolean(
    selectedPlace &&
      !selectedPlace.isSaved &&
      (selectedPlace.name === "Unnamed Facility" || selectedPlace.name === "Unnamed")
  );

  const byeTeams = useMemo(() => {
    if (!tournament) return [];
    const used = usedTeamIds(slots);
    return tournament.teams.filter((team) => !used.has(team.id));
  }, [tournament, slots]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await getTournament(tournamentId);
        if (cancelled) return;
        setTournament(data);
        setSlots(defaultSlots(data.teams));
      } catch (err) {
        Alert.alert("Error", getApiErrorMessage(err, "Failed to load tournament"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [tournamentId]);

  useEffect(() => {
    const picked = route.params?.pickedPlace;
    if (!picked) return;

    setSelectedPlace({
      id: picked.id,
      name: picked.name,
      lat: picked.lat,
      lon: picked.lon,
      sport: picked.sport,
      distance_miles: picked.distance_miles,
      tags: picked.tags || {},
      isSaved: picked.isSaved,
      address: picked.address,
    });
    setCustomPlaceName("");
    setLocationQuery("");
    setDbSearchResults([]);
    setShowDbResults(false);
    setSearchResults([]);
    setShowResults(false);
    navigation.setParams({ pickedPlace: undefined });
  }, [route.params?.pickedPlace, navigation]);

  const handleLocationQueryChange = useCallback((text: string) => {
    setLocationQuery(text.slice(0, MAX_LOCATION_LENGTH));
    setShowResults(false);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (text.trim().length < 2) {
      setDbSearchResults([]);
      setShowDbResults(false);
      return;
    }

    setShowDbResults(true);
    setIsDbSearching(true);

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const apiSport = SPORT_TO_API[selectedSport] || undefined;
        const response = await searchPlacesByName(text.trim(), apiSport, 10);
        setDbSearchResults(response.results);
      } catch {
        setDbSearchResults([]);
      } finally {
        setIsDbSearching(false);
      }
    }, 300);
  }, [selectedSport]);

  function handleSelectDbPlace(place: SavedPlace) {
    setSelectedPlace({
      id: String(place.id),
      name: place.name,
      lat: place.lat,
      lon: place.lon,
      sport: place.sport,
      distance_miles: 0,
      tags: place.tags || {},
      isSaved: true,
      address: place.address,
    });
    setLocationQuery("");
    setDbSearchResults([]);
    setShowDbResults(false);
  }

  function convertSavedPlaceToResult(place: SavedPlaceWithDistance): SearchResultPlace {
    return {
      id: `saved-${place.id}`,
      name: place.name,
      lat: place.lat,
      lon: place.lon,
      sport: place.sport,
      distance_miles: place.distance_miles,
      tags: place.tags || {},
      isSaved: true,
      address: place.address,
    };
  }

  function convertOsmPlaceToResult(place: Place): SearchResultPlace {
    return {
      id: `osm-${place.osm_id}`,
      name: place.name,
      lat: place.lat,
      lon: place.lon,
      sport: place.sport,
      distance_miles: place.distance_miles,
      tags: place.tags || {},
      isSaved: false,
    };
  }

  async function searchNearby(lat: number, lon: number) {
    const apiSport = SPORT_TO_API[selectedSport] || "general";
    const combinedResults: SearchResultPlace[] = [];

    try {
      const savedPlaces = await searchSavedPlacesNearby(lat, lon, apiSport, 10000);
      combinedResults.push(...savedPlaces.results.map(convertSavedPlaceToResult));
    } catch {
      // Saved-place search is optional; OSM results can still populate the list.
    }

    try {
      const osmPlaces = await searchPlaces(lat, lon, apiSport as Sport, 5000);
      const osmResults = osmPlaces.results
        .filter((place) => !combinedResults.some((result) =>
          Math.abs(result.lat - place.lat) < 0.0001 && Math.abs(result.lon - place.lon) < 0.0001
        ))
        .map(convertOsmPlaceToResult);
      combinedResults.push(...osmResults);
    } catch {
      // OSM search can fail independently of saved places.
    }

    combinedResults.sort((a, b) => a.distance_miles - b.distance_miles);
    return combinedResults.slice(0, 15);
  }

  async function handleSearch() {
    if (!locationQuery.trim()) return;

    Keyboard.dismiss();
    setIsSearching(true);
    setShowResults(true);

    try {
      const geo = await geocodeLocation(locationQuery.trim());
      const results = await searchNearby(geo.lat, geo.lon);
      setSearchResults(results);
      if (results.length === 0) {
        Alert.alert("No Places Found", "Try a different location or search term.");
      }
    } catch {
      Alert.alert("Search Failed", "Could not find places. Try again.");
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }

  async function handleUseMyLocation() {
    setIsGettingLocation(true);
    setShowResults(true);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Location Permission Required",
          "Please enable location access to find places near you."
        );
        return;
      }

      const position = await Location.getCurrentPositionAsync({});
      const results = await searchNearby(position.coords.latitude, position.coords.longitude);
      setLocationQuery("Current Location");
      setSearchResults(results);
      if (results.length === 0) {
        Alert.alert("No Places Found", "No sports facilities found near your location.");
      }
    } catch {
      Alert.alert("Location Error", "Could not get your location. Try searching manually.");
      setSearchResults([]);
    } finally {
      setIsGettingLocation(false);
    }
  }

  function handleSelectPlace(place: SearchResultPlace) {
    setSelectedPlace(place);
    setLocationQuery("");
    setShowResults(false);
    setSearchResults([]);
    setDbSearchResults([]);
    setShowDbResults(false);
  }

  function handleOpenMapPicker() {
    if (Platform.OS === "web") {
      Alert.alert(
        "Map Picker Unavailable",
        "Choosing a location on the map is available in the iOS and Android apps. Search for a place or use your current location instead."
      );
      return;
    }

    // On Android/iOS, the Google Maps API key is embedded in the native manifest
    // (AndroidManifest.xml / Info.plist) at build time, so we can proceed directly
    navigation.navigate("PickMapLocation", {
      sport: selectedSport,
      returnTo: "CreateTournamentGames",
      tournamentId,
    });
  }

  function handleClearSelection() {
    setSelectedPlace(null);
    setCustomPlaceName("");
    setLocationQuery("");
    setDbSearchResults([]);
    setShowDbResults(false);
    setSearchResults([]);
    setShowResults(false);
  }

  async function handleSaveCustomName() {
    if (!customPlaceName.trim()) {
      Alert.alert("Name Required", "Please enter a name for this place.");
      return;
    }
    if (!selectedPlace) return;

    setIsSavingPlace(true);
    try {
      const savedPlace = await createPlace({
        name: customPlaceName.trim().slice(0, 255),
        lat: selectedPlace.lat,
        lon: selectedPlace.lon,
        sport: selectedPlace.sport || selectedSport,
        tags: selectedPlace.tags,
      });
      setSelectedPlace({
        ...selectedPlace,
        name: savedPlace.name,
      });
      setCustomPlaceName("");
      Alert.alert("Place Saved", `"${savedPlace.name}" has been saved for future use!`);
    } catch {
      Alert.alert("Error", "Could not save the place. You can still create the games.");
    } finally {
      setIsSavingPlace(false);
    }
  }

  function handleDateChange(event: DateTimePickerEvent, selectedDate?: Date) {
    setShowDatePicker(false);
    if (event.type === "set" && selectedDate) {
      const next = new Date(date);
      next.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
      setDate(next);
    }
  }

  function handleTimeChange(event: DateTimePickerEvent, selectedTime?: Date) {
    setShowTimePicker(false);
    if (event.type === "set" && selectedTime) {
      const next = new Date(date);
      next.setHours(selectedTime.getHours(), selectedTime.getMinutes(), 0, 0);
      setDate(next);
    }
  }

  function setSlotTeam(slotIndex: number, position: 1 | 2, teamId: string | null) {
    setSlots((current) =>
      current.map((slot, index) => {
        if (index !== slotIndex) return slot;
        return position === 1 ? { ...slot, team1Id: teamId } : { ...slot, team2Id: teamId };
      })
    );
  }

  function handlePickTeam(teamId: string) {
    if (!picker) return;
    setSlotTeam(picker.slotIndex, picker.position, teamId);
    setPicker(null);
  }

  const availablePickerTeams = useMemo(() => {
    if (!tournament || !picker) return [];
    const used = usedTeamIds(slots, picker);
    return tournament.teams.filter((team) => !used.has(team.id));
  }, [tournament, picker, slots]);

  async function handleCreateGames() {
    if (!tournament) return;

    const pairings: { team1: TournamentTeam; team2: TournamentTeam }[] = [];
    for (const [index, slot] of slots.entries()) {
      const team1 = teamById(tournament.teams, slot.team1Id);
      const team2 = teamById(tournament.teams, slot.team2Id);
      if (!team1 || !team2) {
        Alert.alert("Teams Required", `Pick both teams for Game ${index + 1}.`);
        return;
      }
      if (team1.id === team2.id) {
        Alert.alert("Invalid Matchup", `Game ${index + 1} needs two different teams.`);
        return;
      }
      pairings.push({ team1, team2 });
    }

    if (pairings.length === 0) {
      Alert.alert("No Games", "Register at least 2 teams before creating games.");
      return;
    }

    if (!selectedPlace && !locationQuery.trim()) {
      Alert.alert("Location Required", "Please search and select a location for your games.");
      return;
    }
    if (isUnnamedPlace && !customPlaceName.trim()) {
      Alert.alert("Name Required", "Please give this place a name before creating the games.");
      return;
    }

    const locationName = (
      isUnnamedPlace ? customPlaceName.trim() : (selectedPlace?.name || locationQuery.trim())
    ).slice(0, MAX_LOCATION_LENGTH);

    if (!locationName) {
      Alert.alert("Location Required", "Please search and select a location for your games.");
      return;
    }
    if (date <= new Date()) {
      Alert.alert("Invalid Date/Time", "Please choose a future date and time.");
      return;
    }

    setCreating(true);
    try {
      if (isUnnamedPlace && selectedPlace) {
        await createPlace({
          name: customPlaceName.trim().slice(0, 255),
          lat: selectedPlace.lat,
          lon: selectedPlace.lon,
          sport: selectedPlace.sport || selectedSport,
          tags: selectedPlace.tags,
        });
      }

      const updated = tournament.status === "REGISTRATION"
        ? await generateBracket(tournamentId)
        : tournament;

      const firstRound = updated.current_round;
      const firstRoundMatches = updated.matches
        .filter((match) => !firstRound || match.round_name === firstRound)
        .sort((a, b) => a.match_number - b.match_number);

      for (const [index, pairing] of pairings.entries()) {
        const match = firstRoundMatches[index];
        if (match) {
          await setMatchTeams(tournamentId, match.id, pairing.team1.id, pairing.team2.id);
        }
      }

      const used = new Set(pairings.flatMap((pairing) => [pairing.team1.id, pairing.team2.id]));
      const leftoverByes = updated.teams.filter((team) => !used.has(team.id));
      for (const [index, byeTeam] of leftoverByes.entries()) {
        const match = firstRoundMatches[pairings.length + index];
        if (match) {
          await setMatchTeams(tournamentId, match.id, byeTeam.id);
        }
      }

      const roundLabel = firstRound ? (ROUND_LABELS[firstRound] || firstRound) : "First round";
      const sport = toApiSport(updated.sport);
      let createdCount = 0;

      for (const [index, pairing] of pairings.entries()) {
        await createGame({
          sport,
          location: locationName,
          game_date: date.toISOString(),
          players_needed: 10,
          skill_level: "INTERMEDIATE",
          privacy: "PUBLIC",
          description: `${updated.name} · ${roundLabel} · Game ${index + 1}`,
          team_id: pairing.team1.id,
          opponent_team_id: pairing.team2.id,
        });
        createdCount += 1;
      }

      Alert.alert(
        "Games Created",
        `Created ${createdCount} game${createdCount === 1 ? "" : "s"} at ${locationName}. They will appear on the Games page.`,
        [{ text: "OK", onPress: () => navigation.goBack() }]
      );
    } catch (err) {
      Alert.alert("Error", getApiErrorMessage(err, "Failed to create tournament games."));
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color={colors.headerText} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>CREATE GAMES</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </View>
    );
  }

  if (!tournament) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color={colors.headerText} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>CREATE GAMES</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.centered}>
          <Text style={styles.emptyText}>Tournament not found</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={colors.headerText} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>CREATE GAMES</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.summaryText}>
          {slots.length} game{slots.length === 1 ? "" : "s"} from {tournament.team_count} teams
          {tournament.team_count % 2 === 1 ? " · 1 bye" : ""}
        </Text>

        <Text style={styles.sectionLabel}>MATCHUPS</Text>
        {slots.map((slot, index) => {
          const team1 = teamById(tournament.teams, slot.team1Id);
          const team2 = teamById(tournament.teams, slot.team2Id);
          return (
            <View key={`game-${index}`} style={styles.gameCard}>
              <Text style={styles.gameCardTitle}>GAME {index + 1}</Text>
              <View style={styles.matchupRow}>
                <TeamPickButton
                  styles={styles}
                  label={team1?.name ?? "Pick team"}
                  selected={Boolean(team1)}
                  onPress={() => setPicker({ slotIndex: index, position: 1 })}
                  onClear={team1 ? () => setSlotTeam(index, 1, null) : undefined}
                />
                <Text style={styles.vsText}>VS</Text>
                <TeamPickButton
                  styles={styles}
                  label={team2?.name ?? "Pick team"}
                  selected={Boolean(team2)}
                  onPress={() => setPicker({ slotIndex: index, position: 2 })}
                  onClear={team2 ? () => setSlotTeam(index, 2, null) : undefined}
                />
              </View>
            </View>
          );
        })}
        {byeTeams.length > 0 && (
          <Text style={styles.byeText}>
            Bye: {byeTeams.map((team) => team.name).join(", ")}
          </Text>
        )}

        <Text style={styles.sectionLabel}>LOCATION</Text>
        <View style={styles.searchContainer}>
          {selectedPlace ? (
            <View>
              <View style={styles.selectedPlaceContainer}>
                <View style={styles.selectedPlaceInfo}>
                  <Text style={styles.selectedPlaceName}>
                    {isUnnamedPlace ? "📍 Unnamed Place" : selectedPlace.name}
                  </Text>
                  <Text style={styles.selectedPlaceDistance}>
                    {selectedPlace.distance_miles > 0
                      ? `${selectedPlace.distance_miles} mi away`
                      : selectedPlace.address || "Saved map location"}
                  </Text>
                </View>
                <TouchableOpacity style={styles.clearButton} onPress={handleClearSelection}>
                  <Text style={styles.clearButtonText}>✕</Text>
                </TouchableOpacity>
              </View>

              {isUnnamedPlace && (
                <View style={styles.nameInputContainer}>
                  <Text style={styles.nameInputLabel}>
                    This place doesn't have a name. Please give it one:
                  </Text>
                  <View style={styles.nameInputRow}>
                    <TextInput
                      style={styles.nameInput}
                      placeholder="Enter place name..."
                      placeholderTextColor={colors.placeholder}
                      value={customPlaceName}
                      onChangeText={(text) => setCustomPlaceName(text.slice(0, 255))}
                      maxLength={255}
                    />
                    <TouchableOpacity
                      style={[
                        styles.saveNameButton,
                        (!customPlaceName.trim() || isSavingPlace) && styles.saveNameButtonDisabled,
                      ]}
                      onPress={handleSaveCustomName}
                      disabled={!customPlaceName.trim() || isSavingPlace}
                    >
                      {isSavingPlace ? (
                        <ActivityIndicator size="small" color={colors.textInverse} />
                      ) : (
                        <Text style={styles.saveNameButtonText}>Save</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          ) : (
            <>
              <TouchableOpacity
                style={styles.useLocationButton}
                onPress={handleUseMyLocation}
                disabled={isGettingLocation || isSearching}
              >
                {isGettingLocation ? (
                  <ActivityIndicator size="small" color={colors.textInverse} />
                ) : (
                  <>
                    <Text style={styles.useLocationIcon}>📍</Text>
                    <Text style={styles.useLocationText}>Use My Current Location</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.mapPickerButton}
                onPress={handleOpenMapPicker}
                disabled={isGettingLocation || isSearching}
                accessibilityRole="button"
                accessibilityLabel="Choose location on map"
              >
                <Text style={styles.useLocationIcon}>🗺️</Text>
                <Text style={styles.mapPickerButtonText}>Choose on Map</Text>
              </TouchableOpacity>

              <View style={styles.orDivider}>
                <View style={styles.orLine} />
                <Text style={styles.orText}>OR</Text>
                <View style={styles.orLine} />
              </View>

              <View style={styles.searchInputWrapper}>
                <View style={styles.searchInputContainer}>
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search fields & parks..."
                    placeholderTextColor={colors.placeholder}
                    value={locationQuery}
                    onChangeText={handleLocationQueryChange}
                    onSubmitEditing={handleSearch}
                    returnKeyType="search"
                    maxLength={MAX_LOCATION_LENGTH}
                  />
                  <TouchableOpacity
                    style={styles.searchButton}
                    onPress={handleSearch}
                    disabled={isSearching || isGettingLocation}
                  >
                    {isSearching ? (
                      <ActivityIndicator size="small" color={colors.textInverse} />
                    ) : (
                      <Text style={styles.searchButtonText}>🔍</Text>
                    )}
                  </TouchableOpacity>
                </View>

                {showDbResults && (
                  <View style={styles.floatingDropdown}>
                    <SavedPlaceDropdown
                      styles={styles}
                      accentColor={colors.accent}
                      isSearching={isDbSearching}
                      results={dbSearchResults}
                      query={locationQuery}
                      onSelect={handleSelectDbPlace}
                    />
                  </View>
                )}
              </View>
            </>
          )}

          {showResults && searchResults.length > 0 && (
            <View style={styles.resultsContainer}>
              {searchResults.map((place, index) => (
                <TouchableOpacity
                  key={`${place.id}-${index}`}
                  style={styles.resultItem}
                  onPress={() => handleSelectPlace(place)}
                >
                  <View style={[styles.resultIcon, place.isSaved && styles.resultIconSaved]}>
                    <Text style={styles.resultIconText}>{place.isSaved ? "⭐" : "📍"}</Text>
                  </View>
                  <View style={styles.resultInfo}>
                    <View style={styles.resultNameRow}>
                      <Text style={styles.resultName} numberOfLines={1}>
                        {place.name}
                      </Text>
                      {place.isSaved && (
                        <View style={styles.savedBadge}>
                          <Text style={styles.savedBadgeText}>SAVED</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.resultDistance}>
                      {place.distance_miles} mi · {place.sport || "Sports facility"}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {showResults && !isSearching && searchResults.length === 0 && locationQuery.trim() ? (
            <View style={styles.noResultsContainer}>
              <Text style={styles.noResultsText}>No places found. Try another search.</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.dateTimeRow}>
          <View style={styles.dateTimeCol}>
            <Text style={styles.sectionLabel}>DATE</Text>
            <TouchableOpacity style={styles.dateTimeInput} onPress={() => setShowDatePicker(true)}>
              <Text style={styles.dateTimeText}>{formatDate(date)}</Text>
              <Text style={styles.dateTimeIcon}>📅</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.dateTimeCol}>
            <Text style={styles.sectionLabel}>TIME</Text>
            <TouchableOpacity style={styles.dateTimeInput} onPress={() => setShowTimePicker(true)}>
              <Text style={styles.dateTimeText}>{formatTime(date)}</Text>
              <Text style={styles.dateTimeIcon}>🕐</Text>
            </TouchableOpacity>
          </View>
        </View>

        {showDatePicker && (
          <DateTimePicker
            value={date}
            mode="date"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            onChange={handleDateChange}
            minimumDate={new Date()}
            themeVariant={isDark ? "dark" : "light"}
          />
        )}
        {showTimePicker && (
          <DateTimePicker
            value={date}
            mode="time"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            onChange={handleTimeChange}
            minuteInterval={15}
            themeVariant={isDark ? "dark" : "light"}
          />
        )}

        <TouchableOpacity
          style={[styles.createButton, creating && styles.createButtonDisabled]}
          onPress={handleCreateGames}
          disabled={creating}
        >
          {creating ? (
            <ActivityIndicator color={colors.textInverse} />
          ) : (
            <Text style={styles.createButtonText}>CREATE GAMES</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      <Modal
        visible={picker !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setPicker(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {picker ? `Game ${picker.slotIndex + 1} · Team ${picker.position}` : "Select Team"}
              </Text>
              <TouchableOpacity onPress={() => setPicker(null)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {availablePickerTeams.length === 0 ? (
                <Text style={styles.emptyText}>No remaining teams to pick</Text>
              ) : (
                availablePickerTeams.map((team) => (
                  <TouchableOpacity
                    key={team.id}
                    style={styles.modalTeamItem}
                    onPress={() => handlePickTeam(team.id)}
                  >
                    <Text style={styles.modalTeamName}>{team.name}</Text>
                    <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function SavedPlaceDropdown({
  styles,
  accentColor,
  isSearching,
  results,
  query,
  onSelect,
}: Readonly<{
  styles: ReturnType<typeof createStyles>;
  accentColor: string;
  isSearching: boolean;
  results: SavedPlace[];
  query: string;
  onSelect: (place: SavedPlace) => void;
}>) {
  if (isSearching) {
    return (
      <View style={styles.dropdownLoading}>
        <ActivityIndicator size="small" color={accentColor} />
        <Text style={styles.dropdownLoadingText}>Searching...</Text>
      </View>
    );
  }

  if (results.length > 0) {
    return (
      <>
        {results.map((place) => (
          <TouchableOpacity
            key={place.id}
            style={styles.dropdownItem}
            onPress={() => onSelect(place)}
          >
            <View style={styles.dropdownItemIcon}>
              <Text>⭐</Text>
            </View>
            <View style={styles.dropdownItemInfo}>
              <Text style={styles.dropdownItemName} numberOfLines={1}>
                {place.name}
              </Text>
              <Text style={styles.dropdownItemSport}>
                {place.sport || "Sports facility"}
              </Text>
            </View>
            <View style={styles.dropdownAddButton}>
              <Text style={styles.dropdownAddText}>Add</Text>
            </View>
          </TouchableOpacity>
        ))}
      </>
    );
  }

  if (query.trim().length >= 2) {
    return (
      <View style={styles.dropdownEmpty}>
        <Text style={styles.dropdownEmptyText}>No saved places found</Text>
        <Text style={styles.dropdownHint}>Press 🔍 to search nearby locations</Text>
      </View>
    );
  }

  return null;
}

function TeamPickButton({
  styles,
  label,
  selected,
  onPress,
  onClear,
}: Readonly<{
  styles: ReturnType<typeof createStyles>;
  label: string;
  selected: boolean;
  onPress: () => void;
  onClear?: () => void;
}>) {
  return (
    <View style={styles.teamPickWrap}>
      <TouchableOpacity
        style={[styles.teamPickButton, selected && styles.teamPickButtonSelected]}
        onPress={onPress}
      >
        <Text
          style={[styles.teamPickText, selected && styles.teamPickTextSelected]}
          numberOfLines={2}
        >
          {label}
        </Text>
      </TouchableOpacity>
      {onClear ? (
        <TouchableOpacity style={styles.teamClear} onPress={onClear} accessibilityLabel="Clear team">
          <Text style={styles.teamClearText}>✕</Text>
        </TouchableOpacity>
      ) : null}
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
    centered: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: 20,
    },
    summaryText: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.text,
      marginBottom: 4,
    },
    sectionLabel: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.textMuted,
      letterSpacing: 1,
      marginBottom: 12,
      marginTop: 20,
    },
    gameCard: {
      backgroundColor: colors.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      marginBottom: 10,
    },
    gameCardTitle: {
      fontSize: 11,
      fontWeight: "800",
      color: colors.accent,
      letterSpacing: 1,
      marginBottom: 10,
    },
    matchupRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    vsText: {
      fontSize: 12,
      fontWeight: "800",
      color: colors.textMuted,
    },
    teamPickWrap: {
      flex: 1,
      position: "relative",
    },
    teamPickButton: {
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      borderRadius: 12,
      paddingVertical: 14,
      paddingHorizontal: 10,
      minHeight: 56,
      justifyContent: "center",
    },
    teamPickButtonSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primaryLight,
    },
    teamPickText: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.textMuted,
      textAlign: "center",
    },
    teamPickTextSelected: {
      color: colors.text,
    },
    teamClear: {
      position: "absolute",
      top: 4,
      right: 4,
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: colors.card,
      alignItems: "center",
      justifyContent: "center",
    },
    teamClearText: {
      fontSize: 11,
      color: colors.textMuted,
      fontWeight: "700",
    },
    byeText: {
      fontSize: 13,
      color: colors.textMuted,
      fontStyle: "italic",
      marginTop: 4,
    },
    searchContainer: {
      position: "relative",
      zIndex: 10,
    },
    useLocationButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primary,
      borderRadius: 12,
      padding: 16,
      borderWidth: 2,
      borderColor: colors.accent,
    },
    useLocationIcon: {
      fontSize: 18,
      marginRight: 8,
    },
    useLocationText: {
      color: colors.textInverse,
      fontSize: 14,
      fontWeight: "700",
    },
    mapPickerButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
      borderWidth: 2,
      borderColor: colors.primary,
      marginTop: 10,
    },
    mapPickerButtonText: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: "700",
    },
    orDivider: {
      flexDirection: "row",
      alignItems: "center",
      marginVertical: 16,
    },
    orLine: {
      flex: 1,
      height: 1,
      backgroundColor: colors.inputBorder,
    },
    orText: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: "600",
      marginHorizontal: 12,
      letterSpacing: 1,
    },
    searchInputWrapper: {
      position: "relative",
      zIndex: 10,
    },
    searchInputContainer: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      borderRadius: 12,
      overflow: "hidden",
    },
    floatingDropdown: {
      position: "absolute",
      top: "100%",
      left: 0,
      right: 0,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      borderRadius: 12,
      marginTop: 4,
      maxHeight: 250,
      overflow: "hidden",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 8,
      elevation: 8,
    },
    dropdownLoading: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      padding: 16,
      gap: 8,
    },
    dropdownLoadingText: {
      color: colors.textMuted,
      fontSize: 14,
    },
    dropdownItem: {
      flexDirection: "row",
      alignItems: "center",
      padding: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.inputBorder,
    },
    dropdownItemIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.primary,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 12,
    },
    dropdownItemInfo: {
      flex: 1,
    },
    dropdownItemName: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "600",
    },
    dropdownItemSport: {
      color: colors.textMuted,
      fontSize: 12,
      marginTop: 2,
    },
    dropdownAddButton: {
      backgroundColor: colors.accent,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 6,
    },
    dropdownAddText: {
      color: colors.textInverse,
      fontSize: 12,
      fontWeight: "700",
    },
    dropdownEmpty: {
      padding: 16,
      alignItems: "center",
    },
    dropdownEmptyText: {
      color: colors.textMuted,
      fontSize: 14,
    },
    dropdownHint: {
      color: colors.textMuted,
      fontSize: 12,
      marginTop: 4,
    },
    searchInput: {
      flex: 1,
      padding: 16,
      fontSize: 15,
      color: colors.inputText,
    },
    searchButton: {
      padding: 16,
      backgroundColor: colors.primary,
    },
    searchButtonText: {
      fontSize: 18,
    },
    selectedPlaceContainer: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.primary,
      borderRadius: 12,
      padding: 16,
    },
    selectedPlaceInfo: {
      flex: 1,
    },
    selectedPlaceName: {
      fontSize: 15,
      fontWeight: "600",
      color: colors.textInverse,
    },
    selectedPlaceDistance: {
      fontSize: 12,
      color: "rgba(255,255,255,0.7)",
      marginTop: 2,
    },
    clearButton: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: "rgba(255,255,255,0.2)",
      justifyContent: "center",
      alignItems: "center",
    },
    clearButtonText: {
      color: colors.textInverse,
      fontSize: 14,
      fontWeight: "600",
    },
    nameInputContainer: {
      marginTop: 12,
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.accent,
    },
    nameInputLabel: {
      fontSize: 13,
      color: colors.accent,
      marginBottom: 12,
      fontWeight: "500",
    },
    nameInputRow: {
      flexDirection: "row",
      gap: 10,
    },
    nameInput: {
      flex: 1,
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      borderRadius: 8,
      padding: 12,
      fontSize: 15,
      color: colors.inputText,
    },
    saveNameButton: {
      backgroundColor: colors.accent,
      paddingHorizontal: 20,
      borderRadius: 8,
      justifyContent: "center",
      alignItems: "center",
    },
    saveNameButtonDisabled: {
      opacity: 0.5,
    },
    saveNameButtonText: {
      color: colors.textInverse,
      fontSize: 14,
      fontWeight: "700",
    },
    resultsContainer: {
      backgroundColor: colors.card,
      borderRadius: 12,
      marginTop: 8,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      maxHeight: 250,
    },
    resultItem: {
      flexDirection: "row",
      alignItems: "center",
      padding: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.inputBorder,
    },
    resultIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.inputBorder,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 12,
    },
    resultIconText: {
      fontSize: 16,
    },
    resultIconSaved: {
      backgroundColor: colors.primary,
    },
    resultInfo: {
      flex: 1,
    },
    resultNameRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    resultName: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.text,
      flex: 1,
    },
    savedBadge: {
      backgroundColor: colors.primary,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    savedBadgeText: {
      fontSize: 9,
      fontWeight: "700",
      color: colors.textInverse,
      letterSpacing: 0.5,
    },
    resultDistance: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 2,
    },
    noResultsContainer: {
      backgroundColor: colors.card,
      borderRadius: 12,
      marginTop: 8,
      padding: 20,
      alignItems: "center",
    },
    noResultsText: {
      color: colors.textMuted,
      fontSize: 14,
    },
    dateTimeRow: {
      flexDirection: "row",
      gap: 12,
    },
    dateTimeCol: {
      flex: 1,
    },
    dateTimeInput: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      borderRadius: 12,
      padding: 16,
    },
    dateTimeText: {
      fontSize: 15,
      color: colors.inputText,
      fontWeight: "500",
    },
    dateTimeIcon: {
      fontSize: 18,
    },
    createButton: {
      backgroundColor: colors.accent,
      paddingVertical: 18,
      borderRadius: 12,
      alignItems: "center",
      marginTop: 30,
    },
    createButtonDisabled: {
      opacity: 0.6,
    },
    createButtonText: {
      fontSize: 16,
      fontWeight: "800",
      color: colors.textInverse,
      letterSpacing: 1.5,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "flex-end",
    },
    modalContent: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: 20,
      paddingTop: 16,
      maxHeight: "70%",
    },
    modalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.text,
    },
    modalTeamItem: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    modalTeamName: {
      fontSize: 16,
      color: colors.text,
      fontWeight: "600",
    },
    emptyText: {
      color: colors.textMuted,
      fontSize: 14,
      textAlign: "center",
      paddingVertical: 20,
    },
  });
}
