import { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  getTeam,
  updateTeam,
  addTeamMember,
  removeTeamMember,
  deleteTeam,
  searchUsers,
  TeamDetail,
  UserProfile,
  getApiErrorMessage,
} from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useTheme, ThemeColors } from "../theme";
import { RootStackParamList } from "../types";

type Props = NativeStackScreenProps<RootStackParamList, "TeamDetails">;

const SPORTS = [
  { id: "soccer", label: "Soccer", icon: "⚽" },
  { id: "basketball", label: "Basketball", icon: "🏀" },
  { id: "football", label: "Football", icon: "🏈" },
  { id: "volleyball", label: "Volleyball", icon: "🏐" },
  { id: "baseball", label: "Baseball", icon: "⚾" },
  { id: "tennis", label: "Tennis", icon: "🎾" },
];

function getSportIcon(sport: string): string {
  const found = SPORTS.find((s) => s.id === sport);
  return found?.icon ?? "🏃";
}

export default function TeamDetailsScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { teamId } = route.params;
  const { user } = useAuth();

  const [team, setTeam] = useState<TeamDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editSport, setEditSport] = useState("");

  const [showAddMember, setShowAddMember] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [addingUserId, setAddingUserId] = useState<string | null>(null);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isOwner = team?.owner.id === user?.id;

  const fetchTeam = useCallback(async () => {
    try {
      const data = await getTeam(teamId);
      setTeam(data);
      setEditName(data.name);
      setEditDescription(data.description ?? "");
      setEditSport(data.sport);
    } catch (error) {
      console.error("Failed to fetch team:", error);
      Alert.alert("Error", "Failed to load team details.");
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }, [teamId, navigation]);

  useEffect(() => {
    fetchTeam();
  }, [fetchTeam]);

  async function handleSave() {
    if (!editName.trim()) {
      Alert.alert("Error", "Team name is required.");
      return;
    }

    setIsSaving(true);
    try {
      await updateTeam(teamId, {
        name: editName.trim(),
        description: editDescription.trim() || undefined,
        sport: editSport,
      });
      await fetchTeam();
      setIsEditing(false);
      Alert.alert("Success", "Team updated successfully.");
    } catch (error) {
      const message = getApiErrorMessage(error, "Failed to update team.");
      Alert.alert("Error", message);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSearchUsers() {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const results = await searchUsers({ q: searchQuery.trim(), limit: 10 });
      const memberIds = new Set(team?.members.map((m) => m.id) ?? []);
      const filtered = results.results.filter((u) => !memberIds.has(u.id));
      setSearchResults(filtered);
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setIsSearching(false);
    }
  }

  async function handleAddMember(userId: string) {
    setAddingUserId(userId);
    try {
      await addTeamMember(teamId, { user_id: userId });
      await fetchTeam();
      setSearchResults(searchResults.filter((u) => u.id !== userId));
      setSearchQuery("");
    } catch (error) {
      const message = getApiErrorMessage(error, "Failed to add member.");
      Alert.alert("Error", message);
    } finally {
      setAddingUserId(null);
    }
  }

  async function handleRemoveMember(userId: string, userName: string) {
    Alert.alert(
      "Remove Member",
      `Are you sure you want to remove ${userName} from the team?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            setRemovingUserId(userId);
            try {
              await removeTeamMember(teamId, userId);
              await fetchTeam();
            } catch (error) {
              const message = getApiErrorMessage(error, "Failed to remove member.");
              Alert.alert("Error", message);
            } finally {
              setRemovingUserId(null);
            }
          },
        },
      ]
    );
  }

  async function handleDeleteTeam() {
    Alert.alert(
      "Delete Team",
      "Are you sure you want to delete this team? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteTeam(teamId);
              navigation.goBack();
            } catch (error) {
              const message = getApiErrorMessage(error, "Failed to delete team.");
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

  if (!team) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Team Details</Text>
        {isOwner && !isEditing && (
          <TouchableOpacity style={styles.editButton} onPress={() => setIsEditing(true)}>
            <Text style={styles.editButtonText}>Edit</Text>
          </TouchableOpacity>
        )}
        {isEditing && (
          <TouchableOpacity style={styles.cancelButton} onPress={() => setIsEditing(false)}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        )}
        {!isOwner && <View style={styles.headerSpacer} />}
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <View style={styles.teamHeader}>
            <View style={styles.teamIcon}>
              <Text style={styles.teamIconText}>{getSportIcon(team.sport)}</Text>
            </View>
            {isEditing ? (
              <TextInput
                style={styles.editNameInput}
                value={editName}
                onChangeText={setEditName}
                placeholder="Team name"
                placeholderTextColor={colors.placeholder}
              />
            ) : (
              <Text style={styles.teamName}>{team.name}</Text>
            )}
            {isOwner && (
              <View style={styles.ownerBadge}>
                <Text style={styles.ownerBadgeText}>OWNER</Text>
              </View>
            )}
          </View>

          {isEditing ? (
            <>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>DESCRIPTION</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={editDescription}
                  onChangeText={setEditDescription}
                  placeholder="Add a description..."
                  placeholderTextColor={colors.placeholder}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>SPORT</Text>
                <View style={styles.sportGrid}>
                  {SPORTS.map((s) => (
                    <TouchableOpacity
                      key={s.id}
                      style={[styles.sportOption, editSport === s.id && styles.sportOptionSelected]}
                      onPress={() => setEditSport(s.id)}
                    >
                      <Text style={styles.sportIcon}>{s.icon}</Text>
                      <Text style={[styles.sportLabel, editSport === s.id && styles.sportLabelSelected]}>
                        {s.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
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
              {team.description ? (
                <View style={styles.descriptionCard}>
                  <Text style={styles.descriptionText}>{team.description}</Text>
                </View>
              ) : null}

              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{team.member_count}</Text>
                  <Text style={styles.statLabel}>Members</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{team.sport}</Text>
                  <Text style={styles.statLabel}>Sport</Text>
                </View>
              </View>
            </>
          )}

          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>MEMBERS ({team.members.length})</Text>
              {isOwner && !showAddMember && (
                <TouchableOpacity onPress={() => setShowAddMember(true)}>
                  <Text style={styles.addMemberLink}>+ Add</Text>
                </TouchableOpacity>
              )}
            </View>

            {showAddMember && isOwner && (
              <View style={styles.addMemberCard}>
                <View style={styles.searchContainer}>
                  <View style={styles.searchRow}>
                    <TextInput
                      style={styles.searchInput}
                      value={searchQuery}
                      onChangeText={(text) => {
                        setSearchQuery(text);
                        if (searchTimeoutRef.current) {
                          clearTimeout(searchTimeoutRef.current);
                        }
                        if (text.length >= 2) {
                          setIsSearching(true);
                          searchTimeoutRef.current = setTimeout(async () => {
                            try {
                              const results = await searchUsers({ q: text.trim(), limit: 10 });
                              const memberIds = new Set(team?.members.map((m) => m.id) ?? []);
                              const filtered = results.results.filter((u) => !memberIds.has(u.id));
                              setSearchResults(filtered);
                            } catch (error) {
                              console.error("Search failed:", error);
                            } finally {
                              setIsSearching(false);
                            }
                          }, 300);
                        } else {
                          setSearchResults([]);
                          setIsSearching(false);
                        }
                      }}
                      placeholder="Search users by name or email..."
                      placeholderTextColor={colors.placeholder}
                      returnKeyType="search"
                      autoFocus
                    />
                    {isSearching && (
                      <View style={styles.searchSpinner}>
                        <ActivityIndicator size="small" color={colors.accent} />
                      </View>
                    )}
                  </View>

                  {searchResults.length > 0 && (
                    <View style={styles.floatingResults}>
                      {searchResults.map((userResult) => (
                        <TouchableOpacity
                          key={userResult.id}
                          style={styles.floatingResultItem}
                          onPress={() => handleAddMember(userResult.id)}
                          disabled={addingUserId === userResult.id}
                        >
                          <View style={styles.userAvatar}>
                            <Text style={styles.userAvatarText}>
                              {userResult.name.charAt(0).toUpperCase()}
                            </Text>
                          </View>
                          <View style={styles.userInfo}>
                            <Text style={styles.userName}>{userResult.name}</Text>
                            <Text style={styles.userEmail}>{userResult.email}</Text>
                          </View>
                          {addingUserId === userResult.id ? (
                            <ActivityIndicator size="small" color={colors.accent} />
                          ) : (
                            <View style={styles.addIconButton}>
                              <Text style={styles.addIconText}>+</Text>
                            </View>
                          )}
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  {searchQuery.length >= 2 && searchResults.length === 0 && !isSearching && (
                    <View style={styles.floatingResults}>
                      <View style={styles.noResultsItem}>
                        <Text style={styles.noResultsText}>No users found</Text>
                      </View>
                    </View>
                  )}
                </View>

                <TouchableOpacity
                  style={styles.cancelAddButton}
                  onPress={() => {
                    setShowAddMember(false);
                    setSearchQuery("");
                    setSearchResults([]);
                  }}
                >
                  <Text style={styles.cancelAddButtonText}>Done</Text>
                </TouchableOpacity>
              </View>
            )}

            {team.members.map((member) => (
              <View key={member.id} style={styles.memberCard}>
                <View style={styles.memberAvatar}>
                  <Text style={styles.memberAvatarText}>
                    {member.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.memberInfo}>
                  <View style={styles.memberNameRow}>
                    <Text style={styles.memberName}>{member.name}</Text>
                    {member.id === team.owner.id && (
                      <View style={styles.ownerTag}>
                        <Text style={styles.ownerTagText}>Owner</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.memberEmail}>{member.email}</Text>
                </View>
                {isOwner && member.id !== team.owner.id && (
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => handleRemoveMember(member.id, member.name)}
                    disabled={removingUserId === member.id}
                  >
                    {removingUserId === member.id ? (
                      <ActivityIndicator size="small" color={colors.error} />
                    ) : (
                      <Text style={styles.removeButtonText}>✕</Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>

          {isOwner && (
            <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteTeam}>
              <Text style={styles.deleteButtonText}>Delete Team</Text>
            </TouchableOpacity>
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
  backButtonText: { fontSize: 28, color: colors.textInverse, fontWeight: "300" },
  headerTitle: { fontSize: 20, fontWeight: "700", color: colors.textInverse },
  editButton: { paddingHorizontal: 12, paddingVertical: 6 },
  editButtonText: { fontSize: 16, color: colors.accent, fontWeight: "600" },
  cancelButton: { paddingHorizontal: 12, paddingVertical: 6 },
  cancelButtonText: { fontSize: 16, color: colors.textInverse, fontWeight: "600" },
  headerSpacer: { width: 40 },
  keyboardView: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { padding: 20 },
  teamHeader: { alignItems: "center", marginBottom: 24 },
  teamIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.card,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  teamIconText: { fontSize: 40 },
  teamName: { fontSize: 24, fontWeight: "800", color: colors.text, marginBottom: 8, textAlign: "center" },
  editNameInput: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.text,
    textAlign: "center",
    backgroundColor: colors.card,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    minWidth: 200,
  },
  ownerBadge: { backgroundColor: colors.accent, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  ownerBadgeText: { fontSize: 11, fontWeight: "700", color: colors.textInverse, letterSpacing: 0.5 },
  descriptionCard: { backgroundColor: colors.card, borderRadius: 12, padding: 16, marginBottom: 20 },
  descriptionText: { fontSize: 15, color: colors.text, lineHeight: 22 },
  statsRow: { flexDirection: "row", marginBottom: 24 },
  statItem: { flex: 1, backgroundColor: colors.card, borderRadius: 12, padding: 20, alignItems: "center", marginHorizontal: 4 },
  statValue: { fontSize: 24, fontWeight: "800", color: colors.text, marginBottom: 4 },
  statLabel: { fontSize: 12, color: colors.textMuted, textTransform: "uppercase" },
  section: { marginBottom: 24 },
  sectionHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  sectionTitle: { fontSize: 12, fontWeight: "700", color: colors.textMuted, letterSpacing: 1 },
  addMemberLink: { fontSize: 14, color: colors.accent, fontWeight: "600" },
  input: { backgroundColor: colors.inputBackground, borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 12, padding: 16, fontSize: 16, color: colors.inputText },
  textArea: { minHeight: 100, paddingTop: 16 },
  sportGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  sportOption: { width: "30%", backgroundColor: colors.card, borderWidth: 2, borderColor: colors.inputBorder, borderRadius: 12, padding: 12, alignItems: "center" },
  sportOptionSelected: { borderColor: colors.accent, backgroundColor: "rgba(232,106,51,0.1)" },
  sportIcon: { fontSize: 24, marginBottom: 6 },
  sportLabel: { fontSize: 11, fontWeight: "600", color: colors.textMuted },
  sportLabelSelected: { color: colors.accent },
  saveButton: { backgroundColor: colors.accent, borderRadius: 12, padding: 16, alignItems: "center", marginTop: 8 },
  saveButtonDisabled: { opacity: 0.7 },
  saveButtonText: { fontSize: 16, fontWeight: "700", color: colors.textInverse, letterSpacing: 1 },
  addMemberCard: { backgroundColor: colors.card, borderRadius: 12, padding: 16, marginBottom: 16, zIndex: 100 },
  searchContainer: { position: "relative", zIndex: 100 },
  searchRow: { flexDirection: "row", alignItems: "center", zIndex: 1 },
  searchInput: { flex: 1, backgroundColor: colors.inputBackground, borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 8, padding: 12, paddingRight: 40, fontSize: 14, color: colors.inputText },
  searchSpinner: { position: "absolute", right: 12, top: 12 },
  floatingResults: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: 12,
    marginTop: 8,
    maxHeight: 240,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 8,
  },
  floatingResultItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.inputBorder,
  },
  noResultsItem: { padding: 16, alignItems: "center" },
  noResultsText: { fontSize: 14, color: colors.textMuted },
  userAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary, justifyContent: "center", alignItems: "center", marginRight: 10 },
  userAvatarText: { fontSize: 14, fontWeight: "700", color: colors.textInverse },
  userInfo: { flex: 1 },
  userName: { fontSize: 14, fontWeight: "600", color: colors.text },
  userEmail: { fontSize: 12, color: colors.textMuted },
  addIconButton: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.accent, justifyContent: "center", alignItems: "center" },
  addIconText: { fontSize: 20, fontWeight: "700", color: colors.textInverse, marginTop: -2 },
  cancelAddButton: { marginTop: 12, alignItems: "center" },
  cancelAddButtonText: { fontSize: 14, color: colors.accent, fontWeight: "600" },
  memberCard: { flexDirection: "row", alignItems: "center", backgroundColor: colors.card, borderRadius: 12, padding: 14, marginBottom: 10 },
  memberAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, justifyContent: "center", alignItems: "center", marginRight: 12 },
  memberAvatarText: { fontSize: 18, fontWeight: "700", color: colors.textInverse },
  memberInfo: { flex: 1 },
  memberNameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  memberName: { fontSize: 16, fontWeight: "600", color: colors.text },
  memberEmail: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  ownerTag: { backgroundColor: colors.accent, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  ownerTagText: { fontSize: 10, fontWeight: "600", color: colors.textInverse },
  removeButton: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.borderLight, justifyContent: "center", alignItems: "center" },
  removeButtonText: { fontSize: 14, color: colors.error },
  deleteButton: { borderWidth: 1, borderColor: colors.error, borderRadius: 12, padding: 16, alignItems: "center", marginTop: 16 },
  deleteButtonText: { fontSize: 16, fontWeight: "600", color: colors.error },
  bottomSpacer: { height: 40 },
  });
}
