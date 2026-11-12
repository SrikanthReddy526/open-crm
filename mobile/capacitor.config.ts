import type { CapacitorConfig } from '@capacitor/cli'

/**
 * The app has no UI code of its own: it packages the React build from ../web/dist.
 *
 * Set CAP_ALLOW_HTTP=true before `npx cap sync` ONLY for a test build that talks to a
 * plain-http API on your LAN (e.g. VITE_API_URL=http://192.168.29.186:8080).
 * Production builds must use an https API and leave it unset.
 */
const allowHttp = process.env.CAP_ALLOW_HTTP === 'true'

const config: CapacitorConfig = {
  appId: 'org.opencrm.app',
  appName: 'Open CRM',
  webDir: '../web/dist',
  server: {
    // App pages are served from https://localhost (an allowed CORS origin in the API).
    androidScheme: allowHttp ? 'http' : 'https',
    cleartext: allowHttp,
  },
  android: {
    allowMixedContent: allowHttp,
  },
}

export default config
