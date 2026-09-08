import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import {
  NavigationContainer,
  DefaultTheme,
  DarkTheme as NavDarkTheme,
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React, { useMemo } from "react";
import { Platform, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "../context/AuthContext";
import CreateGameScreen from "../screens/CreateGameScreen";
import PickMapLocationScreen from "../screens/PickMapLocationScreen";
import CreateTeamScreen from "../screens/CreateTeamScreen";
import CreateTournamentScreen from "../screens/CreateTournamentScreen";
import EditFavoriteSportsScreen from "../screens/EditFavoriteSportsScreen";
import EditProfileScreen from "../screens/EditProfileScreen";
import GamesScreen from "../screens/GamesScreen";
import HomeDashboardScreen from "../screens/HomeDashboardScreen";
import ForgotPasswordScreen from "../screens/ForgotPasswordScreen";
import LoginScreen from "../screens/LoginScreen";
import MapScreen from "../screens/MapScreen";
import ResetPasswordScreen from "../screens/ResetPasswordScreen";
// Notifications disabled
// import NotificationsScreen from "../screens/NotificationsScreen";
// import NotificationSettingsScreen from "../screens/NotificationSettingsScreen";
import PlacesScreen from "../screens/PlacesScreen";
import ProfileScreen from "../screens/ProfileScreen";
import ResultsScreen from "../screens/ResultsScreen";
import SignupScreen from "../screens/SignupScreen";
import GameDetailsScreen from "../screens/GameDetailsScreen";
import TeamDetailsScreen from "../screens/TeamDetailsScreen";
import TeamsScreen from "../screens/TeamsScreen";
import TournamentsScreen from "../screens/TournamentsScreen";
import TournamentDetailsScreen from "../screens/TournamentDetailsScreen";
import CreateTournamentGamesScreen from "../screens/CreateTournamentGamesScreen";
import ContactUsScreen from "../screens/ContactUsScreen";
import TermsPrivacyScreen from "../screens/TermsPrivacyScreen";
import { useTheme } from "../theme";
import { MainTabParamList, RootStackParamList } from "../types";

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

function AuthStack() {
  return (
    <Stack.Navigator initialRouteName="Login" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Signup" component={SignupScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
    </Stack.Navigator>
  );
}

function TabIcon({ icon, focused }: Readonly<{ icon: string; focused: boolean }>) {
  return <Text style={{ fontSize: 24, opacity: focused ? 1 : 0.5 }}>{icon}</Text>;
}

function MainTabs() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const tabBarHeight = 60 + Math.max(insets.bottom, Platform.OS === "android" ? 10 : 0);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.tabBarBackground,
          borderTopColor: colors.tabBarBorder,
          borderTopWidth: 1,
          height: tabBarHeight,
          paddingTop: 8,
          paddingBottom: Math.max(insets.bottom, Platform.OS === "android" ? 10 : 0),
        },
        tabBarActiveTintColor: colors.tabActive,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
          letterSpacing: 0.5,
          marginTop: 2,
        },
      }}
    >
      <Tab.Screen
        name="HomeDashboard"
        component={HomeDashboardScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon icon="🏠" focused={focused} />,
          tabBarLabel: "HOME",
        }}
      />
      <Tab.Screen
        name="Games"
        component={GamesScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon icon="🏟️" focused={focused} />,
          tabBarLabel: "GAMES",
        }}
      />
      <Tab.Screen
        name="Tournaments"
        component={TournamentsScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon icon="🏆" focused={focused} />,
          tabBarLabel: "TOURNEYS",
        }}
      />
      <Tab.Screen
        name="Teams"
        component={TeamsScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon icon="👥" focused={focused} />,
          tabBarLabel: "TEAMS",
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon icon="👤" focused={focused} />,
          tabBarLabel: "ME",
        }}
      />
    </Tab.Navigator>
  );
}

function AppStack() {
  const { colors } = useTheme();

  return (
    <Stack.Navigator
      initialRouteName="Home"
      screenOptions={{
        headerStyle: { backgroundColor: colors.headerBackground },
        headerTintColor: colors.headerText,
        headerTitleStyle: { fontWeight: "700" },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="Home" component={MainTabs} options={{ headerShown: false }} />
      <Stack.Screen name="CreateGame" component={CreateGameScreen} options={{ headerShown: false }} />
      <Stack.Screen name="PickMapLocation" component={PickMapLocationScreen} options={{ headerShown: false }} />
      <Stack.Screen name="CreateTeam" component={CreateTeamScreen} options={{ headerShown: false }} />
      <Stack.Screen name="CreateTournament" component={CreateTournamentScreen} options={{ headerShown: false }} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ headerShown: false }} />
      <Stack.Screen name="EditFavoriteSports" component={EditFavoriteSportsScreen} options={{ headerShown: false }} />
      <Stack.Screen name="GameDetails" component={GameDetailsScreen} options={{ headerShown: false }} />
      <Stack.Screen name="TeamDetails" component={TeamDetailsScreen} options={{ headerShown: false }} />
      <Stack.Screen name="TournamentDetails" component={TournamentDetailsScreen} options={{ headerShown: false }} />
      <Stack.Screen name="CreateTournamentGames" component={CreateTournamentGamesScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ContactUs" component={ContactUsScreen} options={{ headerShown: false }} />
      <Stack.Screen name="TermsPrivacy" component={TermsPrivacyScreen} options={{ headerShown: false }} />
      {/* Notifications disabled */}
      <Stack.Screen name="Results" component={ResultsScreen} options={{ title: "Nearby Facilities" }} />
      <Stack.Screen name="Map" component={MapScreen} options={{ title: "Map View" }} />
    </Stack.Navigator>
  );
}

export default function AppNavigator() {
  const { isAuthenticated } = useAuth();
  const { colors, isDark } = useTheme();

  const navigationTheme = useMemo(
    () => ({
      ...(isDark ? NavDarkTheme : DefaultTheme),
      colors: {
        ...(isDark ? NavDarkTheme.colors : DefaultTheme.colors),
        background: colors.background,
        card: colors.headerBackground,
        text: colors.text,
        border: colors.border,
        primary: colors.accent,
      },
    }),
    [colors, isDark]
  );

  return (
    <NavigationContainer theme={navigationTheme}>
      {isAuthenticated ? <AppStack /> : <AuthStack />}
    </NavigationContainer>
  );
}

