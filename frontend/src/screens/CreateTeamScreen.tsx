import { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useMemo, useState } from "react";
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

import { createTeam, getApiErrorMessage } from "../api/client";
import { useTheme, ThemeColors } from "../theme";
import { RootStackParamList } from "../types";

type Props = NativeStackScreenProps<RootStackParamList, "CreateTeam">;

interface TeamMember {
  id: string;
  name: string;
  email: string;
}

const SPORTS = [
  { id: "soccer", label: "Soccer", icon: "⚽" },
  { id: "basketball", label: "Basketball", icon: "🏀" },
  { id: "football", label: "Football", icon: "🏈" },
  { id: "volleyball", label: "Volleyball", icon: "🏐" },
  { id: "baseball", label: "Baseball", icon: "⚾" },
  { id: "tennis", label: "Tennis", icon: "🎾" },
];

export default function CreateTeamScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [teamName, setTeamName] = useState("");
  const [description, setDescription] = useState("");
  const [sport, setSport] = useState("soccer");
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);

  function handleAddMember() {
    if (!newMemberName.trim()) {
      Alert.alert("Error", "Please enter a name for the team member.");
      return;
    }

    const newMember: TeamMember = {
      id: Date.now().toString(),
      name: newMemberName.trim(),
      email: newMemberEmail.trim(),
    };

    setMembers([...members, newMember]);
    setNewMemberName("");
    setNewMemberEmail("");
    setShowAddMember(false);
  }

  function handleRemoveMember(id: string) {
    setMembers(members.filter((m) => m.id !== id));
  }

  async function handleCreateTeam() {
    if (!teamName.trim()) {
      Alert.alert("Error", "Please enter a team name.");
      return;
    }

    setIsSubmitting(true);

    try {
      await createTeam({
        name: teamName.trim(),
        description: description.trim() || undefined,
        sport: sport,
      });

      Alert.alert("Success", `Team "${teamName}" created successfully!`, [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      const message = getApiErrorMessage(error, "Failed to create team. Please try again.");
      Alert.alert("Error", message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Team</Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>TEAM INFO</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Team Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter team name"
                placeholderTextColor={colors.placeholder}
                value={teamName}
                onChangeText={setTeamName}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Describe your team..."
                placeholderTextColor={colors.placeholder}
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Primary Sport</Text>
              <View style={styles.sportGrid}>
                {SPORTS.map((s) => (
                  <TouchableOpacity
                    key={s.id}
                    style={[styles.sportOption, sport === s.id && styles.sportOptionSelected]}
                    onPress={() => setSport(s.id)}
                  >
                    <Text style={styles.sportIcon}>{s.icon}</Text>
                    <Text style={[styles.sportLabel, sport === s.id && styles.sportLabelSelected]}>
                      {s.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>TEAM MEMBERS</Text>
              <Text style={styles.memberCount}>{members.length} added</Text>
            </View>

            {members.length > 0 && (
              <View style={styles.membersList}>
                {members.map((member) => (
                  <View key={member.id} style={styles.memberCard}>
                    <View style={styles.memberAvatar}>
                      <Text style={styles.memberAvatarText}>
                        {member.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.memberInfo}>
                      <Text style={styles.memberName}>{member.name}</Text>
                      {member.email ? (
                        <Text style={styles.memberEmail}>{member.email}</Text>
                      ) : null}
                    </View>
                    <TouchableOpacity
                      style={styles.removeButton}
                      onPress={() => handleRemoveMember(member.id)}
                    >
                      <Text style={styles.removeButtonText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {showAddMember ? (
              <View style={styles.addMemberForm}>
                <TextInput
                  style={styles.input}
                  placeholder="Member name *"
                  placeholderTextColor={colors.placeholder}
                  value={newMemberName}
                  onChangeText={setNewMemberName}
                />
                <TextInput
                  style={[styles.input, { marginTop: 12 }]}
                  placeholder="Email (optional)"
                  placeholderTextColor={colors.placeholder}
                  value={newMemberEmail}
                  onChangeText={setNewMemberEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <View style={styles.addMemberActions}>
                  <TouchableOpacity
                    style={styles.cancelAddButton}
                    onPress={() => {
                      setShowAddMember(false);
                      setNewMemberName("");
                      setNewMemberEmail("");
                    }}
                  >
                    <Text style={styles.cancelAddButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.confirmAddButton} onPress={handleAddMember}>
                    <Text style={styles.confirmAddButtonText}>Add Member</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.addMemberButton}
                onPress={() => setShowAddMember(true)}
              >
                <Text style={styles.addMemberIcon}>+</Text>
                <Text style={styles.addMemberText}>Add Team Member</Text>
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            style={[styles.createButton, isSubmitting && styles.createButtonDisabled]}
            onPress={handleCreateTeam}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color={colors.textInverse} />
            ) : (
              <Text style={styles.createButtonText}>CREATE TEAM</Text>
            )}
          </TouchableOpacity>

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: colors.headerBackground,
      paddingTop: Platform.OS === "ios" ? 60 : 40,
      paddingBottom: 20,
      paddingHorizontal: 20,
    },
    backButton: { width: 40, height: 40, justifyContent: "center", alignItems: "center" },
    backButtonText: { fontSize: 28, color: colors.headerText, fontWeight: "300" },
    headerTitle: { fontSize: 20, fontWeight: "700", color: colors.headerText },
    headerSpacer: { width: 40 },
    keyboardView: { flex: 1 },
    scrollView: { flex: 1 },
    scrollContent: { padding: 20 },
    section: { marginBottom: 32 },
    sectionTitle: { fontSize: 12, fontWeight: "700", color: colors.textMuted, letterSpacing: 1, marginBottom: 16 },
    sectionHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
    memberCount: { fontSize: 12, color: colors.accent, fontWeight: "600" },
    inputGroup: { marginBottom: 20 },
    label: { fontSize: 14, fontWeight: "600", color: colors.text, marginBottom: 8 },
    input: {
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      borderRadius: 12,
      padding: 16,
      fontSize: 16,
      color: colors.inputText,
    },
    textArea: { minHeight: 100, paddingTop: 16 },
    sportGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
    sportOption: {
      width: "30%",
      backgroundColor: colors.card,
      borderWidth: 2,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 16,
      alignItems: "center",
    },
    sportOptionSelected: { borderColor: colors.accent, backgroundColor: "rgba(232,106,51,0.1)" },
    sportIcon: { fontSize: 28, marginBottom: 8 },
    sportLabel: { fontSize: 12, fontWeight: "600", color: colors.textMuted },
    sportLabelSelected: { color: colors.accent },
    membersList: { marginBottom: 16 },
    memberCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
    },
    memberAvatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.primary,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 12,
    },
    memberAvatarText: { fontSize: 18, fontWeight: "700", color: colors.textInverse },
    memberInfo: { flex: 1 },
    memberName: { fontSize: 16, fontWeight: "600", color: colors.text },
    memberEmail: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
    removeButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.borderLight,
      justifyContent: "center",
      alignItems: "center",
    },
    removeButtonText: { fontSize: 14, color: colors.textMuted },
    addMemberButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.card,
      borderWidth: 2,
      borderColor: colors.border,
      borderStyle: "dashed",
      borderRadius: 12,
      padding: 20,
    },
    addMemberIcon: { fontSize: 24, color: colors.accent, marginRight: 10 },
    addMemberText: { fontSize: 16, fontWeight: "600", color: colors.text },
    addMemberForm: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
    },
    addMemberActions: { flexDirection: "row", justifyContent: "flex-end", gap: 12, marginTop: 16 },
    cancelAddButton: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8 },
    cancelAddButtonText: { fontSize: 14, fontWeight: "600", color: colors.textMuted },
    confirmAddButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 8,
    },
    confirmAddButtonText: { fontSize: 14, fontWeight: "700", color: colors.textInverse },
    createButton: {
      backgroundColor: colors.accent,
      borderRadius: 12,
      padding: 18,
      alignItems: "center",
      marginTop: 8,
    },
    createButtonDisabled: { opacity: 0.7 },
    createButtonText: { fontSize: 16, fontWeight: "700", color: colors.textInverse, letterSpacing: 1 },
    bottomSpacer: { height: 40 },
  });
}
