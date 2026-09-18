# Hustl

Find nearby sports facilities, organize pickup games, create teams, and run tournaments with friends. Built with FastAPI backend and React Native (Expo) frontend, using OpenStreetMap data.

## Features

- 🏟️ **Find Places** - Discover nearby sports facilities using OpenStreetMap data
- ⚽ **Pickup Games** - Create and join pickup games with other players
- 👥 **Teams** - Form teams, manage members, and compete together
- 🏆 **Tournaments** - Organize bracket-style tournaments with automatic scheduling
- 🔔 **Notifications** - Push notifications for game reminders, team updates, and tournament results
- 🗺️ **Maps** - Interactive maps with Google Maps integration
- 🔐 **Auth** - Email/password and Google OAuth authentication

## Prerequisites

- Python 3.11+
- Node.js 18+
- Docker (for PostgreSQL + PostGIS)
## Quick Start

### 1. Start the Database

```bash
cd backend
docker compose up -d
```

This starts PostgreSQL with PostGIS on port 5432.

### 2. Run the Backend

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# macOS/Linux:
source venv/bin/activate
# Windows:
# venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start the server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at `http://localhost:8000`. View docs at `http://localhost:8000/docs`.

### 3. Run the Frontend

```bash
cd frontend
npm install
npx expo start
```

### 4. Connect from Physical Device

For local development, create `frontend/.env` with your machine's LAN IP:

```
EXPO_PUBLIC_API_URL=http://192.168.1.XX:8000
```

The production app uses `https://backend-hustl5.vercel.app` as configured in `app.json`.

## API Reference

### Authentication

#### `POST /auth/signup`
```json
{ "name": "John Doe", "email": "john@example.com", "password": "password123" }
```

#### `POST /auth/login`
```json
{ "email": "john@example.com", "password": "password123" }
```

#### `POST /auth/google`
```json
{ "id_token": "eyJhbGciOiJSUzI1NiIs..." }
```

All auth endpoints return:
```json
{ "user": { "id": "uuid", "email": "...", "name": "...", "auth_provider": "email|google", "createdAt": "..." }, "token": "jwt..." }
```

### Games (requires auth)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/games` | Create a game |
| `GET` | `/api/games` | List your games (created or joined) |
| `GET` | `/api/games/{id}` | Get game details |
| `POST` | `/api/games/{id}/join` | Join a game |
| `POST` | `/api/games/{id}/leave` | Leave a game |
| `DELETE` | `/api/games/{id}` | Delete a game |

#### Create Game Payload
```json
{
  "sport": "soccer",
  "location": "Central Park Field 5",
  "game_date": "2024-08-20T14:00:00Z",
  "players_needed": 10,
  "skill_level": "INTERMEDIATE",
  "privacy": "PUBLIC"
}
```

### Geocoding

#### `GET /geocode?q=Frisco Texas`
```json
{ "lat": 33.1507, "lon": -96.8236, "display_name": "Frisco, Collin County, Texas, United States" }
```

### Places

#### `GET /api/places/nearby?lat=33.15&lon=-96.82&radius_meters=5000&sport=soccer`
```json
{
  "count": 1,
  "results": [{
    "id": 1,
    "name": "Frontier Park Soccer Complex",
    "lat": 33.12,
    "lon": -96.80,
    "sport": "soccer",
    "distance_miles": 3.2,
    "distance_km": 5.15
  }]
}
```

Supported sports: `soccer`, `basketball`, `football`, `baseball`, `volleyball`, `tennis`, `other`

### Teams (requires auth)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/teams` | Create a team |
| `GET` | `/api/teams` | List all teams (optional `?sport=` filter) |
| `GET` | `/api/teams/my-teams` | List teams you're a member of |
| `GET` | `/api/teams/my-created-teams` | List teams you own |
| `GET` | `/api/teams/my-joined-teams` | List teams you joined (not owned) |
| `GET` | `/api/teams/{id}` | Get team details |
| `PUT` | `/api/teams/{id}` | Update team (owner only) |
| `POST` | `/api/teams/{id}/join` | Join a team |
| `POST` | `/api/teams/{id}/leave` | Leave a team |
| `POST` | `/api/teams/{id}/members` | Add a member (owner only) |
| `DELETE` | `/api/teams/{id}/members/{user_id}` | Remove a member |
| `DELETE` | `/api/teams/{id}` | Delete a team (owner only) |

#### Create Team Payload
```json
{
  "name": "FC Lightning",
  "description": "Competitive soccer team",
  "sport": "soccer"
}
```

#### Add Member Payload
```json
{
  "user_id": "uuid",
  "role": "member"
}
```
Or by email:
```json
{
  "email": "player@example.com",
  "role": "member"
}
```

### Tournaments (requires auth)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/tournaments` | Create a tournament |
| `GET` | `/api/tournaments` | List tournaments (optional `?sport=&status=` filters) |
| `GET` | `/api/tournaments/my-tournaments` | List tournaments you organize or participate in |
| `GET` | `/api/tournaments/{id}` | Get tournament details with bracket |
| `POST` | `/api/tournaments/{id}/register` | Register a team (team owner only) |
| `POST` | `/api/tournaments/{id}/generate-bracket` | Generate bracket (organizer only) |
| `PUT` | `/api/tournaments/{id}/matches/{match_id}/score` | Update match score (organizer only) |
| `PUT` | `/api/tournaments/{id}/matches/{match_id}/teams` | Set match teams (organizer only) |
| `DELETE` | `/api/tournaments/{id}` | Delete tournament (organizer only) |

#### Create Tournament Payload
```json
{
  "name": "Summer Cup 2024",
  "sport": "soccer",
  "description": "Annual summer tournament",
  "max_teams": 8
}
```

#### Register Team Payload
```json
{
  "team_id": "uuid"
}
```

#### Update Match Score Payload
```json
{
  "team1_score": 3,
  "team2_score": 1
}
```

Tournament statuses: `registration`, `in_progress`, `completed`

### Users (requires auth)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/users` | Search users by name/email (`?q=`) |
| `GET` | `/api/users/me` | Get current user profile |
| `GET` | `/api/users/{id}` | Get user by ID |
| `PUT` | `/api/users/me` | Update current user profile |
| `PUT` | `/api/users/me/password` | Change password |
| `DELETE` | `/api/users/me` | Delete account |

#### Update Profile Payload
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+1234567890"
}
```

#### Change Password Payload
```json
{
  "current_password": "oldpassword123",
  "new_password": "newpassword456"
}
```

### Contact (requires auth)

#### `POST /api/contact`
Send a contact/feedback message.
```json
{
  "subject": "Feature Request",
  "message": "I'd love to see volleyball courts added!"
}
```

### Notifications (requires auth)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/notifications/device-token` | Register device for push notifications |
| `DELETE` | `/api/notifications/device-token/{token}` | Unregister device token |
| `GET` | `/api/notifications/preferences` | Get notification preferences |
| `PUT` | `/api/notifications/preferences` | Update notification preferences |
| `GET` | `/api/notifications` | List notifications |
| `POST` | `/api/notifications/mark-read` | Mark notifications as read |
| `GET` | `/api/notifications/unread-count` | Get unread notification count |
| `DELETE` | `/api/notifications/{id}` | Delete a notification |
| `DELETE` | `/api/notifications` | Clear all notifications |

#### Register Device Token
```json
{
  "token": "ExponentPushToken[...]",
  "platform": "ios",
  "device_name": "iPhone 15"
}
```

#### Update Notification Preferences
```json
{
  "game_reminders": true,
  "game_player_joined": true,
  "game_player_left": true,
  "team_invitations": true,
  "tournament_updates": true,
  "reminder_hours_before": 24
}
```

## Environment Variables

### Backend

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql+asyncpg://postgres:postgres@localhost:5432/soccer_app` | PostgreSQL connection |
| `JWT_SECRET_KEY` | `sakah-dev-secret...` | JWT signing key (change in production) |
| `LOG_LEVEL` | `INFO` | Logging level |
| `GOOGLE_WEB_CLIENT_ID` | - | Google OAuth Web Client ID |
| `GOOGLE_IOS_CLIENT_ID` | - | Google OAuth iOS Client ID |
| `GOOGLE_ANDROID_CLIENT_ID` | - | Google OAuth Android Client ID |
| `SMTP_HOST` | - | SMTP server hostname (for contact form) |
| `SMTP_PORT` | `587` | SMTP server port |
| `SMTP_USER` | - | SMTP username |
| `SMTP_PASS` | - | SMTP password |
| `SMTP_FROM` | `SMTP_USER` | From email address |
| `CONTACT_EMAIL` | `SMTP_FROM` | Email to receive contact messages |

### Frontend

| Variable | Default | Description |
|----------|---------|-------------|
| `EXPO_PUBLIC_API_URL` | `http://localhost:8000` | Backend API URL |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | - | Google OAuth Web Client ID |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | - | Google OAuth iOS Client ID |
| `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` | - | Google OAuth Android Client ID |

## Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Google+ API** (or People API)
4. Go to **Credentials** and create OAuth 2.0 Client IDs:
   - **Web application**: For Expo Go and web
   - **iOS**: For standalone iOS app (use your bundle ID)
   - **Android**: For standalone Android app (use your package name and SHA-1)
5. Add the Client IDs to your environment variables

For Expo Go testing, you only need the Web Client ID.

## Project Structure

```
hustl-soccer-app/
├── backend/
│   ├── app/
│   │   ├── routes/          # API endpoints
│   │   ├── models/          # SQLAlchemy models
│   │   ├── schemas/         # Pydantic schemas
│   │   ├── services/        # Business logic (notifications, etc.)
│   │   ├── auth/            # Authentication utilities
│   │   └── utils/           # Helper functions
│   ├── docker-compose.yml   # PostgreSQL + PostGIS
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── screens/         # App screens
│   │   ├── components/      # Reusable components
│   │   ├── context/         # React contexts (Auth, Notifications)
│   │   ├── hooks/           # Custom hooks
│   │   ├── navigation/      # React Navigation setup
│   │   ├── api/             # API client
│   │   └── theme/           # Colors and styling
│   ├── app.json             # Expo configuration
│   └── App.tsx              # Entry point
└── README.md
```

## Tech Stack

### Backend
- **FastAPI** - Modern async Python web framework
- **PostgreSQL + PostGIS** - Spatial database for location queries
- **SQLAlchemy** - Async ORM
- **JWT** - Token-based authentication
- **Expo Push Notifications** - Mobile push notifications

### Frontend
- **React Native (Expo)** - Cross-platform mobile development
- **React Navigation** - Navigation library
- **Google Maps** - Map integration
- **Expo Push Notifications** - Notification handling

## License

MIT
