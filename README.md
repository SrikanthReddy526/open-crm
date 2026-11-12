# Open CRM

Open-source CRM: one Spring Boot API + one React codebase, delivered as a website, PWA,
Android/iOS app (Capacitor) and desktop app (Electron). English and Telugu.

| Folder | What |
|---|---|
| `backend/` | Spring Boot 4 REST API (Java 17+, PostgreSQL + PostGIS, Flyway, JWT) |
| `web/` | React 19 + TypeScript + Vite — the only UI code |
| `mobile/` | Capacitor 8 shell for Android/iOS (config + native projects, no UI code) |
| `desktop/` | Electron shell for Windows/macOS/Linux (packages `web/dist`, no UI code) |
| `deploy/` | Docker Compose files (dev database, production stack), backup script |
| `docs/API.md` | REST endpoint list |
| `docs/DEPLOY.md` | Putting it on the internet with HTTPS |

## Features

- **Customers** — search, CSV import/export, GPS location, "nearby", call / WhatsApp / navigate buttons
- **Map** — all customers on OpenStreetMap, "near me" list within 5 km
- **Field visits** — log a visit with outcome, notes and GPS position, **works without internet**
- **Follow-up reminders** — due today / overdue / this week, snooze, desktop pop-up alerts
- **Support tickets** — priorities, assignment, replies, internal staff notes, status history
- **Leads → customers** — status pipeline, one-click convert (optionally with a first deal)
- **Deals** — list and pipeline board, amounts in ₹ (lakh/crore), won/lost tracking
- **Dashboard** — the day's numbers per role
- **Users & devices** — roles (admin / support agent / field staff), deactivate, reset password,
  see every logged-in device and log it out remotely
- **Offline sync** — customers, visits and reminders are kept on the device; changes made offline are
  sent automatically when the connection is back (conflicts: the server copy wins and the user is told)
- **English and తెలుగు** everywhere, light and dark mode, phone-friendly layout

## Prerequisites (all free / open source)

| Tool | Version | Notes |
|---|---|---|
| JDK | 17+ (21 recommended) | [Eclipse Temurin](https://adoptium.net) |
| Node.js | 20+ | |
| Docker Desktop | latest | runs PostgreSQL + PostGIS (Docker Engine on Linux) |
| Maven | — | not needed, the project includes `mvnw` |

## Run the website locally

```powershell
# 1. Database (first run downloads the image)
docker compose -f deploy/docker-compose.dev.yml up -d

# 2. API  → http://localhost:8080   (Flyway creates the tables on first start)
cd backend
.\mvnw spring-boot:run          # macOS/Linux: ./mvnw spring-boot:run

# 3. Web app (new terminal)  → http://localhost:5173
cd web
npm install
npm run dev
```

Log in with the first admin account created on the first start:
**admin@opencrm.local / admin123** (change it; in production set `ADMIN_EMAIL` / `ADMIN_PASSWORD`).

### Create test users for the other roles

```powershell
$login = Invoke-RestMethod -Method Post -Uri http://localhost:8080/api/auth/login `
  -ContentType 'application/json' -Body '{"email":"admin@opencrm.local","password":"admin123"}'
$h = @{ Authorization = "Bearer $($login.accessToken)" }
Invoke-RestMethod -Method Post -Uri http://localhost:8080/api/users -Headers $h -ContentType 'application/json' `
  -Body '{"email":"field@opencrm.local","password":"field12345","fullName":"Field Staff","role":"FIELD_STAFF","preferredLanguage":"te"}'
Invoke-RestMethod -Method Post -Uri http://localhost:8080/api/users -Headers $h -ContentType 'application/json' `
  -Body '{"email":"support@opencrm.local","password":"support12345","fullName":"Support Agent","role":"SUPPORT_AGENT"}'
```

### Open it from a phone/tablet on the same Wi-Fi

1. Find your PC's IP: `ipconfig` → "IPv4 Address", e.g. `192.168.1.20`.
2. On the phone open `http://192.168.1.20:5173`.
   Vite listens on the network (`host: true`) and forwards `/api` to Spring Boot, so only port 5173 is needed.
3. If it doesn't load: allow **Node.js** through Windows Defender Firewall for **Private** networks,
   and make sure the Wi-Fi is set to a *Private* network in Windows.

Note: browsers only allow GPS ("Use my current location") on HTTPS or `localhost`.
Over plain `http://192.168.x.x` that button will fail on phones — the Android app (Capacitor) and the
deployed HTTPS site don't have this limitation.

## Android app (Capacitor)

The app wraps the same React build (`web/dist`) — there is no separate mobile UI code.

### One-time setup
1. Install **[Android Studio](https://developer.android.com/studio)** (free). It includes the Android SDK
   and the JDK 21 that Capacitor 8 needs — you don't have to change your system Java.
2. In Android Studio → *More Actions → SDK Manager*: make sure **Android SDK Platform 36** is installed.
3. On your phone: *Settings → About phone →* tap **Build number** 7 times → *Developer options →*
   enable **USB debugging**. Connect it by USB (or create an emulator in *Device Manager*).
4. `cd mobile && npm install`

### Test on your phone against the API on this PC
1. Start the database and API (see "Run the website locally").
2. Allow the API through Windows Firewall (PowerShell **as Administrator**, once):
   ```powershell
   New-NetFirewallRule -DisplayName "Open CRM API 8080" -Direction Inbound -Protocol TCP -LocalPort 8080 -Action Allow -Profile Private
   ```
   Check from the phone's browser: `http://<PC-IP>:8080/api/health` should show `{"status":"UP"}`.
3. Put your PC's IP in `web/.env.lan.local` (`VITE_API_URL=http://<PC-IP>:8080`).
4. Build + open Android Studio:
   ```powershell
   cd mobile
   npm run android:lan
   ```
5. In Android Studio wait for Gradle sync, pick your phone at the top and press **Run ▶**.

After changing React code, run `npm run sync:lan` again and press Run.

**Live reload (optional, faster UI work):** with `npm run dev` running in `web/`, run
`npm run dev:android` in `mobile/` — the app loads straight from Vite and refreshes on save.
(GPS doesn't work in this mode because the page isn't on a secure origin; use `sync:lan` to test GPS.)

### Release build (Play Store / sharing an APK)
1. Deploy the API with HTTPS, then set `VITE_API_URL=https://your-domain` in `web/.env.mobile`.
2. `npm run sync:prod` (it refuses to build with an http or placeholder URL).
3. Android Studio → *Build → Generate Signed App Bundle / APK* → create a keystore (**back it up — you need
   the same key for every future update**) → `release`.
   - `.apk` → install directly on phones; `.aab` → upload to Google Play.
4. Change the app version in `mobile/android/app/build.gradle` (`versionCode` +1, `versionName`) for each release.

**App icon & splash:** put a 1024×1024 `icon.png` (and optional `splash.png`) in `mobile/assets/`,
then `npx @capacitor/assets generate --android`.

**iOS:** needs a Mac with Xcode: `npx cap add ios`, then `npx cap open ios`. Same web code.

## Desktop app (Electron)

Wraps the same React build for Windows, macOS and Linux. Pages are served from the secure origin
`app://open-crm`, so offline data, GPS and notifications work like on the website.

```powershell
cd desktop
npm install
npm run dev          # window on the Vite dev server (start `npm run dev` in web/ first)
npm start            # window on the built files (uses VITE_API_URL from web/.env.desktop)
npm run build        # installer → desktop/release/Open CRM Setup x.y.z.exe
```

For a release, build against your HTTPS server: `$env:OPENCRM_API_URL="https://crm.example.com"; npm run build`.
The installer is not code-signed, so Windows SmartScreen shows "unknown publisher" → *More info → Run anyway*
(buying a code-signing certificate removes that). macOS/Linux builds must be made on those systems.

## Install as an app from the website (PWA)

The production website is installable: Chrome/Edge → *Install app* (desktop) or *Add to Home screen* (Android),
Safari → *Share → Add to Home Screen* (iPhone). The app shell then opens without internet. In development the
service worker is off; test it with `npm run build && npm run preview` in `web/`.

## Production deployment

See **[docs/DEPLOY.md](docs/DEPLOY.md)** — one Linux server (free Oracle Cloud tier or ~€4/month),
Docker Compose with PostgreSQL + PostGIS, the API, and Caddy for automatic HTTPS. Nightly backups included.

## Configuration (environment variables)

| Variable | Default (dev) | Purpose |
|---|---|---|
| `DB_URL` | `jdbc:postgresql://localhost:5432/opencrm` | database |
| `DB_USER` / `DB_PASSWORD` | `opencrm` / `opencrm` | |
| `JWT_SECRET` | dev value | **required in prod**, ≥ 32 chars |
| `JWT_ACCESS_MINUTES` / `JWT_REFRESH_DAYS` | 15 / 30 | token lifetimes |
| `CORS_ORIGINS` | localhost, LAN, Capacitor, Electron | allowed web origins |
| `APP_TIMEZONE` | Asia/Kolkata | time zone for "due today", "this month" |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | admin@opencrm.local / admin123 | first admin (only if no users exist) |
| `VITE_API_URL` (web build) | empty = same origin | full API URL for mobile/desktop builds |
| `VITE_TILE_URL` (web build) | OpenStreetMap | map tile server, e.g. your own for heavy use |

## Tests

```powershell
cd backend; .\mvnw test
cd web; npm run build; npm run lint
```

## License

Apache-2.0
