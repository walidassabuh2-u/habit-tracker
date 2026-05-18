#  Habit Tracker

A high-quality daily habit tracker built with **Expo** (React Native + Web), featuring streaks, history, and in-app reviews.

## Features

- **Daily habit check-off** — tap a card to complete, long-press to delete
- **Streak tracking** — consecutive-day streaks with milestone badges (🥉🥈🥇💎)
- **7-day dot history** — each card shows the last 7 days at a glance
- **Weekly completion rate** — live % badge in the header
- **Animated UI** — card bounce + spring checkmark on every tap
- **Haptic feedback** — light / medium / success bursts on iOS & Android
- **Add custom habits** — floating + button with emoji picker
- **In-app reviews** — star rating + comment system with persistent stats
- **Full persistence** — AsyncStorage keeps all data across restarts
- **Web support** — runs in the browser via `npm run web`

## Stack

| | |
|---|---|
| Framework | Expo SDK 54 |
| Language | TypeScript (strict) |
| UI | React Native 0.81 + React Native Web |
| Storage | AsyncStorage |
| Haptics | expo-haptics |
| Architecture | New Architecture (Fabric + TurboModules) |

## Getting Started

```bash
npm install

# Web — opens http://localhost:8081
npm run web

# Phone — scan QR with Expo Go (use tunnel if LAN is unavailable)
npx expo start --tunnel

# Android emulator
npm run android
```

## Project Structure

```
App.tsx          # Entire app — components, logic, styles
index.ts         # Entry point
app.json         # Expo config
assets/          # Icons and splash screen
```

All components (`HabitCard`, `AddHabitModal`, `ReviewModal`) and styles live in `App.tsx` as a single-screen app.

## Screenshots

> Coming soon

## License

MIT
