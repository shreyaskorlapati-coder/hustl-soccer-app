import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  getMyTeams,
  getMyTournaments,
  listGames,
  listTournaments,
  Team,
  Tournament,
} from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../theme";
import { Game, RootStackParamList } from "../types";
import {
  TeamMatch,
  collectMyMatches,
  collectMyTournaments,
  matchesNotCoveredByGames,
  teamIdSet,
} from "../utils/myActivity";

export default function HomeDashboardScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useAuth();
  const { colors } = useTheme();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [games, setGames] = useState<Game[]>([]);
  const [matches, setMatches] = useState<TeamMatch[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [gameCount, setGameCount] = useState(0);
  const [teamCount, setTeamCount] = useState(0);
  const [tournamentCount, setTournamentCount] = useState(0);

  const fetchData = useCallback(async () => {
    try {
      const [gamesData, teamsData, myTournamentsData, allTournamentsData] =
        await Promise.all([
          listGames({ limit: 50 }),
          getMyTeams({ limit: 50 }),
          getMyTournaments({ limit: 50 }),
          listTournaments({ limit: 100 }),
        ]);

      const myTournaments = collectMyTournaments(
        user?.id,
        teamsData.results,
        myTournamentsData.results,
        allTournamentsData.results
      );
      const myTeamIds = teamIdSet(teamsData.results);
      const myMatches = matchesNotCoveredByGames(
        collectMyMatches(myTournaments, myTeamIds),
        gamesData.results
      );

      setGames(gamesData.results.slice(0, 5));
      setMatches(myMatches.slice(0, 5));
      setGameCount(gamesData.results.length + myMatches.length);
      setTeams(teamsData.results.slice(0, 5));
      setTeamCount(teamsData.count);
      setTournaments(myTournaments.slice(0, 5));
      setTournamentCount(myTournaments.length);
    } catch (err) {
      console.error("Failed to load dashboard data:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.headerBackground }]}>
          <Text style={[styles.greeting, { color: colors.textInverse }]}>{getGreeting()}</Text>
          <Text style={[styles.userName, { color: colors.textInverse }]}>{user?.name}</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.headerBackground }]}>
        <View style={styles.headerContent}>
          <View>
            <Text style={[styles.greeting, { color: colors.textInverse }]}>{getGreeting()}</Text>
            <Text style={[styles.userName, { color: colors.textInverse }]}>{user?.name}</Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.accent} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Quick Stats */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.statNumber, { color: colors.accent }]}>{gameCount}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Games</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.statNumber, { color: colors.accent }]}>{teamCount}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Teams</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.statNumber, { color: colors.accent }]}>{tournamentCount}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Tournaments</Text>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={[styles.quickActionButton, { backgroundColor: colors.primary }]}
            onPress={() => navigation.navigate("CreateGame")}
          >
            <Text style={styles.quickActionIcon}>🏟️</Text>
            <Text style={[styles.quickActionText, { color: colors.textInverse }]}>New Game</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickActionButton, { backgroundColor: colors.primary }]}
            onPress={() => navigation.navigate("CreateTeam")}
          >
            <Text style={styles.quickActionIcon}>👥</Text>
            <Text style={[styles.quickActionText, { color: colors.textInverse }]}>New Team</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickActionButton, { backgroundColor: colors.primary }]}
            onPress={() => navigation.navigate("CreateTournament")}
          >
            <Text style={styles.quickActionIcon}>🏆</Text>
            <Text style={[styles.quickActionText, { color: colors.textInverse }]}>New Tourney</Text>
          </TouchableOpacity>
        </View>

        {/* Upcoming Games */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Your Games</Text>
            <TouchableOpacity onPress={() => navigation.navigate("Games" as never)}>
              <Text style={[styles.seeAllText, { color: colors.accent }]}>See All</Text>
            </TouchableOpacity>
          </View>
          {games.length > 0 || matches.length > 0 ? (
            <>
            {games.map((game) => {
              const isHost = game.creator.id === user?.id;
              return (
              <TouchableOpacity
                key={game.id}
                style={[styles.itemCard, { backgroundColor: colors.card }]}
                onPress={() => navigation.navigate("GameDetails", { gameId: game.id })}
              >
                <View style={[styles.itemIcon, { backgroundColor: colors.primary }]}>
                  <Text style={styles.itemEmoji}>⚽</Text>
                </View>
                <View style={styles.itemContent}>
                  <Text style={[styles.itemTitle, { color: colors.text }]} numberOfLines={1}>
                    {game.team && game.opponent_team
                      ? `${game.team.name} vs ${game.opponent_team.name}`
                      : game.location}
                  </Text>
                  <Text style={[styles.itemSubtitle, { color: colors.textMuted }]}>{formatDate(game.game_date)}</Text>
                </View>
                <View style={[styles.itemBadge, { backgroundColor: isHost ? colors.accent : colors.primary }]}>
                  <Text style={[styles.itemBadgeText, { color: colors.textInverse }]}>
                    {isHost ? "HOST" : "PLAYING"}
                  </Text>
                </View>
              </TouchableOpacity>
              );
            })}
            {matches.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[styles.itemCard, { backgroundColor: colors.card }]}
                onPress={() => navigation.navigate("TournamentDetails", { tournamentId: item.tournamentId })}
              >
                <View style={[styles.itemIcon, { backgroundColor: colors.primary }]}>
                  <Text style={styles.itemEmoji}>⚽</Text>
                </View>
                <View style={styles.itemContent}>
                  <Text style={[styles.itemTitle, { color: colors.text }]} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={[styles.itemSubtitle, { color: colors.textMuted }]}>{item.subtitle}</Text>
                </View>
                <View style={[styles.itemBadge, { backgroundColor: colors.primary }]}>
                  <Text style={[styles.itemBadgeText, { color: colors.textInverse }]}>PLAYING</Text>
                </View>
              </TouchableOpacity>
            ))}
            </>
          ) : (
            <View style={[styles.emptyCard, { backgroundColor: colors.card }]}>
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>No games yet</Text>
              <TouchableOpacity
                style={[styles.emptyButton, { backgroundColor: colors.accent }]}
                onPress={() => navigation.navigate("CreateGame")}
              >
                <Text style={[styles.emptyButtonText, { color: colors.textInverse }]}>Create Game</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Your Teams */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Your Teams</Text>
            <TouchableOpacity onPress={() => navigation.navigate("Teams" as never)}>
              <Text style={[styles.seeAllText, { color: colors.accent }]}>See All</Text>
            </TouchableOpacity>
          </View>
          {teams.length > 0 ? (
            teams.map((team) => {
              const isOwner = team.owner.id === user?.id;
              return (
              <TouchableOpacity
                key={team.id}
                style={[styles.itemCard, { backgroundColor: colors.card }]}
                onPress={() => navigation.navigate("TeamDetails", { teamId: team.id })}
              >
                <View style={[styles.itemIcon, { backgroundColor: colors.primary }]}>
                  <Text style={styles.itemEmoji}>👥</Text>
                </View>
                <View style={styles.itemContent}>
                  <Text style={[styles.itemTitle, { color: colors.text }]} numberOfLines={1}>{team.name}</Text>
                  <Text style={[styles.itemSubtitle, { color: colors.textMuted }]}>
                    {team.member_count} member{team.member_count !== 1 ? "s" : ""} · {team.sport}
                  </Text>
                </View>
                <View style={[styles.itemBadge, { backgroundColor: isOwner ? colors.accent : colors.primary }]}>
                  <Text style={[styles.itemBadgeText, { color: colors.textInverse }]}>
                    {isOwner ? "OWNER" : "MEMBER"}
                  </Text>
                </View>
              </TouchableOpacity>
              );
            })
          ) : (
            <View style={[styles.emptyCard, { backgroundColor: colors.card }]}>
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>No teams yet</Text>
              <TouchableOpacity
                style={[styles.emptyButton, { backgroundColor: colors.accent }]}
                onPress={() => navigation.navigate("CreateTeam")}
              >
                <Text style={[styles.emptyButtonText, { color: colors.textInverse }]}>Create Team</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Your Tournaments */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Your Tournaments</Text>
            <TouchableOpacity onPress={() => navigation.navigate("Tournaments" as never)}>
              <Text style={[styles.seeAllText, { color: colors.accent }]}>See All</Text>
            </TouchableOpacity>
          </View>
          {tournaments.length > 0 ? (
            tournaments.map((tournament) => {
              const isOrganizer = tournament.organizer.id === user?.id;
              return (
              <TouchableOpacity
                key={tournament.id}
                style={[styles.itemCard, { backgroundColor: colors.card }]}
                onPress={() => navigation.navigate("TournamentDetails", { tournamentId: tournament.id })}
              >
                <View style={[styles.itemIcon, { backgroundColor: colors.primary }]}>
                  <Text style={styles.itemEmoji}>🏆</Text>
                </View>
                <View style={styles.itemContent}>
                  <Text style={[styles.itemTitle, { color: colors.text }]} numberOfLines={1}>{tournament.name}</Text>
                  <Text style={[styles.itemSubtitle, { color: colors.textMuted }]}>
                    {tournament.team_count}/{tournament.max_teams} teams · {tournament.sport}
                  </Text>
                </View>
                <View style={[styles.itemBadge, { backgroundColor: isOrganizer ? colors.accent : colors.primary }]}>
                  <Text style={[styles.itemBadgeText, { color: colors.textInverse }]}>
                    {isOrganizer ? "ORGANIZER" : "PLAYING"}
                  </Text>
                </View>
              </TouchableOpacity>
              );
            })
          ) : (
            <View style={[styles.emptyCard, { backgroundColor: colors.card }]}>
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>No tournaments yet</Text>
              <TouchableOpacity
                style={[styles.emptyButton, { backgroundColor: colors.accent }]}
                onPress={() => navigation.navigate("CreateTournament")}
              >
                <Text style={[styles.emptyButtonText, { color: colors.textInverse }]}>Create Tournament</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  headerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  greeting: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 4,
  },
  userName: {
    fontSize: 28,
    fontWeight: "bold",
  },
  notificationButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  notificationIcon: {
    fontSize: 22,
  },
  badge: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  statNumber: {
    fontSize: 28,
    fontWeight: "bold",
  },
  statLabel: {
    fontSize: 12,
    marginTop: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  quickActions: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },
  quickActionButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
  },
  quickActionIcon: {
    fontSize: 24,
    marginBottom: 6,
  },
  quickActionText: {
    fontSize: 12,
    fontWeight: "600",
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: "500",
  },
  itemCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  itemIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  itemEmoji: {
    fontSize: 20,
  },
  itemContent: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 2,
  },
  itemSubtitle: {
    fontSize: 13,
  },
  itemBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  itemBadgeActive: {},
  itemBadgeText: {
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  itemBadgeTextActive: {},
  itemArrow: {
    fontSize: 24,
    fontWeight: "300",
  },
  emptyCard: {
    borderRadius: 12,
    padding: 24,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 14,
    marginBottom: 12,
  },
  emptyButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  emptyButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
