# Hustl Frontend

React Native (Expo) mobile app for finding sports facilities, organizing pickup games, managing teams, and running tournaments.

## Features

- 🏠 **Home Dashboard** - Overview of upcoming games, teams, and tournaments
- 🏟️ **Games** - Create, join, and manage pickup games
- 🏆 **Tournaments** - Organize bracket-style tournaments with scoring
- 👥 **Teams** - Create teams, manage members, compete together
- 🗺️ **Places** - Find nearby sports facilities with Google Maps integration
- 👤 **Profile** - Manage account, preferences, and settings
- 🌓 **Dark Mode** - System, light, and dark theme support
- 🔐 **Auth** - Email/password and Google OAuth authentication
- 🔔 **Push Notifications** - Game reminders and updates (via Expo)

## Tech Stack

- **React Native** (0.86) with **Expo SDK 57**
- **TypeScript** for type safety
- **React Navigation** (v7) - Native stack and bottom tabs
- **Axios** - HTTP client for API calls
- **React Native Maps** - Google Maps integration
- **Expo Location** - Location services
- **Expo Notifications** - Push notifications
- **Expo Auth Session** - Google OAuth
- **Async Storage** - Local data persistence

## Project Structure

```
frontend/
├── App.tsx                 # Entry point
├── app.json               # Expo configuration
├── eas.json               # EAS Build configuration
├── assets/                # Icons, splash screens, images
└── src/
    ├── api/
    │   └── client.ts      # Axios API client with all endpoints
    ├── components/
    │   ├── CustomSplash.tsx
    │   ├── PlaceCard.tsx
    │   └── SportSelector.tsx
    ├── context/
    │   ├── AuthContext.tsx       # Authentication state
    │   └── NotificationContext.tsx
    ├── hooks/
    │   └── useGoogleAuth.ts      # Google OAuth hook
    ├── navigation/
    │   └── index.tsx             # Navigation configuration
    ├── screens/
    │   ├── HomeDashboardScreen.tsx
    │   ├── GamesScreen.tsx
    │   ├── CreateGameScreen.tsx
    │   ├── GameDetailsScreen.tsx
    │   ├── TeamsScreen.tsx
    │   ├── CreateTeamScreen.tsx
    │   ├── TeamDetailsScreen.tsx
    │   ├── TournamentsScreen.tsx
    │   ├── CreateTournamentScreen.tsx
    │   ├── TournamentDetailsScreen.tsx
    │   ├── PlacesScreen.tsx
    │   ├── MapScreen.tsx
    │   ├── ProfileScreen.tsx
    │   ├── EditProfileScreen.tsx
    │   ├── LoginScreen.tsx
    │   ├── SignupScreen.tsx
    │   └── ... (more screens)
    ├── theme/
    │   ├── index.ts              # Theme exports
    │   ├── colors.ts             # Color definitions
    │   └── ThemeContext.tsx      # Theme provider
    ├── types/
    │   └── index.ts              # TypeScript type definitions
    └── utils/
        └── myActivity.ts
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)
- Expo Go app (for development) or iOS/Android emulator

### Installation

```bash
cd frontend
npm install
```

### Running the App

```bash
# Start Expo development server
npx expo start

# Run on iOS simulator
npx expo start --ios

# Run on Android emulator
npx expo start --android

# Run in web browser
npx expo start --web
```

### Connecting to Backend

For local development, create a `.env` file:

```env
EXPO_PUBLIC_API_URL=http://192.168.1.XX:8000
```

Replace `192.168.1.XX` with your machine's local IP address.

**Production API:** The app uses `https://backend-hustl5.vercel.app` by default (configured in `app.json`).

## Environment Variables

| Variable | Description |
|----------|-------------|
| `EXPO_PUBLIC_API_URL` | Backend API URL |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Google OAuth Web Client ID |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | Google OAuth iOS Client ID |
| `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` | Google OAuth Android Client ID |

## Navigation Structure

```
App
├── AuthStack (unauthenticated)
│   ├── Login
│   ├── Signup
│   ├── ForgotPassword
│   └── ResetPassword
│
└── AppStack (authenticated)
    ├── MainTabs (bottom tab navigator)
    │   ├── 🏠 HomeDashboard
    │   ├── 🏟️ Games
    │   ├── 🏆 Tournaments
    │   ├── 👥 Teams
    │   └── 👤 Profile
    │
    └── Modal Screens
        ├── CreateGame
        ├── CreateTeam
        ├── CreateTournament
        ├── GameDetails
        ├── TeamDetails
        ├── TournamentDetails
        ├── EditProfile
        ├── Map
        └── ...
```

## Building for Production

This project uses [EAS Build](https://docs.expo.dev/build/introduction/) for production builds.

### Setup

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Configure project (already done)
eas build:configure
```

### Build Commands

```bash
# Development build (internal distribution)
eas build --profile development --platform ios
eas build --profile development --platform android

# Preview build (APK for Android)
eas build --profile preview --platform android

# Production build
eas build --profile production --platform ios
eas build --profile production --platform android
```

### Submit to Stores

```bash
# Submit to App Store
eas submit --platform ios

# Submit to Google Play
eas submit --platform android
```

## Configuration

### App Configuration (`app.json`)

| Setting | Value |
|---------|-------|
| App Name | Hustl |
| Bundle ID (iOS) | `app.hustl` |
| Package (Android) | `com.hustl` |
| Scheme | `hustl://` |
| Min SDK | Expo SDK 57 |

### Google Maps

Maps are configured with API keys in `app.json`:
- iOS: `ios.config.googleMapsApiKey`
- Android: `android.config.googleMaps.apiKey`

### Permissions

- **Location** - For finding nearby sports facilities
- iOS: `NSLocationWhenInUseUsageDescription`
- Android: `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`

## Theming

The app supports three theme modes:
- **Light** - Default light appearance
- **Dark** - Dark mode
- **System** - Follows device settings

Theme can be changed from Profile → Appearance.

## API Client

All API calls are centralized in `src/api/client.ts`:

```typescript
import { login, signup, listGames, createGame, ... } from '../api/client';

// Authentication
await login(email, password);
await signup(name, email, password);

// Games
const games = await listGames();
await createGame(gameData);
await joinGame(gameId);

// Teams
const teams = await listTeams();
await createTeam(teamData);
await joinTeam(teamId);

// Tournaments
const tournaments = await listTournaments();
await registerTeamForTournament(tournamentId, teamId);
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start Expo dev server |
| `npm run ios` | Run on iOS |
| `npm run android` | Run on Android |
| `npm run web` | Run in browser |

## Troubleshooting

### Metro Bundler Issues
```bash
# Clear cache and restart
npx expo start --clear
```

### iOS Simulator Not Found
```bash
# List available simulators
xcrun simctl list devices
```

### Android Emulator Connection
Ensure `adb` is in your PATH and emulator is running:
```bash
adb devices
```

### Google Maps Not Showing
- Verify API keys are correctly set in `app.json`
- Ensure Maps SDK is enabled in Google Cloud Console
- For iOS simulator, maps may require a development build

## License

MIT
