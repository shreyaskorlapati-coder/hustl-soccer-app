import { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as Location from "expo-location";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { listGames } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useTheme, ThemeColors } from "../theme";
import { Game, RootStackParamList } from "../types";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

const FIELD_GREEN = "#2D5A3D";
const FIELD_LINE_GREEN = "#3D7A4D";


function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "GOOD MORNING,";
  if (hour < 17) return "GOOD AFTERNOON,";
  return "GOOD EVENING,";
}

function getSportIcon(sport: string): string {
  switch (sport) {
    case "soccer":
      return "⚽";
    case "basketball":
      return "🏀";
    case "volleyball":
      return "🏐";
    case "tennis":
      return "🎾";
    case "baseball":
      return "⚾";
    default:
      return "🏃";
  }
}

function getSkillColor(level: string, colors: ThemeColors): string {
  switch (level) {
    case "CASUAL":
      return colors.accent;
    case "ADVANCED":
      return colors.primary;
    default:
      return colors.border;
  }
}

function formatGameDate(dateString: string): { time: string; date: string } {
  const gameDate = new Date(dateString);
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  let hours = gameDate.getHours();
  const minutes = gameDate.getMinutes();
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12;
  const time = `${hours}:${String(minutes).padStart(2, "0")} ${ampm}`;

  let date: string;
  if (gameDate.toDateString() === now.toDateString()) {
    date = "TODAY";
  } else if (gameDate.toDateString() === tomorrow.toDateString()) {
    date = "TMR";
  } else {
    const month = gameDate.toLocaleString("default", { month: "short" }).toUpperCase();
    const day = gameDate.getDate();
    date = `${month} ${day}`;
  }

  return { time, date };
}

export default function HomeScreen({ navigation }: Props) {
  const { user, logout, isLoading: authLoading, isAuthenticated } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [loading, setLoading] = useState(false);
  const [games, setGames] = useState<Game[]>([]);
  const [gamesLoading, setGamesLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const firstName = user?.name?.split(" ")[0] ?? "Player";
  const lastInitial = user?.name?.split(" ")[1]?.[0] ?? "";
  const displayName = lastInitial ? `${firstName} ${lastInitial}.` : firstName;

  const fetchGames = useCallback(async () => {
    if (!isAuthenticated) {
      setGamesLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const response = await listGames({ upcoming_only: true, limit: 10 });
      setGames(response.results);
    } catch (error) {
      console.error("Failed to fetch games:", error);
    } finally {
      setGamesLoading(false);
      setRefreshing(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!authLoading) {
      fetchGames();
    }
  }, [fetchGames, authLoading]);

  function handleRefresh() {
    setRefreshing(true);
    fetchGames();
  }

  function handleLogout() {
    Alert.alert("Log Out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Log Out", style: "destructive", onPress: logout },
    ]);
  }

  async function handleFindSpace() {
    setLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Location permission needed",
          "Please enable location to find nearby spaces."
        );
        setLoading(false);
        return;
      }
      const position = await Location.getCurrentPositionAsync({});
      navigation.navigate("Results", {
        lat: position.coords.latitude,
        lon: position.coords.longitude,
        sport: "soccer",
        radius: 5000,
        locationLabel: "Current Location",
      });
    } catch {
      Alert.alert("Error", "Could not get your location.");
    } finally {
      setLoading(false);
    }
  }

  function handleCreateGame() {
    navigation.navigate("CreateGame");
  }

  function handleFullMap() {
    handleFindSpace();
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.accent}
          />
        }
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.profileButton} onPress={handleLogout}>
            <View style={styles.profileAvatar}>
              <Text style={styles.profileEmoji}>⚽</Text>
            </View>
            <View style={styles.profileBadge}>
              <Text style={styles.profileBadgeText}>2</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.greetingContainer}>
            <Text style={styles.greetingText}>{getGreeting()}</Text>
            <Text style={styles.userName}>{displayName.toUpperCase()}</Text>
          </View>

          <TouchableOpacity style={styles.notificationButton}>
            <Text style={styles.notificationIcon}>🔔</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.actionCards}>
          <TouchableOpacity style={styles.createGameCard} onPress={handleCreateGame}>
            <View style={styles.plusIcon}>
              <Text style={styles.plusText}>+</Text>
            </View>
            <Text style={styles.cardTitle}>CREATE GAME</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.findSpaceCard}
            onPress={handleFindSpace}
            disabled={loading}
          >
            <View style={styles.fieldPattern}>
              <View style={styles.fieldLine} />
              <View style={styles.fieldCenterCircle} />
              <View style={styles.fieldMarker}>
                <Text style={styles.markerText}>📍</Text>
              </View>
            </View>
            {loading ? (
              <ActivityIndicator color={colors.textInverse} />
            ) : (
              <Text style={styles.cardTitle}>FIND PLACE</Text>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.mapPreview} onPress={handleFullMap}>
          <View style={styles.mapContent}>
            <View style={styles.mapGrid}>
              <View style={styles.mapGridLine} />
              <View style={styles.mapGridLine} />
              <View style={styles.mapGridLineH} />
            </View>
            <View style={[styles.mapMarker, { top: 30, left: 60 }]}>
              <View style={styles.mapMarkerDot} />
            </View>
            <View style={[styles.mapMarker, { top: 50, left: 120 }]}>
              <View style={[styles.mapMarkerDot, { backgroundColor: colors.accent }]} />
            </View>
            <View style={[styles.mapMarker, { top: 70, right: 80 }]}>
              <View style={styles.mapMarkerDot} />
            </View>
          </View>
          <View style={styles.fullMapButton}>
            <Text style={styles.fullMapText}>FULL MAP →</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>NEARBY GAMES</Text>
            <TouchableOpacity>
              <Text style={styles.seeAllText}>SEE ALL</Text>
            </TouchableOpacity>
          </View>

          {gamesLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={colors.accent} />
            </View>
          ) : games.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No upcoming games</Text>
              <Text style={styles.emptySubtext}>Create one to get started!</Text>
            </View>
          ) : (
            games.map((game) => {
              const { time, date } = formatGameDate(game.game_date);
              return (
                <TouchableOpacity key={game.id} style={styles.gameCard}>
                  <View style={styles.gameIconContainer}>
                    <Text style={styles.gameIcon}>{getSportIcon(game.sport)}</Text>
                  </View>

                  <View style={styles.gameInfo}>
                    <View style={styles.gameHeader}>
                      <Text style={styles.gameSport}>{game.sport.toUpperCase()}</Text>
                      <View
                        style={[
                          styles.skillBadge,
                          { backgroundColor: getSkillColor(game.skill_level, colors) },
                        ]}
                      >
                        <Text style={styles.skillText}>{game.skill_level}</Text>
                      </View>
                    </View>
                    <Text style={styles.gameLocation}>{game.location}</Text>
                    <View style={styles.progressContainer}>
                      <View style={styles.progressBar}>
                        <View
                          style={[
                            styles.progressFill,
                            {
                              width: `${(game.players_joined / game.players_needed) * 100}%`,
                            },
                          ]}
                        />
                      </View>
                      <Text style={styles.playerCount}>
                        {game.players_joined}/{game.players_needed}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.gameTime}>
                    <Text style={styles.timeText}>{time}</Text>
                    <Text style={styles.dateText}>{date}</Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>SQUAD ACTIVITY</Text>
            <TouchableOpacity>
              <Text style={styles.seeAllText}>VIEW ALL</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No recent activity</Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem}>
          <Text style={styles.navIcon}>🏠</Text>
          <Text style={[styles.navLabel, styles.navLabelActive]}>HOME</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem}>
          <Text style={styles.navIcon}>▶️</Text>
          <Text style={styles.navLabel}>PLAY</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem}>
          <Text style={styles.navIcon}>💬</Text>
          <Text style={styles.navLabel}>CHAT</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem}>
          <Text style={styles.navIcon}>👥</Text>
          <Text style={styles.navLabel}>SQUAD</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={handleLogout}>
          <Text style={styles.navIcon}>👤</Text>
          <Text style={styles.navLabel}>ME</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  profileButton: {
    position: "relative",
  },
  profileAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: colors.accent,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  profileEmoji: {
    fontSize: 20,
  },
  profileBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.background,
    justifyContent: "center",
    alignItems: "center",
  },
  profileBadgeText: {
    color: colors.textInverse,
    fontSize: 10,
    fontWeight: "700",
  },
  greetingContainer: {
    alignItems: "center",
  },
  greetingText: {
    fontSize: 11,
    color: colors.textMuted,
    letterSpacing: 2,
  },
  userName: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: 1,
  },
  notificationButton: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  notificationIcon: {
    fontSize: 22,
  },
  actionCards: {
    flexDirection: "row",
    paddingHorizontal: 20,
    gap: 12,
  },
  createGameCard: {
    flex: 1,
    backgroundColor: colors.accent,
    borderRadius: 16,
    padding: 20,
    height: 120,
    justifyContent: "space-between",
  },
  findSpaceCard: {
    flex: 1,
    backgroundColor: FIELD_GREEN,
    borderRadius: 16,
    padding: 20,
    height: 120,
    justifyContent: "space-between",
    overflow: "hidden",
  },
  plusIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  plusText: {
    fontSize: 24,
    color: colors.textInverse,
    fontWeight: "300",
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.textInverse,
    letterSpacing: 1,
  },
  fieldPattern: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 60,
    height: 60,
  },
  fieldLine: {
    position: "absolute",
    top: 30,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: FIELD_LINE_GREEN,
  },
  fieldCenterCircle: {
    position: "absolute",
    top: 15,
    left: 15,
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: FIELD_LINE_GREEN,
  },
  fieldMarker: {
    position: "absolute",
    top: 5,
    right: 5,
  },
  markerText: {
    fontSize: 16,
  },
  mapPreview: {
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: FIELD_GREEN,
    borderRadius: 16,
    height: 120,
    overflow: "hidden",
  },
  mapContent: {
    flex: 1,
    position: "relative",
  },
  mapGrid: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  mapGridLine: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: FIELD_LINE_GREEN,
  },
  mapGridLineH: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: FIELD_LINE_GREEN,
    top: "50%",
  },
  mapMarker: {
    position: "absolute",
  },
  mapMarkerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.textInverse,
    borderWidth: 2,
    borderColor: colors.background,
  },
  fullMapButton: {
    position: "absolute",
    bottom: 12,
    right: 12,
    backgroundColor: colors.accent,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  fullMapText: {
    color: colors.textInverse,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: 1,
  },
  seeAllText: {
    fontSize: 12,
    color: colors.accent,
    fontWeight: "600",
  },
  gameCard: {
    flexDirection: "row",
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    alignItems: "center",
  },
  gameIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.inputBorder,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  gameIcon: {
    fontSize: 20,
  },
  gameInfo: {
    flex: 1,
  },
  gameHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  gameSport: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.text,
  },
  skillBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  skillText: {
    fontSize: 9,
    fontWeight: "700",
    color: colors.textInverse,
    letterSpacing: 0.5,
  },
  gameLocation: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 8,
  },
  progressContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  progressBar: {
    flex: 1,
    height: 4,
    backgroundColor: colors.inputBorder,
    borderRadius: 2,
  },
  progressFill: {
    height: "100%",
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  playerCount: {
    fontSize: 11,
    color: colors.textMuted,
  },
  gameTime: {
    alignItems: "flex-end",
    marginLeft: 12,
  },
  timeText: {
    fontSize: 12,
    color: colors.text,
    fontWeight: "600",
  },
  dateText: {
    fontSize: 11,
    color: colors.accent,
    fontWeight: "700",
    marginTop: 2,
  },
  loadingContainer: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 32,
    alignItems: "center",
  },
  emptyState: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 24,
    alignItems: "center",
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
  },
  emptySubtext: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
  bottomNav: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.inputBorder,
    paddingBottom: 30,
    paddingTop: 12,
  },
  navItem: {
    flex: 1,
    alignItems: "center",
  },
  navIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  navLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  navLabelActive: {
    color: colors.accent,
  },
});
}
