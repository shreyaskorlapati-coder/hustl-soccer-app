import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import {
  Tournament,
  listTournaments,
  getMyTournaments,
  getMyTeams,
  deleteTournament,
  getApiErrorMessage,
} from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useTheme, ThemeColors } from "../theme";
import { collectMyTournaments } from "../utils/myActivity";

type Props = {
  navigation: {
    navigate: (screen: string, params?: Record<string, unknown>) => void;
  };
};

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

export default function TournamentsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const statusColors = useMemo(() => getStatusColors(colors), [colors]);
  const { user } = useAuth();

  const [myTournaments, setMyTournaments] = useState<Tournament[]>([]);
  const [allTournaments, setAllTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchTournaments = useCallback(async () => {
    try {
      const [myData, allData, teamsData] = await Promise.all([
        getMyTournaments({ limit: 50 }),
        listTournaments({ limit: 100 }),
        getMyTeams({ limit: 50 }),
      ]);
      const mine = collectMyTournaments(
        user?.id,
        teamsData.results,
        myData.results,
        allData.results
      );
      setMyTournaments(mine);
      setAllTournaments(allData.results.filter(
        t => !mine.some(my => my.id === t.id)
      ));
    } catch (err) {
      console.error("Failed to load tournaments:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      fetchTournaments();
    }, [fetchTournaments])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    fetchTournaments();
  };

  const handleDelete = (tournament: Tournament) => {
    Alert.alert(
      "Delete Tournament",
      `Are you sure you want to delete "${tournament.name}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteTournament(tournament.id);
              fetchTournaments();
            } catch (err) {
              Alert.alert("Error", getApiErrorMessage(err, "Failed to delete tournament"));
            }
          },
        },
      ]
    );
  };

  const renderTournamentCard = (tournament: Tournament, isOwner: boolean) => {
    const statusStyle = statusColors[tournament.status] || statusColors.REGISTRATION;

    return (
      <TouchableOpacity
        key={tournament.id}
        style={styles.tournamentCard}
        onPress={() => navigation.navigate("TournamentDetails", { tournamentId: tournament.id })}
        activeOpacity={0.8}
      >
        <View style={styles.cardHeader}>
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

        {isOwner && (
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => handleDelete(tournament)}
          >
            <Ionicons name="trash-outline" size={20} color={colors.error} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Tournaments</Text>
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => navigation.navigate("CreateTournament")}
        >
          <Ionicons name="add" size={24} color={colors.textInverse} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 80 }]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.accent} />
          }
          showsVerticalScrollIndicator={false}
        >
          {myTournaments.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>My Tournaments</Text>
              {myTournaments.map(t => renderTournamentCard(t, t.organizer.id === user?.id))}
            </View>
          )}

          {allTournaments.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>All Tournaments</Text>
              {allTournaments.map(t => renderTournamentCard(t, false))}
            </View>
          )}

          {myTournaments.length === 0 && allTournaments.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name="trophy-outline" size={48} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>No Tournaments Yet</Text>
              <Text style={styles.emptyText}>Create a tournament to organize competitive matches</Text>
              <TouchableOpacity
                style={styles.emptyButton}
                onPress={() => navigation.navigate("CreateTournament")}
              >
                <Text style={styles.emptyButtonText}>Create Tournament</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      )}
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
    title: {
      fontSize: 24,
      fontWeight: "bold",
      color: colors.headerText,
    },
    createButton: {
      backgroundColor: colors.accent,
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: "center",
      alignItems: "center",
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
    section: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.textMuted,
      marginBottom: 12,
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    tournamentCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
    },
    cardHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 8,
    },
    tournamentName: {
      fontSize: 18,
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
      marginBottom: 12,
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
    deleteButton: {
      position: "absolute",
      top: 16,
      right: 16,
      padding: 8,
    },
    emptyState: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingVertical: 60,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: "600",
      color: colors.text,
      marginTop: 16,
      marginBottom: 8,
    },
    emptyText: {
      fontSize: 14,
      color: colors.textMuted,
      textAlign: "center",
      marginBottom: 24,
    },
    emptyButton: {
      backgroundColor: colors.accent,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 8,
    },
    emptyButtonText: {
      color: colors.textInverse,
      fontWeight: "600",
      fontSize: 16,
    },
  });
}
