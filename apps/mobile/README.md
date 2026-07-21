# Longhua Academy — mobile client

User-facing React Native (Expo) app for students and teachers.
Admin stays on the web client. Does not modify `apps/api` or the Vite web app.

## Setup

```bash
cd apps/mobile
cp .env.example .env
npm install
npm start
```

From repo root:

```bash
npm run mobile
```

## Scripts

| Script | Purpose |
|--------|---------|
| `npm start` | Expo Dev Tools |
| `npm run android` | Open Android emulator / device |
| `npm run ios` | Open iOS simulator (macOS) |
| `npm run prebuild` | Generate native `android/` / `ios/` projects |
| `npm run build:android` | EAS Android build (development profile) |
| `npm run build:ios` | EAS iOS build (development profile) |

## Auth (scaffold)

- Splash → Login → Main tabs
- Tokens via `expo-secure-store` (`src/auth/tokenStorage.ts`)
- Login is mocked until NestJS JWT is wired

## API

`EXPO_PUBLIC_API_URL` → `src/api/client.ts` (JWT header + 401 clear session)
