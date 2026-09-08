import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { getMyCreatedTeams, getMyJoinedTeams, listTeams, joinTeam, Team } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useTheme, Colors } from "../theme";
import { RootStackParamList } from "../types";

type Props = NativeStackScreenProps<RootStackParamList, "Teams">;

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

export default function TeamsScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const firstName = user?.name?.split(" ")[0] ?? "Player";

  const [teamsCreated, setTeamsCreated] = useState<Team[]>([]);
  const [teamsJoined, setTeamsJoined] = useState<Team[]>([]);
  const [suggestedTeams, setSuggestedTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [joiningTeamId, setJoiningTeamId] = useState<string | null>(null);

  const fetchTeams = useCallback(async () => {
    try {
      const [createdRes, joinedRes, allTeamsRes] = await Promise.all([
        getMyCreatedTeams({ limit: 20 }),
        getMyJoinedTeams({ limit: 20 }),
        listTeams({ limit: 20 }),
      ]);

      setTeamsCreated(createdRes.results);
      setTeamsJoined(joinedRes.results);

      const myTeamIds = new Set([
        ...createdRes.results.map((t) => t.id),
        ...joinedRes.results.map((t) => t.id),
      ]);
      const suggested = allTeamsRes.results.filter((t) => !myTeamIds.has(t.id));
      setSuggestedTeams(suggested);
    } catch (error) {
      console.error("Failed to fetch teams:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchTeams();
    }, [fetchTeams])
  );

  function handleRefresh() {
    setRefreshing(true);
    fetchTeams();
  }

  function handleCreateTeam() {
    navigation.navigate("CreateTeam");
  }

  async function handleJoinTeam(teamId: string) {
    setJoiningTeamId(teamId);
    try {
      await joinTeam(teamId);
      fetchTeams();
    } catch (error) {
      console.error("Failed to join team:", error);
    } finally {
      setJoiningTeamId(null);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.headerBackground }]}>
        <Text style={[styles.greeting, { color: colors.textInverse }]}>Hello, {firstName} 👋</Text>
        <Text style={[styles.title, { color: colors.textInverse }]}>My Teams</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.accentOrange} />
        }
      >
        <TouchableOpacity style={styles.createButton} onPress={handleCreateTeam}>
          <Text style={styles.createButtonIcon}>+</Text>
          <Text style={styles.createButtonText}>CREATE NEW TEAM</Text>
        </TouchableOpacity>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color={Colors.accentOrange} size="large" />
          </View>
        ) : (
          <>
            {teamsCreated.length === 0 && teamsJoined.length === 0 ? (
              <View style={[styles.emptyState, { backgroundColor: colors.card }]}>
                <Text style={styles.emptyIcon}>👥</Text>
                <Text style={[styles.emptyText, { color: colors.text }]}>No teams yet</Text>
                <Text style={[styles.emptySubtext, { color: colors.textMuted }]}>Create or join a team to play together!</Text>
              </View>
            ) : (
              <>
                {teamsCreated.length > 0 && (
                  <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>TEAMS CREATED BY ME</Text>
                    {teamsCreated.map((team) => (
                      <TouchableOpacity
                        key={team.id}
                        style={[styles.teamCard, { backgroundColor: colors.card }]}
                        onPress={() => navigation.navigate("TeamDetails", { teamId: team.id })}
                      >
                        <View style={[styles.teamAvatar, { backgroundColor: colors.border }]}>
                          <Text style={styles.teamAvatarText}>{getSportIcon(team.sport)}</Text>
                        </View>
                        <View style={styles.teamInfo}>
                          <View style={styles.teamNameRow}>
                            <Text style={[styles.teamName, { color: colors.text }]}>{team.name}</Text>
                            <View style={styles.ownerBadge}>
                              <Text style={styles.ownerBadgeText}>OWNER</Text>
                            </View>
                          </View>
                          <Text style={[styles.teamMeta, { color: colors.textMuted }]}>{team.member_count} members · {team.sport}</Text>
                        </View>
                        <Text style={[styles.chevron, { color: colors.textMuted }]}>›</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {teamsJoined.length > 0 && (
                  <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>TEAMS I JOINED</Text>
                    {teamsJoined.map((team) => (
                      <TouchableOpacity
                        key={team.id}
                        style={[styles.teamCard, { backgroundColor: colors.card }]}
                        onPress={() => navigation.navigate("TeamDetails", { teamId: team.id })}
                      >
                        <View style={[styles.teamAvatar, { backgroundColor: colors.border }]}>
                          <Text style={styles.teamAvatarText}>{getSportIcon(team.sport)}</Text>
                        </View>
                        <View style={styles.teamInfo}>
                          <Text style={[styles.teamName, { color: colors.text }]}>{team.name}</Text>
                          <Text style={[styles.teamMeta, { color: colors.textMuted }]}>{team.member_count} members · {team.sport}</Text>
                        </View>
                        <View style={[styles.memberBadge, { backgroundColor: colors.primary }]}>
                          <Text style={styles.memberBadgeText}>MEMBER</Text>
                        </View>
                        <Text style={[styles.chevron, { color: colors.textMuted }]}>›</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </>
            )}

            {suggestedTeams.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>DISCOVER TEAMS</Text>
                {suggestedTeams.map((team) => (
                  <View key={team.id} style={[styles.teamCard, { backgroundColor: colors.card }]}>
                    <View style={[styles.teamAvatar, { backgroundColor: colors.border }]}>
                      <Text style={styles.teamAvatarText}>{getSportIcon(team.sport)}</Text>
                    </View>
                    <View style={styles.teamInfo}>
                      <Text style={[styles.teamName, { color: colors.text }]}>{team.name}</Text>
                      <Text style={[styles.teamMeta, { color: colors.textMuted }]}>{team.member_count} members · {team.sport}</Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.joinButton, { backgroundColor: colors.primary }]}
                      onPress={() => handleJoinTeam(team.id)}
                      disabled={joiningTeamId === team.id}
                    >
                      {joiningTeamId === team.id ? (
                        <ActivityIndicator size="small" color={Colors.white} />
                      ) : (
                        <Text style={styles.joinButtonText}>JOIN</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
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
  emptyState: { borderRadius: 12, padding: 40, alignItems: "center", marginBottom: 24 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyText: { fontSize: 18, fontWeight: "600" },
  emptySubtext: { fontSize: 14, marginTop: 4, textAlign: "center" },
  section: { marginTop: 8, marginBottom: 16 },
  sectionTitle: { fontSize: 12, fontWeight: "700", letterSpacing: 1, marginBottom: 16 },
  teamCard: { flexDirection: "row", alignItems: "center", borderRadius: 12, padding: 16, marginBottom: 12 },
  teamAvatar: { width: 48, height: 48, borderRadius: 24, justifyContent: "center", alignItems: "center", marginRight: 12 },
  teamAvatarText: { fontSize: 24 },
  teamInfo: { flex: 1 },
  teamNameRow: { flexDirection: "row", alignItems: "center", marginBottom: 4, flexWrap: "wrap", gap: 8 },
  teamName: { fontSize: 16, fontWeight: "700" },
  teamMeta: { fontSize: 13 },
  ownerBadge: { backgroundColor: Colors.accentOrange, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  ownerBadgeText: { fontSize: 9, fontWeight: "700", color: Colors.white, letterSpacing: 0.5 },
  memberBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, marginRight: 8 },
  memberBadgeText: { fontSize: 10, fontWeight: "600", color: Colors.white, letterSpacing: 0.5 },
  joinButton: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, minWidth: 60, alignItems: "center" },
  joinButtonText: { fontSize: 12, fontWeight: "700", color: Colors.white, letterSpacing: 0.5 },
  chevron: { fontSize: 24, fontWeight: "300", marginLeft: 4 },
});
