# ATLAS – Smart Campus Navigation (CvSU Imus)

One Next.js project, three ways to use it: **website**, **Android app** and **iOS app** (Capacitor shells).
The native apps load the same Next.js server as the website, so backend, accounts, cookies and data are shared.

> **Status / honesty note.** The Capacitor files, scripts, icon/splash sources and security fixes were written
> in a sandbox with no network, no Android SDK and no Xcode. `npm install`, `next build`, Gradle and
> Xcode builds were **not run there**, and no APK/AAB/IPA has been built or tested. Follow the steps below on your machine; if a step fails, send me the error.

## Architecture

- Next.js 16 (App Router). API routes: `/api/chat` (Gemini, key stays server-side), `/api/rooms/claim`, `/api/teacher/*`, `/api/admin/dashboard`.
- Auth: signed httpOnly cookie (`atlas_teacher`). The native shell loads the server origin directly, so the cookie works exactly as in a browser.
- Persistence: JSON files in `data/` on a server with a disk, or **Upstash Redis** when deployed to Vercel (switches automatically, see below).
- Capacitor (`capacitor.config.ts`) points the WebView at the site via `server.url`. Static export is not used because it would break the API routes.

## Deploy free on Vercel (with Upstash Redis)

Vercel has no writable disk, so shared data is kept in Upstash Redis instead of `data/`:
room names and use counts, activity logs, room claims, faculty accounts, faculty
schedules, department areas, and the chatbot knowledge base.

1. Import the repository in Vercel.
2. In the project's **Storage** tab, add **Upstash Redis** (free tier is enough). It sets
   `KV_REST_API_URL` / `KV_REST_API_TOKEN` (or `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`);
   Atlas switches to Redis automatically when they exist (`lib/storeMode.ts`, `lib/persist.ts`).
3. Add the other environment variables (Settings → Environment Variables), see `.env.example`:
   `SESSION_SECRET` (long random string), `ADMIN_PIN` (and optionally `ADMIN_USERNAME`), `GEMINI_API_KEY`.
   Optional: `CAMPUS_TIMEZONE` (default `Asia/Manila`), `TEACHER_ACCOUNTS`.
4. Deploy, sign in at `/teacher` as the admin, and create faculty accounts, schedules and
   knowledge-base documents from the Admin Dashboard.

How it works: every API request loads the latest data from Redis, runs, and saves only the
stores it changed. Each store has its own key (`atlas:state`, `atlas:teachers`, `atlas:faculty`,
`atlas:kb:index`, and one `atlas:kb:text:<id>` / `atlas:kb:file:<id>` per document), so
unrelated edits never overwrite each other. Without the Redis variables the `data/` files are used as before.

Limits on Vercel: knowledge-base uploads up to 4 MB (Vercel's request size limit) and up to
700,000 characters of text per document; originals larger than 700 KB keep only their extracted
text (the chatbot still uses it, but the file can't be downloaded again). Two admins saving the
*same* store at the same instant: the last save wins.

Existing local data is **not** copied to Redis automatically; re-create accounts and documents
on the deployed site (or ask for a one-off import script).

## Run the website

```bash
npm install
cp .env.example .env.local     # fill in values
npm run dev                    # http://localhost:3000
```

Dev default: admin `admin` / `admin` (non-production only). Faculty accounts are created in the Admin Dashboard.

## Android: step by step

Prerequisites: Node 20+, Android Studio (with an SDK and an emulator/AVD), JDK 17 (bundled with Android Studio).

1. Install and prepare:
   ```bash
   npm install
   cp .env.capacitor.example .env.capacitor
   ```
2. **Start the website so it is reachable from Android** (listens on all interfaces):
   ```bash
   npm run dev:host
   ```
3. Create the Android project (first time only):
   ```bash
   npm run android:add
   ```
   This runs `cap add android`, adds location permissions, generates icons/splash from `resources/`, and syncs.
4. Open Android Studio:
   ```bash
   npm run android:open
   ```
   Wait for Gradle sync, choose an emulator or device in the toolbar, press **Run ▶**.
5. After changing `.env.capacitor`, re-run `npm run cap:sync`.

### Networking

| Where you test | `.env.capacitor` | Notes |
|---|---|---|
| Emulator | `CAP_TARGET=emulator` | The emulator reaches your computer's localhost at `10.0.2.2` → `http://10.0.2.2:3000`. |
| Physical device, Wi-Fi | `CAP_TARGET=device`, `CAP_DEV_HOST=<your computer's LAN IP>` | Same Wi-Fi network; allow port 3000 through the computer's firewall; server must run with `npm run dev:host`. Find IP: `ipconfig` (Windows) / `ifconfig` (macOS/Linux). |
| Physical device, USB | `CAP_TARGET=device`, `CAP_DEV_HOST=localhost` | Run `adb reverse tcp:3000 tcp:3000` after connecting (USB debugging on). |
| Deployed site | `CAP_TARGET=prod`, `CAP_PROD_URL=https://...` | HTTPS only. Plain HTTP (cleartext) is enabled only for non-prod targets. |

Switching between local and production is changing `CAP_TARGET` and running `npm run cap:sync`. The website itself is unaffected.

### Build an installable APK / AAB

Debug APK (testing, no signing setup; points at your dev target):
```bash
npm run android:apk:debug
# android/app/build/outputs/apk/debug/app-debug.apk
```
Release (uses `CAP_TARGET=prod`; requires `CAP_PROD_URL`):
1. Create a keystore once: `keytool -genkey -v -keystore atlas-release.jks -keyalg RSA -keysize 2048 -validity 10000 -alias atlas` (keep it and its passwords safe; never commit them).
2. In Android Studio: **Build → Generate Signed Bundle / APK**, or configure `signingConfigs` in `android/app/build.gradle` and run `npm run android:apk` / `npm run android:aab`.
3. Upload the `.aab` to Google Play Console.

Change the package ID with `CAP_APP_ID` **before** `npm run android:add` (default `ph.edu.cvsu.atlas`).

## iOS (future)

Requires a Mac, Xcode, and (for devices/TestFlight/App Store) a paid Apple Developer account.
```bash
npm run ios:add
npm run ios:open     # set Team, Bundle ID, signing in Xcode, then Product → Archive → Distribute
```
Apple guideline 4.2 can reject apps that are only a website wrapper; the native splash/icons, offline screen and native location permission help, but review is not guaranteed.

## Icon and splash

`resources/` holds simple generated ATLAS artwork (blue `#2433c4` with a map-pin mark). Replace `icon-only.png`, `icon-foreground.png`, `icon-background.png`, `splash.png`, `splash-dark.png` with your official logo and run `npm run cap:assets`.

## Security changes in this version

- Admin login is no longer hardcoded. Set `ADMIN_USERNAME` / `ADMIN_PIN`. In production, if `ADMIN_PIN` is unset the admin login is disabled. A teacher account named like the admin in `TEACHER_ACCOUNTS` can no longer become admin. The `admin`/`admin` default exists only in non-production.
- The "Build map nodes" tool and the "Show path nodes" toggle are hidden in production (the node builder stays available to a logged-in admin).
- `data/*.json` is runtime data and is now git-ignored.

**Production checklist:** set `SESSION_SECRET`, `ADMIN_PIN`, `GEMINI_API_KEY` (and the Upstash Redis variables on Vercel) on the server, never in the app; serve over HTTPS.

## Known limitations

- Live GPS positioning is still disabled: `GEO_ANCHORS` in `lib/geo.ts` is empty, and the on-campus bounds in `NavigationView.tsx` are for the old map size. Needs real calibration points.
- No database: data lives in `data/` files (server with a disk) or a few Upstash Redis keys (Vercel). On a server with a disk, room claims are kept in memory only and reset when the server restarts.
