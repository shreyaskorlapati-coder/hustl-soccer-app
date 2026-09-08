import { useFocusEffect } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useCallback, useState } from "react";
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

import { deleteGame, getApiErrorMessage, getMyTeams, listGames, listTournaments, getMyTournaments } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useTheme, Colors } from "../theme";
import { Game, RootStackParamList } from "../types";
import {
  TeamMatch,
  collectMyMatches,
  collectMyTournaments,
  matchesNotCoveredByGames,
  teamIdSet,
} from "../utils/myActivity";

type Props = NativeStackScreenProps<RootStackParamList, "Games">;

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

function getSportIcon(sport: string): string {
  switch (sport) {
    case "soccer": return "⚽";
    case "basketball": return "🏀";
    case "volleyball": return "🏐";
    case "tennis": return "🎾";
    case "baseball": return "⚾";
    case "football": return "🏈";
    default: return "🏃";
  }
}

function getSkillColor(level: string): string {
  switch (level) {
    case "CASUAL": return Colors.accentOrange;
    case "ADVANCED":
    case "ELITE": return Colors.primaryGreen;
    default: return "#3D3D3D";
  }
}

export default function GamesScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const [gamesCreated, setGamesCreated] = useState<Game[]>([]);
  const [gamesJoined, setGamesJoined] = useState<Game[]>([]);
  const [teamMatches, setTeamMatches] = useState<TeamMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const firstName = user?.name?.split(" ")[0] ?? "Player";

  const fetchGames = useCallback(async () => {
    if (!isAuthenticated || !user) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const [response, teamsData, myTournamentsData, allTournamentsData] = await Promise.all([
        listGames({ limit: 50 }),
        getMyTeams({ limit: 50 }),
        getMyTournaments({ limit: 50 }),
        listTournaments({ limit: 100 }),
      ]);

      const created: Game[] = [];
      const joined: Game[] = [];

      for (const game of response.results) {
        if (game.creator.id === user.id) {
          created.push(game);
        } else {
          joined.push(game);
        }
      }

      const myTournaments = collectMyTournaments(
        user.id,
        teamsData.results,
        myTournamentsData.results,
        allTournamentsData.results
      );
      const myMatches = matchesNotCoveredByGames(
        collectMyMatches(myTournaments, teamIdSet(teamsData.results)),
        response.results
      );

      setGamesCreated(created);
      setGamesJoined(joined);
      setTeamMatches(myMatches);
    } catch (error) {
      console.error("Failed to fetch games:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAuthenticated, user]);

  useFocusEffect(
    useCallback(() => {
      if (!authLoading) {
        fetchGames();
      }
    }, [fetchGames, authLoading])
  );

  function handleRefresh() {
    setRefreshing(true);
    fetchGames();
  }

  function handleCreateGame() {
    navigation.navigate("CreateGame");
  }

  function handleDeleteGame(gameId: string, gameSport: string) {
    Alert.alert(
      "Delete Game",
      `Are you sure you want to delete this ${gameSport} game?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteGame(gameId);
              Alert.alert("Deleted", "Game has been deleted successfully.");
              await fetchGames();
            } catch (error) {
              const message = getApiErrorMessage(error, "Failed to delete game.");
              Alert.alert("Error", message);
            }
          },
        },
      ]
    );
  }

  function renderGameCard(game: Game, badge?: { text: string; color: string }, showDelete?: boolean) {
    const { time, date } = formatGameDate(game.game_date);
    return (
      <TouchableOpacity
        key={game.id}
        style={[styles.gameCard, { backgroundColor: colors.card }]}
        onPress={() => navigation.navigate("GameDetails", { gameId: game.id })}
      >
        <View style={[styles.gameIconContainer, { backgroundColor: colors.border }]}>
          <Text style={styles.gameIcon}>{getSportIcon(game.sport)}</Text>
        </View>
        <View style={styles.gameInfo}>
          <View style={styles.gameHeader}>
            <Text style={[styles.gameSport, { color: colors.text }]}>{game.sport.toUpperCase()}</Text>
            {badge && (
              <View style={[styles.roleBadge, { backgroundColor: badge.color }]}>
                <Text style={styles.roleBadgeText}>{badge.text}</Text>
              </View>
            )}
            <View style={[styles.skillBadge, { backgroundColor: getSkillColor(game.skill_level) }]}>
              <Text style={styles.skillText}>{game.skill_level}</Text>
            </View>
          </View>
          <Text style={[styles.gameLocation, { color: colors.textMuted }]} numberOfLines={1}>{game.location}</Text>
          {game.team && game.opponent_team ? (
            <Text style={[styles.gameTeam, { color: colors.primary }]} numberOfLines={1}>
              {game.team.name} {game.home_score} - {game.away_score} {game.opponent_team.name}
            </Text>
          ) : game.team ? (
            <Text style={[styles.gameTeam, { color: colors.primary }]} numberOfLines={1}>Team: {game.team.name}</Text>
          ) : null}
          <View style={styles.progressContainer}>
            <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
              <View style={[styles.progressFill, { width: `${(game.players_joined / game.players_needed) * 100}%`, backgroundColor: colors.primary }]} />
            </View>
            <Text style={[styles.playerCount, { color: colors.textMuted }]}>{game.players_joined}/{game.players_needed}</Text>
          </View>
        </View>
        <View style={styles.gameTimeActions}>
          <View style={styles.gameTime}>
            <Text style={[styles.timeText, { color: colors.text }]}>{time}</Text>
            <Text style={[styles.dateText, { color: colors.accent }]}>{date}</Text>
          </View>
          {showDelete && (
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={(e) => {
                e.stopPropagation();
                handleDeleteGame(game.id, game.sport);
              }}
            >
              <Text style={styles.deleteButtonText}>🗑️</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.headerBackground }]}>
        <Text style={[styles.greeting, { color: colors.textInverse }]}>Hello, {firstName} 👋</Text>
        <Text style={[styles.title, { color: colors.textInverse }]}>My Games</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.accentOrange} />
        }
      >
        <TouchableOpacity style={styles.createButton} onPress={handleCreateGame}>
          <Text style={styles.createButtonIcon}>+</Text>
          <Text style={styles.createButtonText}>CREATE NEW GAME</Text>
        </TouchableOpacity>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color={Colors.accentOrange} size="large" />
          </View>
        ) : (
          <>
            {gamesCreated.length === 0 && gamesJoined.length === 0 && teamMatches.length === 0 ? (
              <View style={[styles.emptyState, { backgroundColor: colors.card }]}>
                <Text style={styles.emptyIcon}>🏟️</Text>
                <Text style={[styles.emptyText, { color: colors.text }]}>No upcoming games</Text>
                <Text style={[styles.emptySubtext, { color: colors.textMuted }]}>Create or join a game to get started!</Text>
              </View>
            ) : (
              <>
                {gamesCreated.length > 0 && (
                  <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>GAMES I CREATED</Text>
                    {gamesCreated.map((game) => renderGameCard(game, { text: "HOST", color: Colors.accentOrange }, true))}
                  </View>
                )}

                {gamesJoined.length > 0 && (
                  <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>GAMES I JOINED</Text>
                    {gamesJoined.map((game) => renderGameCard(game, { text: "PLAYER", color: Colors.primaryGreen }))}
                  </View>
                )}

                {teamMatches.length > 0 && (
                  <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>TEAM MATCHES</Text>
                    {teamMatches.map((item) => (
                      <TouchableOpacity
                        key={item.id}
                        style={[styles.gameCard, { backgroundColor: colors.card }]}
                        onPress={() => navigation.navigate("TournamentDetails", { tournamentId: item.tournamentId })}
                      >
                        <View style={[styles.gameIconContainer, { backgroundColor: colors.border }]}>
                          <Text style={styles.gameIcon}>{getSportIcon(item.sport)}</Text>
                        </View>
                        <View style={styles.gameInfo}>
                          <View style={styles.gameHeader}>
                            <Text style={[styles.gameSport, { color: colors.text }]}>{item.sport.toUpperCase()}</Text>
                            <View style={[styles.roleBadge, { backgroundColor: Colors.primaryGreen }]}>
                              <Text style={styles.roleBadgeText}>PLAYING</Text>
                            </View>
                          </View>
                          <Text style={[styles.gameLocation, { color: colors.textMuted }]} numberOfLines={1}>
                            {item.subtitle}
                          </Text>
                          <Text style={[styles.gameTeam, { color: colors.primary }]} numberOfLines={1}>
                            {item.title}
                          </Text>
                        </View>
                        <View style={styles.gameTimeActions}>
                          <View style={styles.gameTime}>
                            <Text style={[styles.dateText, { color: colors.accent }]}>{item.match.status}</Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 60, paddingBottom: 20, paddingHorizontal: 20 },
  greeting: { fontSize: 14, opacity: 0.7, marginBottom: 4 },
  title: { fontSize: 28, fontWeight: "800" },
  scrollView: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 100 },
  createButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: Colors.accentOrange, borderRadius: 12, padding: 16, marginBottom: 20 },
  createButtonIcon: { fontSize: 24, color: Colors.white, marginRight: 10, fontWeight: "300" },
  createButtonText: { fontSize: 16, fontWeight: "700", color: Colors.white, letterSpacing: 1 },
  loadingContainer: { padding: 40, alignItems: "center" },
  emptyState: { borderRadius: 12, padding: 40, alignItems: "center" },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyText: { fontSize: 18, fontWeight: "600" },
  emptySubtext: { fontSize: 14, marginTop: 4, textAlign: "center" },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 12, fontWeight: "700", letterSpacing: 1, marginBottom: 12 },
  gameCard: { flexDirection: "row", borderRadius: 12, padding: 16, marginBottom: 12, alignItems: "center" },
  gameIconContainer: { width: 48, height: 48, borderRadius: 24, justifyContent: "center", alignItems: "center", marginRight: 12 },
  gameIcon: { fontSize: 24 },
  gameInfo: { flex: 1 },
  gameHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" },
  gameSport: { fontSize: 15, fontWeight: "800" },
  roleBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  roleBadgeText: { fontSize: 9, fontWeight: "700", color: Colors.white, letterSpacing: 0.5 },
  skillBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  skillText: { fontSize: 9, fontWeight: "700", color: Colors.white, letterSpacing: 0.5 },
  gameLocation: { fontSize: 13, marginBottom: 4 },
  gameTeam: { fontSize: 12, fontWeight: "600", marginBottom: 6 },
  progressContainer: { flexDirection: "row", alignItems: "center", gap: 8 },
  progressBar: { flex: 1, height: 4, borderRadius: 2 },
  progressFill: { height: "100%", borderRadius: 2 },
  playerCount: { fontSize: 11 },
  gameTimeActions: { alignItems: "flex-end", marginLeft: 12 },
  gameTime: { alignItems: "flex-end" },
  timeText: { fontSize: 13, fontWeight: "600" },
  dateText: { fontSize: 12, fontWeight: "700", marginTop: 2 },
  deleteButton: { marginTop: 8, padding: 4 },
  deleteButtonText: { fontSize: 16 },
});
