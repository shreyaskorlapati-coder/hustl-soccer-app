import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { useAuth } from "../context/AuthContext";
import { useTheme, Colors } from "../theme";
import { RootStackParamList } from "../types";

export default function ProfileScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user, logout } = useAuth();
  const { colors, isDark, themeMode, setThemeMode, toggleTheme } = useTheme();

  const initials = user?.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) ?? "?";

  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      })
    : "Unknown";

  const themeLabel = themeMode === "system" ? "System" : themeMode === "dark" ? "Dark" : "Light";

  function handleLogout() {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      { text: "Logout", style: "destructive", onPress: logout },
    ]);
  }

  function handleThemePress() {
    Alert.alert(
      "Choose Theme",
      "Select your preferred appearance",
      [
        { text: "Light", onPress: () => setThemeMode("light") },
        { text: "Dark", onPress: () => setThemeMode("dark") },
        { text: "System", onPress: () => setThemeMode("system") },
        { text: "Cancel", style: "cancel" },
      ]
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.headerBackground }]}>
        <View style={styles.avatarContainer}>
          <View style={[styles.avatar, { backgroundColor: colors.accent, borderColor: colors.textInverse }]}>
            <Text style={[styles.avatarText, { color: colors.textInverse }]}>{initials}</Text>
          </View>
          <View style={[styles.onlineIndicator, { borderColor: colors.headerBackground }]} />
        </View>
        <Text style={[styles.userName, { color: colors.textInverse }]}>{user?.name ?? "User"}</Text>
        <Text style={[styles.userEmail, { color: colors.textInverse }]}>{user?.email ?? ""}</Text>
        {user?.phone && <Text style={[styles.userPhone, { color: colors.textInverse }]}>📱 {user.phone}</Text>}
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>ACCOUNT</Text>

          <TouchableOpacity
            style={[styles.menuItem, { backgroundColor: colors.card }]}
            onPress={() => navigation.navigate("EditProfile")}
          >
            <Text style={styles.menuIcon}>👤</Text>
            <View style={styles.menuContent}>
              <Text style={[styles.menuLabel, { color: colors.text }]}>Edit Profile</Text>
              <Text style={[styles.menuValue, { color: colors.textMuted }]}>Update your information</Text>
            </View>
            <Text style={[styles.menuArrow, { color: colors.textMuted }]}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>PREFERENCES</Text>

          <TouchableOpacity
            style={[styles.menuItem, { backgroundColor: colors.card }]}
            onPress={() => navigation.navigate("EditFavoriteSports")}
          >
            <Text style={styles.menuIcon}>⚽</Text>
            <View style={styles.menuContent}>
              <Text style={[styles.menuLabel, { color: colors.text }]}>Favorite Sports</Text>
              <Text style={[styles.menuValue, { color: colors.textMuted }]}>
                {user?.favorite_sports && user.favorite_sports.length > 0
                  ? user.favorite_sports.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(", ")
                  : "None selected"}
              </Text>
            </View>
            <Text style={[styles.menuArrow, { color: colors.textMuted }]}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuItem, { backgroundColor: colors.card }]}
            onPress={handleThemePress}
          >
            <Text style={styles.menuIcon}>{isDark ? "🌙" : "☀️"}</Text>
            <View style={styles.menuContent}>
              <Text style={[styles.menuLabel, { color: colors.text }]}>Appearance</Text>
              <Text style={[styles.menuValue, { color: colors.textMuted }]}>{themeLabel} mode</Text>
            </View>
            <Text style={[styles.menuArrow, { color: colors.textMuted }]}>›</Text>
          </TouchableOpacity>

          <View style={[styles.menuItem, { backgroundColor: colors.card }]}>
            <Text style={styles.menuIcon}>🌓</Text>
            <View style={styles.menuContent}>
              <Text style={[styles.menuLabel, { color: colors.text }]}>Dark Mode</Text>
              <Text style={[styles.menuValue, { color: colors.textMuted }]}>Quick toggle</Text>
            </View>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.textInverse}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>SUPPORT</Text>

          <TouchableOpacity
            style={[styles.menuItem, { backgroundColor: colors.card }]}
            onPress={() => navigation.navigate("ContactUs")}
          >
            <Text style={styles.menuIcon}>💬</Text>
            <View style={styles.menuContent}>
              <Text style={[styles.menuLabel, { color: colors.text }]}>Contact Us</Text>
              <Text style={[styles.menuValue, { color: colors.textMuted }]}>Get in touch</Text>
            </View>
            <Text style={[styles.menuArrow, { color: colors.textMuted }]}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuItem, { backgroundColor: colors.card }]}
            onPress={() => navigation.navigate("TermsPrivacy")}
          >
            <Text style={styles.menuIcon}>📄</Text>
            <View style={styles.menuContent}>
              <Text style={[styles.menuLabel, { color: colors.text }]}>Terms & Privacy</Text>
              <Text style={[styles.menuValue, { color: colors.textMuted }]}>Legal information</Text>
            </View>
            <Text style={[styles.menuArrow, { color: colors.textMuted }]}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.memberInfo}>
          <Text style={[styles.memberText, { color: colors.textMuted }]}>Member since {memberSince}</Text>
          <Text style={[styles.versionText, { color: colors.textMuted }]}>Hustl v1.0.0</Text>
        </View>

        <TouchableOpacity style={[styles.logoutButton, { backgroundColor: colors.card, borderColor: Colors.error }]} onPress={handleLogout}>
          <Text style={styles.logoutIcon}>🚪</Text>
          <Text style={[styles.logoutText, { color: Colors.error }]}>Logout</Text>
        </TouchableOpacity>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingTop: 60,
    paddingBottom: 30,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  avatarContainer: { position: "relative", marginBottom: 16 },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
  },
  avatarText: { fontSize: 32, fontWeight: "800" },
  onlineIndicator: {
    position: "absolute",
    bottom: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#4CAF50",
    borderWidth: 3,
  },
  userName: { fontSize: 24, fontWeight: "700", marginBottom: 4 },
  userEmail: { fontSize: 14, opacity: 0.7 },
  userPhone: { fontSize: 14, opacity: 0.7, marginTop: 4 },
  scrollView: { flex: 1 },
  scrollContent: { padding: 20 },
  section: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 12,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  menuIcon: { fontSize: 24, marginRight: 14 },
  menuContent: { flex: 1 },
  menuLabel: { fontSize: 16, fontWeight: "600", marginBottom: 2 },
  menuValue: { fontSize: 13 },
  menuArrow: { fontSize: 24, fontWeight: "300" },
  memberInfo: { alignItems: "center", marginTop: 8, marginBottom: 20 },
  memberText: { fontSize: 13 },
  versionText: { fontSize: 12, marginTop: 4, opacity: 0.7 },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
  },
  logoutIcon: { fontSize: 20, marginRight: 10 },
  logoutText: { fontSize: 16, fontWeight: "600" },
  bottomSpacer: { height: 40 },
});
