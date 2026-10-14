# Quietzone

QR codes that actually scan. A local-only QR studio with its own ISO 18004 encoder:
it checks a code before you print it — logo damage block by block, colour contrast,
quiet zone, and module size for the scan distance — offers verified fixes, and
learns your printer from the scan tests you log.

- Expo SDK 54, expo-router, expo-sqlite, reanimated, react-native-svg, expo-print, expo-sharing
- No backend, no network permission, no camera.

```
npm install
npx expo start          # Expo Go
npm run verify          # tsc + tests + rules + export
```

Engine and design notes: [PLAN.md](PLAN.md).
