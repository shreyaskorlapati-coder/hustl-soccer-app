import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as Location from "expo-location";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Slider from "@react-native-community/slider";

import {
  createGame,
  createPlace,
  geocodeLocation,
  getApiErrorMessage,
  getMyCreatedTeams,
  listTeams,
  SavedPlace,
  SavedPlaceWithDistance,
  searchPlaces,
  searchPlacesByName,
  searchSavedPlacesNearby,
  Team,
} from "../api/client";
import { useTheme, ThemeColors } from "../theme";
import { GameSport, Place, PrivacyType, RootStackParamList, SkillLevel } from "../types";

interface SearchResultPlace {
  id: string;
  name: string;
  lat: number;
  lon: number;
  sport: string | null;
  distance_miles: number;
  tags: Record<string, string>;
  isSaved: boolean;
  address?: string | null;
}

type Props = NativeStackScreenProps<RootStackParamList, "CreateGame">;

const SPORTS = [
  { id: "soccer", label: "SOCCER", icon: "⚽" },
  { id: "basketball", label: "BASKETBALL", icon: "🏀" },
  { id: "football", label: "FOOTBALL", icon: "🏈" },
  { id: "baseball", label: "BASEBALL", icon: "⚾" },
  { id: "volleyball", label: "VOLLEYBALL", icon: "🏐" },
  { id: "other", label: "OTHER", icon: "🎯" },
];

const SKILL_LEVELS = ["BEGINNER", "CASUAL", "INTERMEDIATE", "ADVANCED", "ELITE"];
const PRIVACY_OPTIONS = ["PUBLIC", "FRIENDS ONLY", "PRIVATE"];

const SPORT_TO_API: Record<string, string> = {
  soccer: "soccer",
  basketball: "basketball",
  football: "general",
  baseball: "baseball",
  volleyball: "volleyball",
  other: "general",
};

export default function CreateGameScreen({ navigation, route }: Props) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [selectedSport, setSelectedSport] = useState<GameSport>("soccer");
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
  const [date, setDate] = useState(() => {
    const now = new Date();
    now.setHours(now.getHours() + 1, 0, 0, 0);
    return now;
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [playersNeeded, setPlayersNeeded] = useState(10);
  const [skillLevel, setSkillLevel] = useState<SkillLevel>("INTERMEDIATE");
  const [privacy, setPrivacy] = useState<PrivacyType>("PUBLIC");
  const [isLoading, setIsLoading] = useState(false);
  const [isSavingPlace, setIsSavingPlace] = useState(false);
  const [myTeams, setMyTeams] = useState<Team[]>([]);
  const [allTeams, setAllTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [selectedOpponentTeamId, setSelectedOpponentTeamId] = useState<string | null>(null);
  const [loadingTeams, setLoadingTeams] = useState(true);

  const isUnnamedPlace = selectedPlace && !selectedPlace.isSaved && 
    (selectedPlace.name === "Unnamed Facility" || selectedPlace.name === "Unnamed");

  const isSoccer = selectedSport === "soccer";

  const handleLocationQueryChange = useCallback((text: string) => {
    setLocationQuery(text);
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
      } catch (error) {
        console.error("Database search error:", error);
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

  useEffect(() => {
    async function fetchTeams() {
      try {
        const [myTeamsRes, allTeamsRes] = await Promise.all([
          getMyCreatedTeams({ limit: 50 }),
          listTeams({ limit: 100 }),
        ]);
        setMyTeams(myTeamsRes.results);
        setAllTeams(allTeamsRes.results);
      } catch (error) {
        console.error("Failed to fetch teams:", error);
      } finally {
        setLoadingTeams(false);
      }
    }
    fetchTeams();
  }, []);

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

  function formatDate(d: Date): string {
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const year = d.getFullYear();
    return `${month}/${day}/${year}`;
  }

  function formatTime(d: Date): string {
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${String(hours).padStart(2, "0")}:${minutes} ${ampm}`;
  }

  function handleDateChange(event: DateTimePickerEvent, selectedDate?: Date) {
    setShowDatePicker(false);
    if (event.type === "set" && selectedDate) {
      const newDate = new Date(date);
      newDate.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
      if (newDate < new Date()) {
        newDate.setHours(new Date().getHours() + 1, 0, 0, 0);
      }
      setDate(newDate);
    }
  }

  function handleTimeChange(event: DateTimePickerEvent, selectedTime?: Date) {
    setShowTimePicker(false);
    if (event.type === "set" && selectedTime) {
      const newDate = new Date(date);
      newDate.setHours(selectedTime.getHours(), selectedTime.getMinutes(), 0, 0);
      const now = new Date();
      if (newDate < now) {
        Alert.alert("Invalid Time", "Please select a future time.");
        return;
      }
      setDate(newDate);
    }
  }

  function getMinimumDate(): Date {
    return new Date();
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

  async function handleSearch() {
    if (!locationQuery.trim()) {
      return;
    }

    Keyboard.dismiss();
    setIsSearching(true);
    setShowResults(true);

    try {
      const geo = await geocodeLocation(locationQuery.trim());
      const apiSport = SPORT_TO_API[selectedSport] || "general";
      const combinedResults: SearchResultPlace[] = [];

      try {
        const savedPlaces = await searchSavedPlacesNearby(geo.lat, geo.lon, apiSport, 10000);
        combinedResults.push(...savedPlaces.results.map(convertSavedPlaceToResult));
      } catch (err) {
        console.log("No saved places found or error:", err);
      }

      try {
        const osmPlaces = await searchPlaces(geo.lat, geo.lon, apiSport as never, 5000);
        const osmResults = osmPlaces.results
          .filter(p => !combinedResults.some(r => 
            Math.abs(r.lat - p.lat) < 0.0001 && Math.abs(r.lon - p.lon) < 0.0001
          ))
          .map(convertOsmPlaceToResult);
        combinedResults.push(...osmResults);
      } catch (err) {
        console.log("OSM search error:", err);
      }

      combinedResults.sort((a, b) => a.distance_miles - b.distance_miles);

      if (combinedResults.length > 0) {
        setSearchResults(combinedResults.slice(0, 15));
      } else {
        setSearchResults([]);
        Alert.alert("No Places Found", "Try a different location or search term.");
      }
    } catch (error) {
      console.error("Search error:", error);
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
        setIsGettingLocation(false);
        return;
      }

      const position = await Location.getCurrentPositionAsync({});
      const lat = position.coords.latitude;
      const lon = position.coords.longitude;
      const apiSport = SPORT_TO_API[selectedSport] || "general";
      const combinedResults: SearchResultPlace[] = [];

      try {
        const savedPlaces = await searchSavedPlacesNearby(lat, lon, apiSport, 10000);
        combinedResults.push(...savedPlaces.results.map(convertSavedPlaceToResult));
      } catch (err) {
        console.log("No saved places found or error:", err);
      }

      try {
        const osmPlaces = await searchPlaces(lat, lon, apiSport as never, 5000);
        const osmResults = osmPlaces.results
          .filter(p => !combinedResults.some(r => 
            Math.abs(r.lat - p.lat) < 0.0001 && Math.abs(r.lon - p.lon) < 0.0001
          ))
          .map(convertOsmPlaceToResult);
        combinedResults.push(...osmResults);
      } catch (err) {
        console.log("OSM search error:", err);
      }

      combinedResults.sort((a, b) => a.distance_miles - b.distance_miles);
      setLocationQuery("Current Location");

      if (combinedResults.length > 0) {
        setSearchResults(combinedResults.slice(0, 15));
      } else {
        setSearchResults([]);
        Alert.alert("No Places Found", "No sports facilities found near your location.");
      }
    } catch (error) {
      console.error("Location error:", error);
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
    navigation.navigate("PickMapLocation", { sport: selectedSport, returnTo: "CreateGame" });
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
        name: customPlaceName.trim(),
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
    } catch (error) {
      console.error("Failed to save place:", error);
      Alert.alert("Error", "Could not save the place. You can still create the game.");
    } finally {
      setIsSavingPlace(false);
    }
  }

  async function handleCreateGame() {
    if (date <= new Date()) {
      Alert.alert("Invalid Date/Time", "Please select a future date and time for your game.");
      return;
    }

    if (!selectedTeamId) {
      Alert.alert("Team Required", "Please select your team for the game.");
      return;
    }

    if (isSoccer && !selectedOpponentTeamId) {
      Alert.alert("Opponent Required", "Please select an opponent team for the soccer game.");
      return;
    }

    if (isSoccer && selectedTeamId === selectedOpponentTeamId) {
      Alert.alert("Invalid Selection", "Your team and opponent team must be different.");
      return;
    }

    if (!selectedPlace && !locationQuery.trim()) {
      Alert.alert("Location Required", "Please search and select a location for your game.");
      return;
    }

    if (isUnnamedPlace && !customPlaceName.trim()) {
      Alert.alert("Name Required", "Please give this place a name before creating the game.");
      return;
    }

    const locationName = isUnnamedPlace ? customPlaceName.trim() : (selectedPlace?.name || locationQuery.trim());

    setIsLoading(true);
    try {
      if (isUnnamedPlace && selectedPlace) {
        await createPlace({
          name: customPlaceName.trim(),
          lat: selectedPlace.lat,
          lon: selectedPlace.lon,
          sport: selectedPlace.sport || selectedSport,
          tags: selectedPlace.tags,
        });
      }

      await createGame({
        sport: selectedSport,
        location: locationName,
        game_date: date.toISOString(),
        players_needed: playersNeeded,
        skill_level: skillLevel,
        privacy: privacy,
        team_id: selectedTeamId,
        opponent_team_id: isSoccer ? selectedOpponentTeamId ?? undefined : undefined,
      });

      Alert.alert(
        "Game Created!",
        `Your ${selectedSport} game has been created at ${locationName}.\n\nDate: ${formatDate(date)} at ${formatTime(date)}\nPlayers needed: ${playersNeeded}`,
        [{ text: "OK", onPress: () => {
          navigation.navigate("Home", { screen: "Games" });
        }}]
      );
    } catch (error) {
      const message = getApiErrorMessage(error, "Failed to create game. Please try again.");
      Alert.alert("Error", message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>CREATE GAME</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.sectionLabel}>SPORT</Text>
        <View style={styles.sportsRow}>
          {SPORTS.map((sport) => {
            const isEnabled = sport.id === "soccer";
            return (
              <TouchableOpacity
                key={sport.id}
                style={[
                  styles.sportChip,
                  selectedSport === sport.id && styles.sportChipSelected,
                  !isEnabled && styles.sportChipDisabled,
                ]}
                onPress={() => isEnabled && setSelectedSport(sport.id as GameSport)}
                disabled={!isEnabled}
                activeOpacity={isEnabled ? 0.7 : 1}
              >
                <Text style={[styles.sportChipIcon, !isEnabled && styles.sportChipIconDisabled]}>
                  {sport.icon}
                </Text>
                <Text
                  style={[
                    styles.sportChipLabel,
                    selectedSport === sport.id && styles.sportChipLabelSelected,
                    !isEnabled && styles.sportChipLabelDisabled,
                  ]}
                >
                  {sport.label}
                </Text>
                {!isEnabled && <Text style={styles.comingSoonBadge}>SOON</Text>}
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.sectionLabel}>{isSoccer ? "YOUR TEAM" : "TEAM"}</Text>
        {loadingTeams ? (
          <ActivityIndicator size="small" color={colors.accent} style={{ marginVertical: 10 }} />
        ) : myTeams.length === 0 ? (
          <Text style={styles.noTeamsText}>You need to create a team first</Text>
        ) : (
          <View style={styles.teamsList}>
            {myTeams.map((team) => (
              <TouchableOpacity
                key={team.id}
                style={[
                  styles.teamChip,
                  selectedTeamId === team.id && styles.teamChipSelected,
                ]}
                onPress={() => setSelectedTeamId(team.id)}
              >
                <Text
                  style={[
                    styles.teamChipText,
                    selectedTeamId === team.id && styles.teamChipTextSelected,
                  ]}
                  numberOfLines={1}
                >
                  {team.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {isSoccer && (
          <>
            <Text style={styles.sectionLabel}>OPPONENT TEAM</Text>
            {loadingTeams ? (
              <ActivityIndicator size="small" color={colors.accent} style={{ marginVertical: 10 }} />
            ) : allTeams.length === 0 ? (
              <Text style={styles.noTeamsText}>No teams available</Text>
            ) : (
              <View style={styles.teamsList}>
                {allTeams
                  .filter((team) => team.id !== selectedTeamId)
                  .map((team) => (
                    <TouchableOpacity
                      key={team.id}
                      style={[
                        styles.teamChip,
                        selectedOpponentTeamId === team.id && styles.teamChipSelected,
                      ]}
                      onPress={() => setSelectedOpponentTeamId(team.id)}
                    >
                      <Text
                        style={[
                          styles.teamChipText,
                          selectedOpponentTeamId === team.id && styles.teamChipTextSelected,
                        ]}
                        numberOfLines={1}
                      >
                        {team.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
              </View>
            )}
          </>
        )}

        <View style={styles.progressBar}>
          <View style={styles.progressFill} />
        </View>

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
                      onChangeText={setCustomPlaceName}
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
                    {isDbSearching ? (
                      <View style={styles.dropdownLoading}>
                        <ActivityIndicator size="small" color={colors.accent} />
                        <Text style={styles.dropdownLoadingText}>Searching...</Text>
                      </View>
                    ) : dbSearchResults.length > 0 ? (
                      dbSearchResults.map((place) => (
                        <TouchableOpacity
                          key={place.id}
                          style={styles.dropdownItem}
                          onPress={() => handleSelectDbPlace(place)}
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
                      ))
                    ) : locationQuery.trim().length >= 2 ? (
                      <View style={styles.dropdownEmpty}>
                        <Text style={styles.dropdownEmptyText}>No saved places found</Text>
                        <Text style={styles.dropdownHint}>Press 🔍 to search nearby locations</Text>
                      </View>
                    ) : null}
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

          {showResults && !isSearching && searchResults.length === 0 && locationQuery.trim() && (
            <View style={styles.noResultsContainer}>
              <Text style={styles.noResultsText}>No places found. Try another search.</Text>
            </View>
          )}
        </View>

        <View style={styles.dateTimeRow}>
          <View style={styles.dateTimeCol}>
            <Text style={styles.sectionLabel}>DATE</Text>
            <TouchableOpacity 
              style={styles.dateTimeInput}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={styles.dateTimeText}>{formatDate(date)}</Text>
              <Text style={styles.dateTimeIcon}>📅</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.dateTimeCol}>
            <Text style={styles.sectionLabel}>TIME</Text>
            <TouchableOpacity 
              style={styles.dateTimeInput}
              onPress={() => setShowTimePicker(true)}
            >
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
            minimumDate={getMinimumDate()}
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

        <View style={styles.sliderSection}>
          <View style={styles.sliderHeader}>
            <Text style={styles.sectionLabel}>PLAYERS NEEDED</Text>
            <Text style={styles.sliderValue}>{playersNeeded}</Text>
          </View>
          <Slider
            style={styles.slider}
            minimumValue={2}
            maximumValue={30}
            step={1}
            value={playersNeeded}
            onValueChange={setPlayersNeeded}
            minimumTrackTintColor={colors.accent}
            maximumTrackTintColor={colors.inputBorder}
            thumbTintColor={colors.accent}
          />
        </View>

        <Text style={styles.sectionLabel}>SKILL LEVEL</Text>
        <View style={styles.optionsRow}>
          {SKILL_LEVELS.map((level) => (
            <TouchableOpacity
              key={level}
              style={[
                styles.optionChip,
                skillLevel === level && styles.optionChipSelected,
              ]}
              onPress={() => setSkillLevel(level as SkillLevel)}
            >
              <Text
                style={[
                  styles.optionChipText,
                  skillLevel === level && styles.optionChipTextSelected,
                ]}
              >
                {level}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionLabel}>PRIVACY</Text>
        <View style={styles.optionsRow}>
          {PRIVACY_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option}
              style={[
                styles.optionChip,
                privacy === option && styles.optionChipSelected,
              ]}
              onPress={() => setPrivacy(option as PrivacyType)}
            >
              <Text
                style={[
                  styles.optionChipText,
                  privacy === option && styles.optionChipTextSelected,
                ]}
              >
                {option}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.createButton, isLoading && styles.createButtonDisabled]}
          onPress={handleCreateGame}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color={colors.textInverse} />
          ) : (
            <Text style={styles.createButtonText}>CREATE GAME</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
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
    paddingTop: Platform.OS === "ios" ? 60 : 40,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: colors.primary,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  backArrow: {
    fontSize: 20,
    color: colors.textInverse,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.textInverse,
    letterSpacing: 2,
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textMuted,
    letterSpacing: 1,
    marginBottom: 12,
    marginTop: 20,
  },
  sportsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  sportChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.inputBorder,
  },
  sportChipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  sportChipIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  sportChipLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  sportChipLabelSelected: {
    color: colors.textInverse,
  },
  sportChipDisabled: {
    opacity: 0.4,
    borderColor: colors.inputBorder,
  },
  sportChipIconDisabled: {
    opacity: 0.5,
  },
  sportChipLabelDisabled: {
    color: colors.textMuted,
  },
  comingSoonBadge: {
    fontSize: 8,
    fontWeight: "700",
    color: colors.accent,
    marginLeft: 4,
    backgroundColor: "rgba(232, 106, 51, 0.2)",
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  progressBar: {
    height: 4,
    backgroundColor: colors.inputBorder,
    borderRadius: 2,
    marginTop: 20,
    overflow: "hidden",
  },
  progressFill: {
    width: "100%",
    height: "100%",
    backgroundColor: colors.primary,
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
  sliderSection: {
    marginTop: 20,
  },
  sliderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  sliderValue: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.accent,
  },
  slider: {
    width: "100%",
    height: 40,
  },
  optionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  optionChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.inputBorder,
  },
  optionChipSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  optionChipText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  optionChipTextSelected: {
    color: colors.textInverse,
  },
  noTeamsText: {
    fontSize: 13,
    color: colors.textMuted,
    fontStyle: "italic",
    marginVertical: 10,
  },
  teamsList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },
  teamChip: {
    backgroundColor: colors.inputBackground,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 4,
    maxWidth: 150,
  },
  teamChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  teamChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textMuted,
  },
  teamChipTextSelected: {
    color: colors.textInverse,
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
    letterSpacing: 2,
  },
  });
}
