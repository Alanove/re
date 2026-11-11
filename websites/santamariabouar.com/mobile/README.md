# Santa Maria Bouar mobile app

Expo (React Native + TypeScript) app for residents and administrators. It talks to the website's REST API at `/api/v1`.

Full setup, build and store-release guide: [`../docs/MOBILE-APP.md`](../docs/MOBILE-APP.md).

```bash
npm install
npx expo start            # scan the QR code with Expo Go, or press a / i / w
npm run typecheck
npm run lint
```

Point the app at a local server with `EXPO_PUBLIC_API_BASE_URL` in `mobile/.env.local`:

```
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.10:3000/api/v1
```
