export type Sport =
  | "soccer"
  | "basketball"
  | "football"
  | "baseball"
  | "tennis"
  | "pickleball"
  | "general";

export type GameSport = "soccer" | "basketball" | "football" | "baseball" | "tennis" | "pickleball" | "other";

export type SkillLevel = "BEGINNER" | "CASUAL" | "INTERMEDIATE" | "ADVANCED" | "ELITE";

export type PrivacyType = "PUBLIC" | "FRIENDS ONLY" | "PRIVATE";

export type GameStatus = "OPEN" | "FULL" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export interface GeocodeResult {
  lat: number;
  lon: number;
  display_name: string;
}

export interface Place {
  name: string;
  lat: number;
  lon: number;
  osm_type: string;
  osm_id: number;
  sport: string | null;
  distance_miles: number;
  distance_km: number;
  tags: Record<string, string>;
}

export interface PlacesResponse {
  count: number;
  results: Place[];
}

export interface User {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  favorite_sports: string[];
  auth_provider?: string;
  profile_picture?: string | null;
  createdAt: string;
}

export interface GoogleAuthData {
  id_token: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface SignupData {
  name: string;
  email: string;
  password: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface GameCreator {
  id: string;
  name: string;
}

export interface GameTeam {
  id: string;
  name: string;
}

export interface GoalScorer {
  id: string;
  name: string;
}

export interface GameGoal {
  id: string;
  team_id: string;
  team_name: string;
  scorer: GoalScorer;
  minute: number | null;
  created_at: string;
}

export interface Game {
  id: string;
  sport: GameSport;
  location: string;
  game_date: string;
  players_needed: number;
  players_joined: number;
  skill_level: SkillLevel;
  privacy: PrivacyType;
  description: string | null;
  status: GameStatus;
  home_score: number;
  away_score: number;
  creator: GameCreator;
  team: GameTeam | null;
  opponent_team: GameTeam | null;
  goals: GameGoal[];
  created_at: string;
  updated_at: string;
}

export interface CreateGameData {
  sport: GameSport;
  location: string;
  game_date: string;
  players_needed: number;
  skill_level: SkillLevel;
  privacy: PrivacyType;
  description?: string;
  team_id?: string;
  opponent_team_id?: string;
}

export interface GamesResponse {
  count: number;
  results: Game[];
}

export interface PickedMapPlace {
  id: string;
  name: string;
  lat: number;
  lon: number;
  sport: string | null;
  address?: string | null;
  distance_miles: number;
  tags: Record<string, string>;
  isSaved: boolean;
}

export type RootStackParamList = {
  Login: undefined;
  Signup: undefined;
  ForgotPassword: undefined;
  ResetPassword: { email: string };
  Home: undefined;
  Games: undefined;
  Teams: undefined;
  Tournaments: undefined;
  Places: undefined;
  CreateGame: { pickedPlace?: PickedMapPlace } | undefined;
  PickMapLocation: {
    sport: GameSport;
    returnTo?: "CreateGame" | "CreateTournamentGames";
    tournamentId?: string;
  };
  CreateTeam: undefined;
  CreateTournament: undefined;
  CreateTournamentGames: { tournamentId: string; pickedPlace?: PickedMapPlace };
  EditProfile: undefined;
  EditFavoriteSports: undefined;
  Notifications: undefined;
  NotificationSettings: undefined;
  GameDetails: { gameId: string };
  TeamDetails: { teamId: string };
  TournamentDetails: { tournamentId: string };
  ContactUs: undefined;
  TermsPrivacy: undefined;
  Results: { lat: number; lon: number; sport: Sport; radius: number; locationLabel: string };
  Map: { lat: number; lon: number; places: Place[]; locationLabel: string };
};

export type MainTabParamList = {
  HomeDashboard: undefined;
  Games: undefined;
  Tournaments: undefined;
  Teams: undefined;
  Profile: undefined;
};
