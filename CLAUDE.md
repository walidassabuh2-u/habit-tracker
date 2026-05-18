# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Web (browser, fastest for local testing)
npm run web                    # opens http://localhost:8081

# Phone via Expo Go (LAN disabled on this machine — tunnel is required)
npx expo start --tunnel        # generates a public QR code via ngrok

# Native emulators
npm run android                # requires Android SDK + adb
npm run ios                    # macOS + Xcode only

# Type-check
npx tsc --noEmit

# Install a new Expo-compatible package (always use this, not plain npm install)
npx expo install <package>
```

No test runner is configured. Add `jest-expo` when tests are needed.

## Architecture

Expo SDK 54 · React Native 0.81 · React 19 · TypeScript strict · New Architecture enabled (`newArchEnabled: true` in `app.json`) · Web supported via `react-native-web`.

| File | Role |
|---|---|
| [index.ts](index.ts) | Entry point — `registerRootComponent(App)` |
| [App.tsx](App.tsx) | Entire app — all components, types, logic, and styles live here |
| [app.json](app.json) | Expo config: name, icons, splash, platform settings |

## App.tsx structure

Everything is co-located in a single file, top to bottom:

1. **Types** — `Habit` `{ id, name, emoji, streak, lastCompleted, history }` and `Review` `{ id, rating, comment, date }`
2. **Constants** — `STORAGE_KEY`, `REVIEWS_KEY`, `DEFAULT_HABITS`, `EMOJI_OPTIONS`
3. **Design tokens** — `PURPLE`, `PURPLE_LIGHT`, `PURPLE_MID`, `PURPLE_DARK`, `GOLD`
4. **Date helpers** — `dateOffset(n)`, `todayStr()`, `yesterdayStr()`, `lastSevenDays()`
5. **`HabitCard`** — renders one habit row; owns its own `Animated.Value` for card bounce and checkmark spring
6. **`AddHabitModal`** — bottom sheet with emoji grid picker + name input
7. **`ReviewModal`** — bottom sheet with 5-star rating, optional comment, thank-you state
8. **`App`** — root component; owns all state and persistence

## State & persistence

- Habits persisted to AsyncStorage under key `@habits_v2`; reviews under `@reviews_v1`
- `DEFAULT_HABITS` only loads when AsyncStorage has no saved data (first launch)
- `Habit.lastCompleted` (`'YYYY-MM-DD'`) drives "completed today" — there is **no** separate `completed` boolean
- `Habit.history` stores the last 30 completed date strings, used for 7-day dots and weekly rate
- Streak logic: increments if `lastCompleted === yesterday`, resets to 1 otherwise; decrements on un-check
- Reviews are append-only; average and count are computed on render from the `reviews` array

## Key constraints

- **Expo docs**: https://docs.expo.dev/versions/v54.0.0/
- **No router**: Single-screen `App.tsx` pattern. Add `@react-navigation/native` for multi-screen.
- **New Architecture**: Avoid libraries without Fabric + TurboModules support.
- **Styling**: `StyleSheet.create` only — no CSS, no Tailwind.
- **SafeAreaProvider**: Root is wrapped in `<SafeAreaProvider>` (required by `react-native-safe-area-context`). Any new root-level modal or screen must live inside it.
- **Haptics**: `expo-haptics` is silent on web — no guard needed, it no-ops automatically.
- **Web storage**: `AsyncStorage` maps to `localStorage` on web — works without changes.
