import { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import {
  getGame,
  updateGame,
  deleteGame,
  addGoal,
  deleteGoal,
  getApiErrorMessage,
  getTeam,
} from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useTheme, ThemeColors } from "../theme";
import { Game, GameGoal, RootStackParamList } from "../types";

type Props = NativeStackScreenProps<RootStackParamList, "GameDetails">;

const SPORTS = [
  { id: "soccer", label: "Soccer", icon: "⚽" },
  { id: "basketball", label: "Basketball", icon: "🏀" },
  { id: "football", label: "Football", icon: "🏈" },
  { id: "volleyball", label: "Volleyball", icon: "🏐" },
  { id: "baseball", label: "Baseball", icon: "⚾" },
  { id: "tennis", label: "Tennis", icon: "🎾" },
];

const SKILL_LEVELS = ["BEGINNER", "CASUAL", "INTERMEDIATE", "ADVANCED", "ELITE"];
const GAME_STATUSES = [
  { id: "OPEN", label: "Open", color: "#4CAF50" },
  { id: "FULL", label: "Full", color: "#E86A33" },
  { id: "IN_PROGRESS", label: "In Progress", color: "#2196F3" },
  { id: "COMPLETED", label: "Completed", color: "#6B6B6B" },
  { id: "CANCELLED", label: "Cancelled", color: "#FF4444" },
];

function getSportIcon(sport: string): string {
  const found = SPORTS.find((s) => s.id === sport);
  return found?.icon ?? "🏃";
}

function formatGameDate(dateString: string): { date: string; time: string; full: string } {
  const gameDate = new Date(dateString);
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  let hours = gameDate.getHours();
  const minutes = gameDate.getMinutes();
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  const time = `${hours}:${String(minutes).padStart(2, "0")} ${ampm}`;

  const options: Intl.DateTimeFormatOptions = { weekday: "long", month: "long", day: "numeric", year: "numeric" };
  const full = gameDate.toLocaleDateString("en-US", options);

  let date: string;
  if (gameDate.toDateString() === now.toDateString()) {
    date = "Today";
  } else if (gameDate.toDateString() === tomorrow.toDateString()) {
    date = "Tomorrow";
  } else {
    date = gameDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  return { date, time, full };
}

function getStatusColor(status: string, colors: ThemeColors): string {
  switch (status) {
    case "OPEN": return colors.success;
    case "FULL": return colors.accent;
    case "CANCELLED": return colors.error;
    case "COMPLETED": return colors.textMuted;
    default: return colors.textMuted;
  }
}

export default function GameDetailsScreen({ navigation, route }: Props) {
  const { gameId } = route.params;
  const { user } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [editLocation, setEditLocation] = useState("");
  const [editPlayersNeeded, setEditPlayersNeeded] = useState("");
  const [editSkillLevel, setEditSkillLevel] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editStatus, setEditStatus] = useState("");
  
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [selectedTeamForGoal, setSelectedTeamForGoal] = useState<string | null>(null);
  const [selectedScorerId, setSelectedScorerId] = useState<string | null>(null);
  const [goalMinute, setGoalMinute] = useState("");
  const [isAddingGoal, setIsAddingGoal] = useState(false);
  const [homeTeamMembers, setHomeTeamMembers] = useState<{ id: string; name: string }[]>([]);
  const [awayTeamMembers, setAwayTeamMembers] = useState<{ id: string; name: string }[]>([]);

  const isCreator = game?.creator.id === user?.id;
  const isSoccerMatch = game?.sport === "soccer" && game?.team && game?.opponent_team;

  const fetchGame = useCallback(async () => {
    try {
      const data = await getGame(gameId);
      setGame(data);
      setEditLocation(data.location);
      setEditPlayersNeeded(String(data.players_needed));
      setEditSkillLevel(data.skill_level);
      setEditDescription(data.description ?? "");
      setEditStatus(data.status);
      
      if (data.team && data.opponent_team) {
        try {
          const [homeTeam, awayTeam] = await Promise.all([
            getTeam(data.team.id),
            getTeam(data.opponent_team.id),
          ]);
          setHomeTeamMembers(homeTeam.members.map(m => ({ id: m.id, name: m.name })));
          setAwayTeamMembers(awayTeam.members.map(m => ({ id: m.id, name: m.name })));
        } catch (err) {
          console.error("Failed to fetch team members:", err);
        }
      }
    } catch (error) {
      console.error("Failed to fetch game:", error);
      Alert.alert("Error", "Failed to load game details.");
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }, [gameId, navigation]);

  useEffect(() => {
    fetchGame();
  }, [fetchGame]);

  async function handleAddGoal() {
    if (!selectedTeamForGoal || !selectedScorerId) {
      Alert.alert("Error", "Please select a team and scorer.");
      return;
    }

    setIsAddingGoal(true);
    try {
      const minute = goalMinute ? Number.parseInt(goalMinute, 10) : undefined;
      const updatedGame = await addGoal(gameId, {
        team_id: selectedTeamForGoal,
        scorer_id: selectedScorerId,
        minute: minute && !Number.isNaN(minute) ? minute : undefined,
      });
      setGame(updatedGame);
      setShowAddGoal(false);
      setSelectedTeamForGoal(null);
      setSelectedScorerId(null);
      setGoalMinute("");
      Alert.alert("Success", "Goal added!");
    } catch (error) {
      const message = getApiErrorMessage(error, "Failed to add goal.");
      Alert.alert("Error", message);
    } finally {
      setIsAddingGoal(false);
    }
  }

  async function handleDeleteGoal(goalId: string) {
    Alert.alert("Delete Goal", "Are you sure you want to delete this goal?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            const updatedGame = await deleteGoal(gameId, goalId);
            setGame(updatedGame);
          } catch (error) {
            const message = getApiErrorMessage(error, "Failed to delete goal.");
            Alert.alert("Error", message);
          }
        },
      },
    ]);
  }

  function getTeamMembersForGoal(): { id: string; name: string }[] {
    if (selectedTeamForGoal === game?.team?.id) {
      return homeTeamMembers;
    }
    if (selectedTeamForGoal === game?.opponent_team?.id) {
      return awayTeamMembers;
    }
    return [];
  }

  async function handleSave() {
    if (!editLocation.trim()) {
      Alert.alert("Error", "Location is required.");
      return;
    }

    const playersNum = parseInt(editPlayersNeeded, 10);
    if (isNaN(playersNum) || playersNum < 2) {
      Alert.alert("Error", "Players needed must be at least 2.");
      return;
    }

    setIsSaving(true);
    try {
      await updateGame(gameId, {
        location: editLocation.trim(),
        players_needed: playersNum,
        skill_level: editSkillLevel,
        description: editDescription.trim() || undefined,
        status: editStatus,
      });
      await fetchGame();
      setIsEditing(false);
      Alert.alert("Success", "Game updated successfully.");
    } catch (error) {
      const message = getApiErrorMessage(error, "Failed to update game.");
      Alert.alert("Error", message);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteGame() {
    Alert.alert(
      "Delete Game",
      "Are you sure you want to delete this game? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteGame(gameId);
              navigation.goBack();
            } catch (error) {
              const message = getApiErrorMessage(error, "Failed to delete game.");
              Alert.alert("Error", message);
            }
          },
        },
      ]
    );
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  if (!game) {
    return null;
  }

  const { date, time, full } = formatGameDate(game.game_date);
  const progressPercent = (game.players_joined / game.players_needed) * 100;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Game Details</Text>
        {isCreator && !isEditing && (
          <TouchableOpacity style={styles.editButton} onPress={() => setIsEditing(true)}>
            <Text style={styles.editButtonText}>Edit</Text>
          </TouchableOpacity>
        )}
        {isEditing && (
          <TouchableOpacity style={styles.cancelButton} onPress={() => setIsEditing(false)}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        )}
        {!isCreator && <View style={styles.headerSpacer} />}
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <View style={styles.gameHeader}>
            <View style={styles.gameIcon}>
              <Text style={styles.gameIconText}>{getSportIcon(game.sport)}</Text>
            </View>
            <Text style={styles.gameSport}>{game.sport.toUpperCase()}</Text>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(game.status, colors) }]}>
              <Text style={styles.statusText}>{game.status}</Text>
            </View>
            {isCreator && (
              <View style={styles.hostBadge}>
                <Text style={styles.hostBadgeText}>HOST</Text>
              </View>
            )}
          </View>

          <View style={styles.dateTimeCard}>
            <View style={styles.dateTimeRow}>
              <Text style={styles.dateTimeIcon}>📅</Text>
              <View>
                <Text style={styles.dateTimeMain}>{date} at {time}</Text>
                <Text style={styles.dateTimeSub}>{full}</Text>
              </View>
            </View>
          </View>

          {isEditing ? (
            <>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>LOCATION</Text>
                <TextInput
                  style={styles.input}
                  value={editLocation}
                  onChangeText={setEditLocation}
                  placeholder="Game location"
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>PLAYERS NEEDED</Text>
                <TextInput
                  style={styles.input}
                  value={editPlayersNeeded}
                  onChangeText={setEditPlayersNeeded}
                  placeholder="Number of players"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="number-pad"
                />
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>SKILL LEVEL</Text>
                <View style={styles.skillGrid}>
                  {SKILL_LEVELS.map((level) => (
                    <TouchableOpacity
                      key={level}
                      style={[styles.skillOption, editSkillLevel === level && styles.skillOptionSelected]}
                      onPress={() => setEditSkillLevel(level)}
                    >
                      <Text style={[styles.skillLabel, editSkillLevel === level && styles.skillLabelSelected]}>
                        {level}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>GAME STATUS</Text>
                <View style={styles.statusGrid}>
                  {GAME_STATUSES.map((status) => (
                    <TouchableOpacity
                      key={status.id}
                      style={[
                        styles.statusOption,
                        editStatus === status.id && styles.statusOptionSelected,
                        editStatus === status.id && { borderColor: status.color },
                      ]}
                      onPress={() => setEditStatus(status.id)}
                    >
                      <View style={[styles.statusDot, { backgroundColor: status.color }]} />
                      <Text style={[
                        styles.statusLabel,
                        editStatus === status.id && { color: status.color },
                      ]}>
                        {status.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>DESCRIPTION (OPTIONAL)</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={editDescription}
                  onChangeText={setEditDescription}
                  placeholder="Add game details..."
                  placeholderTextColor={colors.textMuted}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>

              <TouchableOpacity
                style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
                onPress={handleSave}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator color={colors.textInverse} />
                ) : (
                  <Text style={styles.saveButtonText}>SAVE CHANGES</Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={styles.infoCard}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoIcon}>📍</Text>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Location</Text>
                    <Text style={styles.infoValue}>{game.location}</Text>
                  </View>
                </View>
              </View>

              {game.team && game.opponent_team ? (
                <>
                  <View style={styles.scoreboardCard}>
                    <View style={styles.teamScoreSection}>
                      <Text style={styles.teamName} numberOfLines={1}>{game.team.name}</Text>
                      <Text style={styles.scoreText}>{game.home_score}</Text>
                    </View>
                    <View style={styles.vsSection}>
                      <Text style={styles.vsText}>VS</Text>
                    </View>
                    <View style={styles.teamScoreSection}>
                      <Text style={styles.teamName} numberOfLines={1}>{game.opponent_team.name}</Text>
                      <Text style={styles.scoreText}>{game.away_score}</Text>
                    </View>
                  </View>

                  {game.goals && game.goals.length > 0 && (
                    <View style={styles.goalsCard}>
                      <Text style={styles.goalsTitle}>Goals</Text>
                      {game.goals.map((goal: GameGoal) => (
                        <View key={goal.id} style={styles.goalItem}>
                          <View style={styles.goalInfo}>
                            <Text style={styles.goalScorer}>{goal.scorer.name}</Text>
                            <Text style={styles.goalTeam}>{goal.team_name}{goal.minute ? ` • ${goal.minute}'` : ""}</Text>
                          </View>
                          {isCreator && (
                            <TouchableOpacity
                              style={styles.deleteGoalButton}
                              onPress={() => handleDeleteGoal(goal.id)}
                            >
                              <Text style={styles.deleteGoalText}>✕</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      ))}
                    </View>
                  )}

                  {isCreator && !showAddGoal && (
                    <TouchableOpacity
                      style={styles.addGoalButton}
                      onPress={() => setShowAddGoal(true)}
                    >
                      <Text style={styles.addGoalButtonText}>+ Add Goal</Text>
                    </TouchableOpacity>
                  )}

                  {isCreator && showAddGoal && (
                    <View style={styles.addGoalCard}>
                      <Text style={styles.addGoalTitle}>Add Goal</Text>
                      
                      <Text style={styles.addGoalLabel}>Team</Text>
                      <View style={styles.teamSelectRow}>
                        <TouchableOpacity
                          style={[
                            styles.teamSelectButton,
                            selectedTeamForGoal === game.team.id && styles.teamSelectButtonActive,
                          ]}
                          onPress={() => {
                            setSelectedTeamForGoal(game.team!.id);
                            setSelectedScorerId(null);
                          }}
                        >
                          <Text style={[
                            styles.teamSelectText,
                            selectedTeamForGoal === game.team.id && styles.teamSelectTextActive,
                          ]}>{game.team.name}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.teamSelectButton,
                            selectedTeamForGoal === game.opponent_team.id && styles.teamSelectButtonActive,
                          ]}
                          onPress={() => {
                            setSelectedTeamForGoal(game.opponent_team!.id);
                            setSelectedScorerId(null);
                          }}
                        >
                          <Text style={[
                            styles.teamSelectText,
                            selectedTeamForGoal === game.opponent_team.id && styles.teamSelectTextActive,
                          ]}>{game.opponent_team.name}</Text>
                        </TouchableOpacity>
                      </View>

                      {selectedTeamForGoal && (
                        <>
                          <Text style={styles.addGoalLabel}>Scorer</Text>
                          <View style={styles.scorerList}>
                            {getTeamMembersForGoal().map((member) => (
                              <TouchableOpacity
                                key={member.id}
                                style={[
                                  styles.scorerChip,
                                  selectedScorerId === member.id && styles.scorerChipActive,
                                ]}
                                onPress={() => setSelectedScorerId(member.id)}
                              >
                                <Text style={[
                                  styles.scorerChipText,
                                  selectedScorerId === member.id && styles.scorerChipTextActive,
                                ]}>{member.name}</Text>
                              </TouchableOpacity>
                            ))}
                            {getTeamMembersForGoal().length === 0 && (
                              <Text style={styles.noMembersText}>No team members found</Text>
                            )}
                          </View>
                        </>
                      )}

                      <Text style={styles.addGoalLabel}>Minute (optional)</Text>
                      <TextInput
                        style={styles.minuteInput}
                        value={goalMinute}
                        onChangeText={setGoalMinute}
                        placeholder="e.g., 45"
                        placeholderTextColor={colors.textMuted}
                        keyboardType="numeric"
                        maxLength={3}
                      />

                      <View style={styles.addGoalActions}>
                        <TouchableOpacity
                          style={styles.cancelGoalButton}
                          onPress={() => {
                            setShowAddGoal(false);
                            setSelectedTeamForGoal(null);
                            setSelectedScorerId(null);
                            setGoalMinute("");
                          }}
                        >
                          <Text style={styles.cancelGoalText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.saveGoalButton, isAddingGoal && styles.saveGoalButtonDisabled]}
                          onPress={handleAddGoal}
                          disabled={isAddingGoal}
                        >
                          {isAddingGoal ? (
                            <ActivityIndicator size="small" color={colors.textInverse} />
                          ) : (
                            <Text style={styles.saveGoalText}>Save Goal</Text>
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </>
              ) : game.team ? (
                <View style={styles.infoCard}>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoIcon}>👥</Text>
                    <View style={styles.infoContent}>
                      <Text style={styles.infoLabel}>Team</Text>
                      <Text style={styles.infoValue}>{game.team.name}</Text>
                    </View>
                  </View>
                </View>
              ) : null}

              <View style={styles.statsRow}>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{game.players_joined}/{game.players_needed}</Text>
                  <Text style={styles.statLabel}>Players</Text>
                  <View style={styles.progressBar}>
                    <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
                  </View>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{game.skill_level}</Text>
                  <Text style={styles.statLabel}>Skill Level</Text>
                </View>
              </View>

              {game.description && (
                <View style={styles.descriptionCard}>
                  <Text style={styles.descriptionTitle}>About this game</Text>
                  <Text style={styles.descriptionText}>{game.description}</Text>
                </View>
              )}

              <View style={styles.creatorCard}>
                <Text style={styles.creatorLabel}>Hosted by</Text>
                <View style={styles.creatorInfo}>
                  <View style={styles.creatorAvatar}>
                    <Text style={styles.creatorAvatarText}>
                      {game.creator.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.creatorName}>{game.creator.name}</Text>
                </View>
              </View>

              {isCreator && (
                <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteGame}>
                  <Text style={styles.deleteButtonText}>Delete Game</Text>
                </TouchableOpacity>
              )}
            </>
          )}

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingContainer: { flex: 1, backgroundColor: colors.background, justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.headerBackground,
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  backButton: { width: 40, height: 40, justifyContent: "center", alignItems: "center" },
  backButtonText: { fontSize: 28, color: colors.headerText, fontWeight: "300" },
  headerTitle: { fontSize: 20, fontWeight: "700", color: colors.headerText },
  editButton: { paddingHorizontal: 12, paddingVertical: 6 },
  editButtonText: { fontSize: 16, color: colors.accent, fontWeight: "600" },
  cancelButton: { paddingHorizontal: 12, paddingVertical: 6 },
  cancelButtonText: { fontSize: 16, color: colors.headerText, fontWeight: "600" },
  headerSpacer: { width: 40 },
  keyboardView: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { padding: 20 },
  gameHeader: { alignItems: "center", marginBottom: 24 },
  gameIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.card,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  gameIconText: { fontSize: 40 },
  gameSport: { fontSize: 24, fontWeight: "800", color: colors.text, marginBottom: 12 },
  statusBadge: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 16, marginBottom: 8 },
  statusText: { fontSize: 12, fontWeight: "700", color: colors.textInverse, letterSpacing: 1 },
  hostBadge: { backgroundColor: colors.accent, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  hostBadgeText: { fontSize: 11, fontWeight: "700", color: colors.textInverse, letterSpacing: 0.5 },
  dateTimeCard: { backgroundColor: colors.card, borderRadius: 12, padding: 16, marginBottom: 16 },
  dateTimeRow: { flexDirection: "row", alignItems: "center" },
  dateTimeIcon: { fontSize: 24, marginRight: 12 },
  dateTimeMain: { fontSize: 18, fontWeight: "700", color: colors.text },
  dateTimeSub: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 12, fontWeight: "700", color: colors.textMuted, letterSpacing: 1, marginBottom: 12 },
  input: { backgroundColor: colors.inputBackground, borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 12, padding: 16, fontSize: 16, color: colors.inputText },
  textArea: { minHeight: 100, paddingTop: 16 },
  skillGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  skillOption: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: colors.card, borderWidth: 2, borderColor: colors.inputBorder, borderRadius: 20 },
  skillOptionSelected: { borderColor: colors.accent, backgroundColor: "rgba(232,106,51,0.1)" },
  skillLabel: { fontSize: 12, fontWeight: "600", color: colors.textMuted },
  skillLabelSelected: { color: colors.accent },
  statusGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  statusOption: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 10, backgroundColor: colors.card, borderWidth: 2, borderColor: colors.inputBorder, borderRadius: 20, gap: 6 },
  statusOptionSelected: { backgroundColor: "rgba(255,255,255,0.05)" },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusLabel: { fontSize: 12, fontWeight: "600", color: colors.textMuted },
  saveButton: { backgroundColor: colors.accent, borderRadius: 12, padding: 16, alignItems: "center", marginTop: 8 },
  saveButtonDisabled: { opacity: 0.7 },
  saveButtonText: { fontSize: 16, fontWeight: "700", color: colors.textInverse, letterSpacing: 1 },
  infoCard: { backgroundColor: colors.card, borderRadius: 12, padding: 16, marginBottom: 16 },
  infoRow: { flexDirection: "row", alignItems: "center" },
  infoIcon: { fontSize: 20, marginRight: 12 },
  infoContent: { flex: 1 },
  infoLabel: { fontSize: 12, color: colors.textMuted, marginBottom: 2 },
  infoValue: { fontSize: 16, fontWeight: "600", color: colors.text },
  scoreboardCard: { backgroundColor: colors.card, borderRadius: 16, padding: 20, marginBottom: 16, flexDirection: "row", alignItems: "center" },
  teamScoreSection: { flex: 1, alignItems: "center" },
  teamName: { fontSize: 14, fontWeight: "600", color: colors.text, marginBottom: 8, textAlign: "center" },
  scoreText: { fontSize: 36, fontWeight: "800", color: colors.accent },
  vsSection: { paddingHorizontal: 16 },
  vsText: { fontSize: 14, fontWeight: "700", color: colors.textMuted },
  goalsCard: { backgroundColor: colors.card, borderRadius: 12, padding: 16, marginBottom: 16 },
  goalsTitle: { fontSize: 14, fontWeight: "700", color: colors.text, marginBottom: 12 },
  goalItem: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.inputBorder },
  goalInfo: { flex: 1 },
  goalScorer: { fontSize: 14, fontWeight: "600", color: colors.text },
  goalTeam: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  deleteGoalButton: { padding: 8 },
  deleteGoalText: { fontSize: 14, color: colors.error },
  addGoalButton: { backgroundColor: colors.primary, borderRadius: 12, padding: 14, alignItems: "center", marginBottom: 16 },
  addGoalButtonText: { fontSize: 14, fontWeight: "700", color: colors.textInverse },
  addGoalCard: { backgroundColor: colors.card, borderRadius: 12, padding: 16, marginBottom: 16 },
  addGoalTitle: { fontSize: 16, fontWeight: "700", color: colors.text, marginBottom: 16 },
  addGoalLabel: { fontSize: 12, fontWeight: "600", color: colors.textMuted, marginBottom: 8, marginTop: 12 },
  teamSelectRow: { flexDirection: "row", gap: 10 },
  teamSelectButton: { flex: 1, backgroundColor: colors.inputBackground, borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 8, padding: 12, alignItems: "center" },
  teamSelectButtonActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  teamSelectText: { fontSize: 13, fontWeight: "600", color: colors.textMuted },
  teamSelectTextActive: { color: colors.textInverse },
  scorerList: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  scorerChip: { backgroundColor: colors.inputBackground, borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 20, paddingVertical: 8, paddingHorizontal: 14 },
  scorerChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  scorerChipText: { fontSize: 13, color: colors.textMuted },
  scorerChipTextActive: { color: colors.textInverse, fontWeight: "600" },
  noMembersText: { fontSize: 13, color: colors.textMuted, fontStyle: "italic" },
  minuteInput: { backgroundColor: colors.inputBackground, borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 8, padding: 12, fontSize: 15, color: colors.inputText },
  addGoalActions: { flexDirection: "row", gap: 12, marginTop: 20 },
  cancelGoalButton: { flex: 1, backgroundColor: colors.inputBackground, borderRadius: 8, padding: 14, alignItems: "center" },
  cancelGoalText: { fontSize: 14, fontWeight: "600", color: colors.textMuted },
  saveGoalButton: { flex: 1, backgroundColor: colors.accent, borderRadius: 8, padding: 14, alignItems: "center" },
  saveGoalButtonDisabled: { opacity: 0.6 },
  saveGoalText: { fontSize: 14, fontWeight: "700", color: colors.textInverse },
  statsRow: { flexDirection: "row", gap: 12, marginBottom: 16 },
  statCard: { flex: 1, backgroundColor: colors.card, borderRadius: 12, padding: 16, alignItems: "center" },
  statValue: { fontSize: 20, fontWeight: "800", color: colors.text, marginBottom: 4 },
  statLabel: { fontSize: 12, color: colors.textMuted, marginBottom: 8 },
  progressBar: { width: "100%", height: 4, backgroundColor: colors.inputBorder, borderRadius: 2 },
  progressFill: { height: "100%", backgroundColor: colors.primary, borderRadius: 2 },
  descriptionCard: { backgroundColor: colors.card, borderRadius: 12, padding: 16, marginBottom: 16 },
  descriptionTitle: { fontSize: 14, fontWeight: "700", color: colors.text, marginBottom: 8 },
  descriptionText: { fontSize: 15, color: colors.textMuted, lineHeight: 22 },
  creatorCard: { backgroundColor: colors.card, borderRadius: 12, padding: 16, marginBottom: 24 },
  creatorLabel: { fontSize: 12, color: colors.textMuted, marginBottom: 10 },
  creatorInfo: { flexDirection: "row", alignItems: "center" },
  creatorAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, justifyContent: "center", alignItems: "center", marginRight: 12 },
  creatorAvatarText: { fontSize: 18, fontWeight: "700", color: colors.textInverse },
  creatorName: { fontSize: 16, fontWeight: "600", color: colors.text },
  deleteButton: { borderWidth: 1, borderColor: colors.error, borderRadius: 12, padding: 16, alignItems: "center", marginTop: 16 },
  deleteButtonText: { fontSize: 16, fontWeight: "600", color: colors.error },
  bottomSpacer: { height: 40 },
});
}
