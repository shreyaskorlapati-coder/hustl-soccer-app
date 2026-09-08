import axios from "axios";
import type { AxiosError } from "axios";
import Constants from "expo-constants";

import {
  AuthResponse,
  CreateGameData,
  Game,
  GamesResponse,
  GeocodeResult,
  GoogleAuthData,
  LoginData,
  PlacesResponse,
  SignupData,
  Sport,
} from "../types";

function resolveApiBaseUrl(): string {
  const envApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (envApiUrl) {
    return envApiUrl;
  }

  const configuredApiUrl = (Constants.expoConfig?.extra?.apiUrl as string | undefined)?.trim();
  const configuredUsesLocalhost =
    configuredApiUrl?.includes("localhost") || configuredApiUrl?.includes("127.0.0.1");

  const expoConfigWithHost = Constants.expoConfig as
    | (typeof Constants.expoConfig & { hostUri?: string })
    | null;
  const hostUri = expoConfigWithHost?.hostUri;
  if (hostUri) {
    const [host] = hostUri.split(":");
    if (host && configuredUsesLocalhost) {
      return `http://${host}:8000`;
    }
  }

  return configuredApiUrl ?? "http://localhost:8000";
}

const API_BASE_URL = resolveApiBaseUrl();

console.log("[API] Base URL:", API_BASE_URL);

const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

client.interceptors.request.use(
  (config) => {
    console.log(
      `[API Request] ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`,
      {
        params: config.params,
        data: config.data,
        headers: config.headers,
      }
    );
    return config;
  },
  (error) => {
    console.error("[API Request Error]", error);
    return Promise.reject(error);
  }
);

client.interceptors.response.use(
  (response) => {
    console.log(
      `[API Response] ${response.status} ${response.config.method?.toUpperCase()} ${response.config.url}`,
      {
        data: response.data,
      }
    );
    return response;
  },
  (error) => {
    console.error(
      `[API Response Error] ${error.response?.status || "Network Error"} ${error.config?.method?.toUpperCase()} ${error.config?.url}`,
      {
        message: error.message,
        data: error.response?.data,
      }
    );
    
    if (error.response?.status === 401 && onUnauthorizedCallback) {
      console.log("[API] Token expired or invalid, triggering logout");
      onUnauthorizedCallback();
    }
    
    return Promise.reject(error);
  }
);

let onUnauthorizedCallback: (() => void) | null = null;

export function setOnUnauthorized(callback: (() => void) | null): void {
  onUnauthorizedCallback = callback;
}

export function setAuthToken(token: string | null): void {
  if (token) {
    client.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  } else {
    delete client.defaults.headers.common["Authorization"];
  }
}

export async function signup(data: SignupData): Promise<AuthResponse> {
  const { data: response } = await client.post<AuthResponse>("/auth/signup", data);
  return response;
}

export async function login(data: LoginData): Promise<AuthResponse> {
  const { data: response } = await client.post<AuthResponse>("/auth/login", data);
  return response;
}

export async function googleAuth(data: GoogleAuthData): Promise<AuthResponse> {
  const { data: response } = await client.post<AuthResponse>("/auth/google", data);
  return response;
}

export async function forgotPassword(email: string): Promise<{ message: string }> {
  const { data } = await client.post<{ message: string }>("/auth/forgot-password", { email });
  return data;
}

export async function resetPassword(
  email: string,
  code: string,
  new_password: string
): Promise<{ message: string }> {
  const { data } = await client.post<{ message: string }>("/auth/reset-password", {
    email,
    code,
    new_password,
  });
  return data;
}

export async function geocodeLocation(query: string): Promise<GeocodeResult> {
  const { data } = await client.get<GeocodeResult>("/geocode", {
    params: { q: query },
  });
  return data;
}

export async function searchPlaces(
  lat: number,
  lon: number,
  sport: Sport,
  radius: number
): Promise<PlacesResponse> {
  const { data } = await client.get<PlacesResponse>("/places", {
    params: { lat, lon, sport, radius },
  });
  return data;
}

export async function createGame(data: CreateGameData): Promise<Game> {
  const { data: response } = await client.post<Game>("/api/games", data);
  return response;
}

export async function listGames(params?: {
  skip?: number;
  limit?: number;
  sport?: string;
  status?: string;
  upcoming_only?: boolean;
}): Promise<GamesResponse> {
  const { data } = await client.get<GamesResponse>("/api/games", { params });
  return data;
}

export async function getMyCreatedGames(params?: {
  skip?: number;
  limit?: number;
  sport?: string;
  status?: string;
  upcoming_only?: boolean;
}): Promise<GamesResponse> {
  const { data } = await client.get<GamesResponse>("/api/games/my-created-games", { params });
  return data;
}

export async function getMyJoinedGames(params?: {
  skip?: number;
  limit?: number;
  sport?: string;
  status?: string;
  upcoming_only?: boolean;
}): Promise<GamesResponse> {
  const { data } = await client.get<GamesResponse>("/api/games/my-joined-games", { params });
  return data;
}

export async function getGame(gameId: string): Promise<Game> {
  const { data } = await client.get<Game>(`/api/games/${gameId}`);
  return data;
}

export interface UpdateGameData {
  location?: string;
  players_needed?: number;
  skill_level?: string;
  description?: string;
  status?: string;
}

export async function updateGame(gameId: string, data: UpdateGameData): Promise<Game> {
  const { data: response } = await client.put<Game>(`/api/games/${gameId}`, data);
  return response;
}

export async function joinGame(gameId: string): Promise<Game> {
  const { data } = await client.post<Game>(`/api/games/${gameId}/join`);
  return data;
}

export async function leaveGame(gameId: string): Promise<Game> {
  const { data } = await client.post<Game>(`/api/games/${gameId}/leave`);
  return data;
}

export interface AddGoalData {
  team_id: string;
  scorer_id: string;
  minute?: number;
}

export async function addGoal(gameId: string, data: AddGoalData): Promise<Game> {
  const { data: response } = await client.post<Game>(`/api/games/${gameId}/goals`, data);
  return response;
}

export async function deleteGoal(gameId: string, goalId: string): Promise<Game> {
  const { data } = await client.delete<Game>(`/api/games/${gameId}/goals/${goalId}`);
  return data;
}

export async function deleteGame(gameId: string): Promise<void> {
  await client.delete(`/api/games/${gameId}`);
}

export interface CreatePlaceData {
  name: string;
  lat: number;
  lon: number;
  sport?: string;
  address?: string;
  description?: string;
  tags?: Record<string, string>;
}

export interface SavedPlace {
  id: number;
  name: string;
  lat: number;
  lon: number;
  sport: string | null;
  address: string | null;
  description: string | null;
  tags: Record<string, string>;
  created_at: string;
  updated_at: string;
}

export async function createPlace(data: CreatePlaceData): Promise<SavedPlace> {
  const { data: response } = await client.post<SavedPlace>("/api/places", data);
  return response;
}

export interface SavedPlaceWithDistance extends SavedPlace {
  distance_meters: number;
  distance_miles: number;
  distance_km: number;
}

export interface SavedPlacesNearbyResponse {
  count: number;
  results: SavedPlaceWithDistance[];
}

export async function searchSavedPlacesNearby(
  lat: number,
  lon: number,
  sport?: string,
  radiusMeters: number = 10000
): Promise<SavedPlacesNearbyResponse> {
  const { data } = await client.get<SavedPlacesNearbyResponse>("/api/places/nearby", {
    params: { lat, lon, sport, radius_meters: radiusMeters, limit: 20 },
  });
  return data;
}

export async function listSavedPlaces(sport?: string, limit: number = 20): Promise<{ count: number; results: SavedPlace[] }> {
  const { data } = await client.get<{ count: number; results: SavedPlace[] }>("/api/places", {
    params: { sport, limit },
  });
  return data;
}

export async function searchPlacesByName(
  search: string,
  sport?: string,
  limit: number = 10
): Promise<{ count: number; results: SavedPlace[] }> {
  const { data } = await client.get<{ count: number; results: SavedPlace[] }>("/api/places", {
    params: { search, sport, limit },
  });
  return data;
}

export interface TeamOwner {
  id: string;
  name: string;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface Team {
  id: string;
  name: string;
  description: string | null;
  sport: string;
  owner: TeamOwner;
  member_count: number;
  created_at: string;
  updated_at: string;
}

export interface TeamDetail extends Team {
  members: TeamMember[];
}

export interface TeamsResponse {
  count: number;
  results: Team[];
}

export interface CreateTeamData {
  name: string;
  description?: string;
  sport: string;
}

export interface UpdateTeamData {
  name?: string;
  description?: string;
  sport?: string;
}

export interface AddMemberData {
  user_id?: string;
  email?: string;
  name?: string;
  role?: string;
}

export async function createTeam(data: CreateTeamData): Promise<TeamDetail> {
  const { data: response } = await client.post<TeamDetail>("/api/teams", data);
  return response;
}

export async function listTeams(params?: {
  skip?: number;
  limit?: number;
  sport?: string;
}): Promise<TeamsResponse> {
  const { data } = await client.get<TeamsResponse>("/api/teams", { params });
  return data;
}

export async function getMyTeams(params?: {
  skip?: number;
  limit?: number;
}): Promise<TeamsResponse> {
  const { data } = await client.get<TeamsResponse>("/api/teams/my-teams", { params });
  return data;
}

export async function getMyCreatedTeams(params?: {
  skip?: number;
  limit?: number;
}): Promise<TeamsResponse> {
  const { data } = await client.get<TeamsResponse>("/api/teams/my-created-teams", { params });
  return data;
}

export async function getMyJoinedTeams(params?: {
  skip?: number;
  limit?: number;
}): Promise<TeamsResponse> {
  const { data } = await client.get<TeamsResponse>("/api/teams/my-joined-teams", { params });
  return data;
}

export async function getTeam(teamId: string): Promise<TeamDetail> {
  const { data } = await client.get<TeamDetail>(`/api/teams/${teamId}`);
  return data;
}

export async function updateTeam(teamId: string, data: UpdateTeamData): Promise<Team> {
  const { data: response } = await client.put<Team>(`/api/teams/${teamId}`, data);
  return response;
}

export async function addTeamMember(teamId: string, data: AddMemberData): Promise<TeamDetail> {
  const { data: response } = await client.post<TeamDetail>(`/api/teams/${teamId}/members`, data);
  return response;
}

export async function removeTeamMember(teamId: string, userId: string): Promise<TeamDetail> {
  const { data } = await client.delete<TeamDetail>(`/api/teams/${teamId}/members/${userId}`);
  return data;
}

export async function joinTeam(teamId: string): Promise<TeamDetail> {
  const { data } = await client.post<TeamDetail>(`/api/teams/${teamId}/join`);
  return data;
}

export async function leaveTeam(teamId: string): Promise<void> {
  await client.post(`/api/teams/${teamId}/leave`);
}

export async function deleteTeam(teamId: string): Promise<void> {
  await client.delete(`/api/teams/${teamId}`);
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  favorite_sports: string[];
  createdAt: string;
}

export interface UsersResponse {
  count: number;
  results: UserProfile[];
}

export interface UpdateUserData {
  name?: string;
  email?: string;
  phone?: string;
  favorite_sports?: string[];
}

export interface UpdatePasswordData {
  current_password: string;
  new_password: string;
}

export async function searchUsers(params?: {
  q?: string;
  skip?: number;
  limit?: number;
}): Promise<UsersResponse> {
  const { data } = await client.get<UsersResponse>("/api/users", { params });
  return data;
}

export async function getCurrentUser(): Promise<UserProfile> {
  const { data } = await client.get<UserProfile>("/api/users/me");
  return data;
}

export async function getUser(userId: string): Promise<UserProfile> {
  const { data } = await client.get<UserProfile>(`/api/users/${userId}`);
  return data;
}

export async function updateCurrentUser(data: UpdateUserData): Promise<UserProfile> {
  const { data: response } = await client.put<UserProfile>("/api/users/me", data);
  return response;
}

export async function updatePassword(data: UpdatePasswordData): Promise<void> {
  await client.put("/api/users/me/password", data);
}

export async function deleteCurrentUser(): Promise<void> {
  await client.delete("/api/users/me");
}

export async function deleteUser(userId: string): Promise<void> {
  await client.delete(`/api/users/${userId}`);
}

export interface TournamentOrganizer {
  id: string;
  name: string;
}

export interface TournamentTeam {
  id: string;
  name: string;
}

export interface TournamentMatch {
  id: string;
  round_name: string;
  match_number: number;
  team1: TournamentTeam | null;
  team2: TournamentTeam | null;
  team1_score: number | null;
  team2_score: number | null;
  winner: TournamentTeam | null;
  status: string;
  created_at: string;
}

export interface Tournament {
  id: string;
  name: string;
  sport: string;
  description: string | null;
  max_teams: number;
  status: string;
  current_round: string | null;
  organizer: TournamentOrganizer;
  teams: TournamentTeam[];
  team_count: number;
  matches: TournamentMatch[];
  created_at: string;
  updated_at: string;
}

export interface TournamentsResponse {
  count: number;
  results: Tournament[];
}

export interface CreateTournamentData {
  name: string;
  sport: string;
  description?: string;
  max_teams?: number;
}

export interface UpdateTournamentData {
  name?: string;
  description?: string;
  status?: string;
}

export async function createTournament(data: CreateTournamentData): Promise<Tournament> {
  const { data: response } = await client.post<Tournament>("/api/tournaments", data);
  return response;
}

export async function listTournaments(params?: {
  skip?: number;
  limit?: number;
  sport?: string;
  status?: string;
}): Promise<TournamentsResponse> {
  const { data } = await client.get<TournamentsResponse>("/api/tournaments", { params });
  return data;
}

export async function getMyTournaments(params?: {
  skip?: number;
  limit?: number;
}): Promise<TournamentsResponse> {
  const { data } = await client.get<TournamentsResponse>("/api/tournaments/my-tournaments", { params });
  return data;
}

export async function getTournament(tournamentId: string): Promise<Tournament> {
  const { data } = await client.get<Tournament>(`/api/tournaments/${tournamentId}`);
  return data;
}

export async function registerTeamToTournament(tournamentId: string, teamId: string): Promise<Tournament> {
  const { data } = await client.post<Tournament>(`/api/tournaments/${tournamentId}/register`, { team_id: teamId });
  return data;
}

export async function generateBracket(tournamentId: string): Promise<Tournament> {
  const { data } = await client.post<Tournament>(`/api/tournaments/${tournamentId}/generate-bracket`);
  return data;
}

export async function updateMatchScore(
  tournamentId: string,
  matchId: string,
  team1Score: number,
  team2Score: number
): Promise<Tournament> {
  const { data } = await client.put<Tournament>(
    `/api/tournaments/${tournamentId}/matches/${matchId}/score`,
    { team1_score: team1Score, team2_score: team2Score }
  );
  return data;
}

export async function setMatchTeams(
  tournamentId: string,
  matchId: string,
  team1Id?: string,
  team2Id?: string
): Promise<Tournament> {
  const { data } = await client.put<Tournament>(
    `/api/tournaments/${tournamentId}/matches/${matchId}/teams`,
    { team1_id: team1Id, team2_id: team2Id }
  );
  return data;
}

export async function deleteTournament(tournamentId: string): Promise<void> {
  await client.delete(`/api/tournaments/${tournamentId}`);
}

// ============ Notifications ============

export interface DeviceTokenData {
  token: string;
  platform: "ios" | "android" | "web";
  device_name?: string;
}

export interface DeviceToken {
  id: string;
  token: string;
  platform: string;
  device_name: string | null;
  is_active: boolean;
  created_at: string;
}

export interface NotificationPreferences {
  id: string;
  user_id: string;
  game_reminders: boolean;
  game_player_joined: boolean;
  game_player_left: boolean;
  game_cancelled: boolean;
  game_updated: boolean;
  team_invitations: boolean;
  team_member_joined: boolean;
  team_member_left: boolean;
  tournament_updates: boolean;
  tournament_match_reminders: boolean;
  tournament_results: boolean;
  reminder_hours_before: number;
  created_at: string;
  updated_at: string;
}

export interface UpdateNotificationPreferencesData {
  game_reminders?: boolean;
  game_player_joined?: boolean;
  game_player_left?: boolean;
  game_cancelled?: boolean;
  game_updated?: boolean;
  team_invitations?: boolean;
  team_member_joined?: boolean;
  team_member_left?: boolean;
  tournament_updates?: boolean;
  tournament_match_reminders?: boolean;
  tournament_results?: boolean;
  reminder_hours_before?: number;
}

export interface Notification {
  id: string;
  title: string;
  body: string;
  notification_type: string;
  reference_type: string | null;
  reference_id: string | null;
  data: Record<string, unknown> | null;
  is_read: boolean;
  created_at: string;
  read_at: string | null;
}

export interface NotificationsResponse {
  count: number;
  unread_count: number;
  results: Notification[];
}

export async function registerDeviceToken(data: DeviceTokenData): Promise<DeviceToken> {
  const { data: response } = await client.post<DeviceToken>("/api/notifications/device-token", data);
  return response;
}

export async function unregisterDeviceToken(token: string): Promise<void> {
  await client.delete(`/api/notifications/device-token/${encodeURIComponent(token)}`);
}

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  const { data } = await client.get<NotificationPreferences>("/api/notifications/preferences");
  return data;
}

export async function updateNotificationPreferences(
  data: UpdateNotificationPreferencesData
): Promise<NotificationPreferences> {
  const { data: response } = await client.put<NotificationPreferences>(
    "/api/notifications/preferences",
    data
  );
  return response;
}

export async function listNotifications(params?: {
  skip?: number;
  limit?: number;
  unread_only?: boolean;
}): Promise<NotificationsResponse> {
  const { data } = await client.get<NotificationsResponse>("/api/notifications", { params });
  return data;
}

export async function markNotificationsRead(
  notificationIds?: string[],
  markAll: boolean = false
): Promise<void> {
  await client.post("/api/notifications/mark-read", {
    notification_ids: notificationIds,
    mark_all: markAll,
  });
}

export async function getUnreadNotificationCount(): Promise<{ unread_count: number }> {
  const { data } = await client.get<{ unread_count: number }>("/api/notifications/unread-count");
  return data;
}

export async function deleteNotification(notificationId: string): Promise<void> {
  await client.delete(`/api/notifications/${notificationId}`);
}

export async function clearAllNotifications(): Promise<void> {
  await client.delete("/api/notifications");
}

export function getApiErrorMessage(error: unknown, fallbackMessage: string): string {
  const axiosError = error as AxiosError<{ detail?: string }>;
  const detail = axiosError.response?.data?.detail;

  if (typeof detail === "string" && detail.trim().length > 0) {
    return detail;
  }

  if (axiosError.code === "ECONNABORTED") {
    return "The request timed out. Please retry in a moment.";
  }

  if (axiosError.message && axiosError.message.toLowerCase().includes("network error")) {
    return "Network error: could not reach the backend API.";
  }

  return fallbackMessage;
}

// Contact Us
export interface ContactRequest {
  subject: string;
  message: string;
}

export interface ContactResponse {
  message: string;
}

export async function sendContactMessage(data: ContactRequest): Promise<ContactResponse> {
  const { data: response } = await client.post<ContactResponse>("/api/contact", data);
  return response;
}
