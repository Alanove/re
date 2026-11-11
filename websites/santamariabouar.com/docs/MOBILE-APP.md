# Mobile App (iOS + Android)

The `mobile/` folder contains an Expo (React Native, TypeScript) app published to the App Store and Google Play. It uses a JSON REST API served by the website under `/api/v1`.

## What the app does

**Residents (members)**

- Home: total due, payments due, wallet balance, apartments, how to pay (Whish / OMT / bank, coordinator call button)
- Apartments: list and detail (photo, role, payments due, wallet movements, recent payments)
- Payments: unpaid / all invoices; tap a paid invoice to view its receipt
- History: payments including wallet payments, with receipts
- Profile: language (EN/FR), change password, privacy policy, terms, account-deletion request, sign out
- Sign in, forgot password, request access (same rules as the website form)

**Administrators** (Super Admin and Admin can view; only Super Admin can make changes)

- Dashboard: pending access requests, unpaid invoices, wallet totals, income / expenses
- Transactions: search, filter by apartment, receipts, new transaction (income, expense, transfer)
- Invoices: outstanding / paid / all, detail, record payment (wallet + cash), new invoice
- Wallets: balances, statement, add / subtract funds
- Access requests: review, create or link member, choose apartments and roles, approve / reject. If the approval email fails, the temporary password is shown once to share manually.

Common-expense payments are recorded from **Invoices → Pay invoice**, not from New transaction.

## Server side

| Item | Location |
| --- | --- |
| Routes | `src/api/routes/index.ts` (mounted in `src/app.ts` before session/CSRF) |
| Controllers | `src/api/controllers/*ApiController.ts` |
| JWT + refresh tokens | `src/api/services/apiTokenService.ts` |
| Auth / role guards | `src/api/middleware/apiAuth.ts` |
| Rate limits | `src/api/middleware/apiRateLimits.ts` |
| Shared business logic | `src/services/accessApprovalService.ts`, `src/services/memberPortalService.ts`, `admin/services/invoicePaymentService.ts` (also used by the website) |
| Migration | `data-migration/2026-10-17-create-api-refresh-tokens.ts` |
| Tests | `tests/api/` (`npm run test:api`) |

Auth: `POST /api/v1/auth/login` returns a 15-minute access token and a 30-day refresh token. Refresh tokens are stored hashed (`api_refresh_tokens`), rotated on every use, and revoked on logout or password change. If a revoked token is reused, all of that user's tokens are revoked.

### Production setup (once)

1. Add a strong secret to the server `.env.production` (at least 32 characters):

   ```
   JWT_SECRET=<output of: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))">
   ```

   Without it the API answers `503` in production. The website is not affected.
2. Run the migration: `npm run migrate:production`.
3. Deploy the server files (package-site-upload skill), then `npm install --omit=dev` on the server for the new `jsonwebtoken` and `cors` dependencies, and restart.
4. Check: `curl https://www.santamariabouar.com/api/v1/auth/me` should return `401` with a JSON error.

## Local development

```bash
cd mobile
npm install
echo EXPO_PUBLIC_API_BASE_URL=http://<your-LAN-IP>:3000/api/v1 > .env.local
npx expo start
```

Open in **Expo Go** on a phone on the same Wi-Fi, or press `a` (Android emulator), `i` (iOS simulator, macOS only) or `w` (web preview; receipts are native-only).

Checks before committing: `npm run typecheck` and `npm run lint` inside `mobile/`; `npm run build` and `npm run test:api` at the repo root.

App icons and splash are generated from the site logo with `npm run icons` (Python + Pillow).

## Building and publishing

Builds use [EAS](https://docs.expo.dev/build/introduction/). Profiles are in `mobile/eas.json`:

| Profile | Purpose | API |
| --- | --- | --- |
| `development` | Dev client (`npx expo install expo-dev-client` first) | `http://192.168.1.10:3000/api/v1`; edit to your LAN IP |
| `preview` | Internal testing; Android builds an installable APK | production |
| `production` | Store builds (auto-incremented build number) | production |

### One-time accounts

- **Expo**: create an account, then `npx eas-cli@latest login` and `npx eas-cli@latest init` inside `mobile/` (writes the project ID into `app.json`).
- **Apple Developer Program** ($99/year) for App Store / TestFlight.
- **Google Play Console** ($25 once). Create the app with package `com.santamariabouar.app`. Create a service-account JSON key for automated submit.

### Commands (run in `mobile/`)

```bash
npx eas-cli@latest build --profile preview --platform android   # APK to share with testers
npx eas-cli@latest build --profile production --platform all     # store builds
npx eas-cli@latest submit --platform ios                         # upload to App Store Connect / TestFlight
npx eas-cli@latest submit --platform android                     # upload to Play (internal track)
```

EAS manages signing certificates and keystores; accept the prompts on the first build.

### Store listing checklist

- Bundle ID / package: `com.santamariabouar.app`
- Privacy policy URL: `https://www.santamariabouar.com/privacy-policy` (update the policy to mention the mobile app and the data it stores: sign-in token on the device, language preference)
- Account deletion: Profile → *Request account deletion* opens `https://www.santamariabouar.com/contact`. Google Play also asks for this URL in the Data safety form. Apple requires that deletion can be **initiated in the app**, which this flow does. A dedicated self-service deletion endpoint would be stronger if review pushes back.
- **App review login**: create a demo Member account with a sample apartment and give the credentials to Apple / Google reviewers. Reviewers cannot request access and wait for approval.
- Screenshots: 6.7" and 5.5" iPhone, plus Android phone.
- Data safety / privacy labels: name, email, phone (account), financial info (payment history). No tracking, no ads.
- Encryption: `ITSAppUsesNonExemptEncryption` is set to `false` (HTTPS only).

## Releasing updates

- **JS-only changes**: bump `version` in `app.json` if user-visible, then rebuild and submit. (EAS Update / OTA can be added later.)
- **API changes**: keep endpoints backward compatible. Older app versions stay installed for weeks after a release.
