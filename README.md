# Hustl

Find nearby sports facilities, organize pickup games, create teams, and run tournaments with friends.

![Platform](https://img.shields.io/badge/platform-iOS%20%7C%20Android-blue)
![Backend](https://img.shields.io/badge/backend-FastAPI-009688)
![Frontend](https://img.shields.io/badge/frontend-React%20Native-61DAFB)

## Features

- 🏟️ **Find Places** - Discover nearby sports facilities using OpenStreetMap data
- ⚽ **Pickup Games** - Create and join pickup games with skill levels and privacy settings
- 👥 **Teams** - Form teams, manage members, and compete together
- 🏆 **Tournaments** - Organize bracket-style tournaments with automatic scheduling
- 🔔 **Notifications** - Push notifications for game reminders, team updates, and results
- 🗺️ **Maps** - Interactive maps with Google Maps integration
- 🔐 **Auth** - Email/password and Google OAuth authentication
- 🌓 **Themes** - Light, dark, and system theme modes

## Project Structure

```
hustl-soccer-app/
├── backend/           # FastAPI REST API
│   ├── app/           # Application code
│   ├── docker-compose.yml
│   └── README.md      # ⬅️ Backend documentation
├── frontend/          # React Native (Expo) app
│   ├── src/           # Application code
│   ├── app.json       # Expo configuration
│   └── README.md      # ⬅️ Frontend documentation
└── README.md          # This file
```

## Quick Start

### Prerequisites

- Python 3.11+ and Docker (for backend)
- Node.js 18+ (for frontend)

### 1. Start the Backend

```bash
cd backend
docker compose up -d          # Start PostgreSQL + PostGIS
cp .env.example .env          # Create environment file
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

📖 See [`backend/README.md`](./backend/README.md) for detailed setup, Pipenv instructions, and Vercel deployment.

### 2. Start the Frontend

```bash
cd frontend
npm install
npx expo start
```

📖 See [`frontend/README.md`](./frontend/README.md) for detailed setup, environment variables, and EAS builds.

### 3. Connect Mobile Device

For physical device testing, create `frontend/.env`:

```
EXPO_PUBLIC_API_URL=http://YOUR_LOCAL_IP:8000
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Mobile App** | React Native, Expo SDK 57, TypeScript |
| **Navigation** | React Navigation v7 |
| **Maps** | Google Maps (react-native-maps) |
| **Backend API** | FastAPI (Python 3.11+) |
| **Database** | PostgreSQL + PostGIS |
| **ORM** | SQLAlchemy (async) |
| **Auth** | JWT, Google OAuth |
| **Push Notifications** | Expo Push Notifications |
| **Places Data** | OpenStreetMap (Overpass/Nominatim) |

## Documentation

| Resource | Description |
|----------|-------------|
| [`backend/README.md`](./backend/README.md) | API setup, routes, deployment |
| [`frontend/README.md`](./frontend/README.md) | App setup, screens, builds |
| `http://localhost:8000/docs` | Interactive API docs (Swagger) |

## API Overview

The backend provides a REST API with 50+ endpoints:

| Resource | Endpoints | Description |
|----------|-----------|-------------|
| `/auth/*` | 5 | Signup, login, Google OAuth, password reset |
| `/api/games/*` | 6 | Create, join, leave, manage games |
| `/api/teams/*` | 10 | Create teams, manage members |
| `/api/tournaments/*` | 8 | Tournaments, brackets, scoring |
| `/api/users/*` | 5 | Profile, password, account |
| `/api/notifications/*` | 9 | Push tokens, preferences |
| `/api/places/*` | 1 | Nearby sports facilities |

📖 Full API reference in [`backend/README.md`](./backend/README.md#api-routes-summary)

## Deployment

| Component | Platform | URL |
|-----------|----------|-----|
| Backend | Vercel | `https://backend-hustl5.vercel.app` |
| Database | Supabase | PostgreSQL + PostGIS |
| Mobile | App Store / Play Store | Via EAS Build |

## License

MIT
