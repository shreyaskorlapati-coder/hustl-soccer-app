import React, { useState, useCallback, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  TextInput,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import {
  Tournament,
  TournamentMatch,
  getTournament,
  registerTeamToTournament,
  updateMatchScore,
  setMatchTeams,
  getMyCreatedTeams,
  Team,
  getApiErrorMessage,
} from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useTheme, ThemeColors } from "../theme";
import { RootStackParamList } from "../types";

type Props = NativeStackScreenProps<RootStackParamList, "TournamentDetails">;

const ROUND_LABELS: Record<string, string> = {
  R32: "Round of 32",
  R16: "Round of 16",
  QF: "Quarterfinals",
  SF: "Semifinals",
  FINAL: "Final",
};

function getStatusColors(colors: ThemeColors): Record<string, { bg: string; text: string }> {
  return {
    REGISTRATION: { bg: colors.primaryLight, text: colors.primary },
    IN_PROGRESS: { bg: "rgba(232, 106, 51, 0.18)", text: colors.accent },
    COMPLETED: { bg: "rgba(46, 204, 113, 0.18)", text: colors.success },
    CANCELLED: { bg: "rgba(224, 82, 82, 0.18)", text: colors.error },
  };
}

export default function TournamentDetailsScreen({ route, navigation }: Props) {
  const { tournamentId } = route.params;
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const statusColors = useMemo(() => getStatusColors(colors), [colors]);
  const { user } = useAuth();

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const [myTeams, setMyTeams] = useState<Team[]>([]);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [registering, setRegistering] = useState(false);
  
  const [showScoreModal, setShowScoreModal] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<TournamentMatch | null>(null);
  const [team1Score, setTeam1Score] = useState("");
  const [team2Score, setTeam2Score] = useState("");
  const [savingScore, setSavingScore] = useState(false);

  const [showTeamSelectModal, setShowTeamSelectModal] = useState(false);
  const [teamSelectMatch, setTeamSelectMatch] = useState<TournamentMatch | null>(null);
  const [teamSelectPosition, setTeamSelectPosition] = useState<1 | 2>(1);

  const isOrganizer = tournament?.organizer.id === user?.id;

  const fetchTournament = useCallback(async () => {
    try {
      const data = await getTournament(tournamentId);
      setTournament(data);
    } catch (err) {
      Alert.alert("Error", getApiErrorMessage(err, "Failed to load tournament"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tournamentId]);

  const fetchMyTeams = useCallback(async () => {
    try {
      const data = await getMyCreatedTeams();
      setMyTeams(data.results.filter(t => t.sport === tournament?.sport));
    } catch (err) {
      console.error("Failed to load teams:", err);
    }
  }, [tournament?.sport]);

  useFocusEffect(
    useCallback(() => {
      fetchTournament();
    }, [fetchTournament])
  );

  useEffect(() => {
    if (tournament) {
      fetchMyTeams();
    }
  }, [tournament, fetchMyTeams]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchTournament();
  };

  const handleRegisterTeam = async (teamId: string) => {
    setRegistering(true);
    try {
      const updated = await registerTeamToTournament(tournamentId, teamId);
      setTournament(updated);
      setShowRegisterModal(false);
      Alert.alert("Success", "Team registered successfully!");
    } catch (err) {
      Alert.alert("Error", getApiErrorMessage(err, "Failed to register team"));
    } finally {
      setRegistering(false);
    }
  };

  const handleCreateGames = () => {
    navigation.navigate("CreateTournamentGames", { tournamentId });
  };

  const handleUpdateScore = async () => {
    if (!selectedMatch) return;

    const score1 = Number.parseInt(team1Score, 10);
    const score2 = Number.parseInt(team2Score, 10);

    if (Number.isNaN(score1) || Number.isNaN(score2)) {
      Alert.alert("Error", "Please enter valid scores");
      return;
    }

    if (score1 === score2) {
      Alert.alert("Error", "Scores cannot be equal in knockout tournament");
      return;
    }

    setSavingScore(true);
    try {
      const updated = await updateMatchScore(tournamentId, selectedMatch.id, score1, score2);
      setTournament(updated);
      setShowScoreModal(false);
      setSelectedMatch(null);
      setTeam1Score("");
      setTeam2Score("");
    } catch (err) {
      Alert.alert("Error", getApiErrorMessage(err, "Failed to update score"));
    } finally {
      setSavingScore(false);
    }
  };

  const handleSetTeam = async (teamId: string) => {
    if (!teamSelectMatch) return;

    try {
      const updated = await setMatchTeams(
        tournamentId,
        teamSelectMatch.id,
        teamSelectPosition === 1 ? teamId : undefined,
        teamSelectPosition === 2 ? teamId : undefined
      );
      setTournament(updated);
      setShowTeamSelectModal(false);
      setTeamSelectMatch(null);
    } catch (err) {
      Alert.alert("Error", getApiErrorMessage(err, "Failed to set team"));
    }
  };

  const openScoreModal = (match: TournamentMatch) => {
    setSelectedMatch(match);
    setTeam1Score(match.team1_score?.toString() || "");
    setTeam2Score(match.team2_score?.toString() || "");
    setShowScoreModal(true);
  };

  const openTeamSelectModal = (match: TournamentMatch, position: 1 | 2) => {
    setTeamSelectMatch(match);
    setTeamSelectPosition(position);
    setShowTeamSelectModal(true);
  };

  const groupMatchesByRound = (matches: TournamentMatch[]) => {
    const grouped: Record<string, TournamentMatch[]> = {};
    for (const match of matches) {
      if (!grouped[match.round_name]) {
        grouped[match.round_name] = [];
      }
      grouped[match.round_name].push(match);
    }
    return grouped;
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.headerText} />
          </TouchableOpacity>
          <Text style={styles.title}>Tournament</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </View>
    );
  }

  if (!tournament) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.headerText} />
          </TouchableOpacity>
          <Text style={styles.title}>Tournament</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>Tournament not found</Text>
        </View>
      </View>
    );
  }

  const statusStyle = statusColors[tournament.status] || statusColors.REGISTRATION;
  const groupedMatches = groupMatchesByRound(tournament.matches);
  const availableTeamsForSelect = tournament.teams.filter(t => {
    if (!teamSelectMatch) return true;
    const otherTeamId = teamSelectPosition === 1 ? teamSelectMatch.team2?.id : teamSelectMatch.team1?.id;
    return t.id !== otherTeamId;
  });

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.headerText} />
        </TouchableOpacity>
        <Text style={styles.title}>Tournaments</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 80 }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.accent} />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.tournamentHeader}>
          <View style={styles.headerRow}>
            <Text style={styles.tournamentName}>{tournament.name}</Text>
            <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
              <Text style={[styles.statusText, { color: statusStyle.text }]}>
                {tournament.status.replace("_", " ")}
              </Text>
            </View>
          </View>
          <Text style={styles.tournamentInfo}>
            {tournament.sport.charAt(0).toUpperCase() + tournament.sport.slice(1)} · {tournament.team_count} teams · {tournament.current_round ? ROUND_LABELS[tournament.current_round] || tournament.current_round : "Registration"}
          </Text>

          <View style={styles.roundIndicators}>
            {["QF", "SF", "FINAL"].map((round) => (
              <View
                key={round}
                style={[
                  styles.roundDot,
                  tournament.current_round === round && styles.roundDotActive,
                  tournament.matches.some(m => m.round_name === round && m.status === "COMPLETED") && styles.roundDotCompleted,
                ]}
              >
                <Text style={[
                  styles.roundDotText,
                  (tournament.current_round === round || tournament.matches.some(m => m.round_name === round && m.status === "COMPLETED")) && styles.roundDotTextActive,
                ]}>
                  {round}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {tournament.status === "REGISTRATION" && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Registered Teams ({tournament.team_count}/{tournament.max_teams})</Text>
              {myTeams.length > 0 && (
                <TouchableOpacity
                  style={styles.registerButton}
                  onPress={() => setShowRegisterModal(true)}
                >
                  <Text style={styles.registerButtonText}>Register Team</Text>
                </TouchableOpacity>
              )}
            </View>

            {tournament.teams.length > 0 ? (
              <View style={styles.teamsList}>
                {tournament.teams.map((team, index) => (
                  <View key={team.id} style={styles.teamItem}>
                    <Text style={styles.teamSeed}>{index + 1}</Text>
                    <Text style={styles.teamName}>{team.name}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.noTeamsText}>No teams registered yet</Text>
            )}

            {isOrganizer && tournament.team_count >= 2 && (
              <View>
                <Text style={styles.createGamesHint}>
                  {Math.floor(tournament.team_count / 2)} game{Math.floor(tournament.team_count / 2) === 1 ? "" : "s"} will be created from {tournament.team_count} teams
                  {tournament.team_count % 2 === 1 ? " (1 bye)" : ""}
                </Text>
                <TouchableOpacity
                  style={styles.generateButton}
                  onPress={handleCreateGames}
                >
                  <Text style={styles.generateButtonText}>Create Games</Text>
                  <Ionicons name="arrow-forward" size={20} color={colors.textInverse} />
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {tournament.matches.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Bracket</Text>
            {Object.entries(groupedMatches).map(([roundName, matches]) => (
              <View key={roundName} style={styles.roundSection}>
                {matches.map((match) => (
                  <View key={match.id} style={styles.matchCard}>
                    <View style={styles.matchHeader}>
                      <Text style={styles.matchLabel}>
                        MATCH {match.match_number} {match.status === "COMPLETED" && <Text style={styles.doneLabel}>DONE</Text>}
                      </Text>
                    </View>
                    <View style={styles.matchTeams}>
                      <TouchableOpacity
                        style={[
                          styles.matchTeam,
                          match.winner?.id === match.team1?.id && styles.matchTeamWinner,
                        ]}
                        onPress={() => isOrganizer && !match.team1 && openTeamSelectModal(match, 1)}
                        disabled={!isOrganizer || Boolean(match.team1)}
                      >
                        <Text style={[
                          styles.matchTeamName,
                          match.winner?.id === match.team1?.id && styles.matchTeamNameWinner,
                        ]}>
                          {match.team1?.name || "TBD"}
                        </Text>
                        {match.team1_score !== null && (
                          <Text style={styles.matchScore}>{match.team1_score}</Text>
                        )}
                      </TouchableOpacity>

                      <Text style={styles.vsText}>VS</Text>

                      <TouchableOpacity
                        style={[
                          styles.matchTeam,
                          match.winner?.id === match.team2?.id && styles.matchTeamWinner,
                        ]}
                        onPress={() => isOrganizer && !match.team2 && openTeamSelectModal(match, 2)}
                        disabled={!isOrganizer || Boolean(match.team2)}
                      >
                        <Text style={[
                          styles.matchTeamName,
                          match.winner?.id === match.team2?.id && styles.matchTeamNameWinner,
                        ]}>
                          {match.team2?.name || "TBD"}
                        </Text>
                        {match.team2_score !== null && (
                          <Text style={styles.matchScore}>{match.team2_score}</Text>
                        )}
                      </TouchableOpacity>
                    </View>

                    {isOrganizer && match.team1 && match.team2 && match.status !== "COMPLETED" && (
                      <TouchableOpacity
                        style={styles.updateScoreButton}
                        onPress={() => openScoreModal(match)}
                      >
                        <Text style={styles.updateScoreButtonText}>Update Score</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <Modal
        visible={showRegisterModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowRegisterModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Register Team</Text>
              <TouchableOpacity onPress={() => setShowRegisterModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {myTeams.some(t => !tournament.teams.some(rt => rt.id === t.id)) ? (
              <ScrollView style={styles.modalList}>
                {myTeams
                  .filter(t => !tournament.teams.some(rt => rt.id === t.id))
                  .map((team) => (
                    <TouchableOpacity
                      key={team.id}
                      style={styles.modalTeamItem}
                      onPress={() => handleRegisterTeam(team.id)}
                      disabled={registering}
                    >
                      <Text style={styles.modalTeamName}>{team.name}</Text>
                      {registering ? (
                        <ActivityIndicator size="small" color={colors.accent} />
                      ) : (
                        <Ionicons name="add-circle" size={24} color={colors.accent} />
                      )}
                    </TouchableOpacity>
                  ))}
              </ScrollView>
            ) : (
              <Text style={styles.noTeamsModalText}>
                All your teams are already registered or you don't have teams for this sport.
              </Text>
            )}
          </View>
        </View>
      </Modal>

      <Modal
        visible={showScoreModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowScoreModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Update Score</Text>
              <TouchableOpacity onPress={() => setShowScoreModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {selectedMatch && (
              <View style={styles.scoreInputs}>
                <View style={styles.scoreInputGroup}>
                  <Text style={styles.scoreTeamName}>{selectedMatch.team1?.name}</Text>
                  <TextInput
                    style={styles.scoreInput}
                    value={team1Score}
                    onChangeText={setTeam1Score}
                    keyboardType="number-pad"
                    placeholder="0"
                    placeholderTextColor={colors.placeholder}
                  />
                </View>
                <Text style={styles.scoreVs}>VS</Text>
                <View style={styles.scoreInputGroup}>
                  <Text style={styles.scoreTeamName}>{selectedMatch.team2?.name}</Text>
                  <TextInput
                    style={styles.scoreInput}
                    value={team2Score}
                    onChangeText={setTeam2Score}
                    keyboardType="number-pad"
                    placeholder="0"
                    placeholderTextColor={colors.placeholder}
                  />
                </View>
              </View>
            )}

            <TouchableOpacity
              style={[styles.saveScoreButton, savingScore && styles.saveScoreButtonDisabled]}
              onPress={handleUpdateScore}
              disabled={savingScore}
            >
              {savingScore ? (
                <ActivityIndicator color={colors.textInverse} />
              ) : (
                <Text style={styles.saveScoreButtonText}>Save Score</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showTeamSelectModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTeamSelectModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Team</Text>
              <TouchableOpacity onPress={() => setShowTeamSelectModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalList}>
              {availableTeamsForSelect.map((team) => (
                <TouchableOpacity
                  key={team.id}
                  style={styles.modalTeamItem}
                  onPress={() => handleSetTeam(team.id)}
                >
                  <Text style={styles.modalTeamName}>{team.name}</Text>
                  <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingVertical: 16,
      backgroundColor: colors.headerBackground,
    },
    backButton: {
      width: 40,
      height: 40,
      justifyContent: "center",
      alignItems: "center",
    },
    title: {
      fontSize: 20,
      fontWeight: "bold",
      color: colors.headerText,
    },
    content: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: 20,
      paddingTop: 16,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    errorText: {
      color: colors.error,
      fontSize: 16,
    },
    tournamentHeader: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      marginBottom: 24,
    },
    headerRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 8,
    },
    tournamentName: {
      fontSize: 20,
      fontWeight: "bold",
      color: colors.text,
      flex: 1,
      marginRight: 12,
    },
    statusBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    statusText: {
      fontSize: 11,
      fontWeight: "600",
      textTransform: "uppercase",
    },
    tournamentInfo: {
      fontSize: 14,
      color: colors.textMuted,
      marginBottom: 16,
    },
    roundIndicators: {
      flexDirection: "row",
      gap: 8,
    },
    roundDot: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
      backgroundColor: colors.cardSecondary,
    },
    roundDotActive: {
      backgroundColor: colors.accent,
    },
    roundDotCompleted: {
      backgroundColor: colors.primary,
    },
    roundDotText: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.textMuted,
    },
    roundDotTextActive: {
      color: colors.textInverse,
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
      fontSize: 16,
      fontWeight: "bold",
      color: colors.text,
    },
    registerButton: {
      backgroundColor: colors.accent,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
    },
    registerButtonText: {
      color: colors.textInverse,
      fontWeight: "600",
      fontSize: 14,
    },
    teamsList: {
      backgroundColor: colors.card,
      borderRadius: 12,
      overflow: "hidden",
    },
    teamItem: {
      flexDirection: "row",
      alignItems: "center",
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    teamSeed: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.cardSecondary,
      textAlign: "center",
      lineHeight: 28,
      color: colors.textMuted,
      fontWeight: "bold",
      fontSize: 14,
      marginRight: 12,
    },
    teamName: {
      flex: 1,
      fontSize: 16,
      color: colors.text,
    },
    noTeamsText: {
      color: colors.textMuted,
      fontSize: 14,
      textAlign: "center",
      paddingVertical: 20,
    },
    generateButton: {
      backgroundColor: colors.accent,
      borderRadius: 12,
      paddingVertical: 16,
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      gap: 8,
      marginTop: 16,
    },
    generateButtonText: {
      fontSize: 16,
      fontWeight: "bold",
      color: colors.textInverse,
    },
    createGamesHint: {
      fontSize: 13,
      color: colors.textMuted,
      textAlign: "center",
      marginTop: 16,
      marginBottom: 8,
    },
    roundSection: {
      marginBottom: 16,
    },
    matchCard: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
    },
    matchHeader: {
      marginBottom: 12,
    },
    matchLabel: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.textMuted,
      letterSpacing: 1,
    },
    doneLabel: {
      color: colors.success,
      marginLeft: 8,
    },
    matchTeams: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    matchTeam: {
      flex: 1,
      backgroundColor: colors.cardSecondary,
      borderRadius: 8,
      padding: 12,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    matchTeamWinner: {
      backgroundColor: colors.accent,
    },
    matchTeamName: {
      fontSize: 14,
      color: colors.text,
      flex: 1,
    },
    matchTeamNameWinner: {
      color: colors.textInverse,
      fontWeight: "bold",
    },
    matchScore: {
      fontSize: 16,
      fontWeight: "bold",
      color: colors.text,
      marginLeft: 8,
    },
    vsText: {
      fontSize: 12,
      fontWeight: "bold",
      color: colors.textMuted,
    },
    updateScoreButton: {
      backgroundColor: colors.cardSecondary,
      borderRadius: 8,
      paddingVertical: 10,
      alignItems: "center",
      marginTop: 12,
    },
    updateScoreButtonText: {
      color: colors.accent,
      fontWeight: "600",
      fontSize: 14,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.45)",
      justifyContent: "flex-end",
    },
    modalContent: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 20,
      maxHeight: "60%",
    },
    modalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 20,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: "bold",
      color: colors.text,
    },
    modalList: {
      maxHeight: 300,
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
    },
    noTeamsModalText: {
      color: colors.textMuted,
      fontSize: 14,
      textAlign: "center",
      paddingVertical: 20,
    },
    scoreInputs: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 24,
    },
    scoreInputGroup: {
      flex: 1,
      alignItems: "center",
    },
    scoreTeamName: {
      fontSize: 14,
      color: colors.text,
      marginBottom: 8,
      textAlign: "center",
    },
    scoreInput: {
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      borderRadius: 8,
      padding: 16,
      fontSize: 24,
      fontWeight: "bold",
      color: colors.inputText,
      textAlign: "center",
      width: 80,
    },
    scoreVs: {
      fontSize: 14,
      fontWeight: "bold",
      color: colors.textMuted,
      marginHorizontal: 16,
    },
    saveScoreButton: {
      backgroundColor: colors.accent,
      borderRadius: 12,
      paddingVertical: 16,
      alignItems: "center",
    },
    saveScoreButtonDisabled: {
      opacity: 0.6,
    },
    saveScoreButtonText: {
      fontSize: 16,
      fontWeight: "bold",
      color: colors.textInverse,
    },
  });
}
