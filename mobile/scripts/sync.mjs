// Builds the React app for the phone and copies it into the native projects.
//   node scripts/sync.mjs lan   → API on your PC over Wi-Fi (http), for testing
//   node scripts/sync.mjs prod  → API at the https URL in web/.env.mobile, for release
import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const mobileDir = join(dirname(fileURLToPath(import.meta.url)), '..')
const webDir = join(mobileDir, '..', 'web')
const target = process.argv[2] === 'lan' ? 'lan' : 'prod'
const mode = target === 'lan' ? 'lan' : 'mobile'
const envFile = join(webDir, target === 'lan' ? '.env.lan.local' : '.env.mobile')

if (!existsSync(envFile)) {
  console.error(`Missing ${envFile}. See web/.env.lan.example.`)
  process.exit(1)
}
const apiUrl = /^VITE_API_URL=(.*)$/m.exec(readFileSync(envFile, 'utf8'))?.[1]?.trim() ?? ''
if (!apiUrl) {
  console.error(`VITE_API_URL is empty in ${envFile}`)
  process.exit(1)
}
if (target === 'prod' && (!apiUrl.startsWith('https://') || apiUrl.includes('example.com'))) {
  console.error(`Set your real https API URL in ${envFile} (currently "${apiUrl}")`)
  process.exit(1)
}
console.log(`\n▶ Building web app (mode=${mode}) with API ${apiUrl}\n`)

const env = { ...process.env, CAP_ALLOW_HTTP: target === 'lan' ? 'true' : 'false' }
execSync(`npm run build -- --mode ${mode}`, { cwd: webDir, stdio: 'inherit', env })
execSync('npx cap sync', { cwd: mobileDir, stdio: 'inherit', env })
