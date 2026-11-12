// Builds the React app for the desktop and packages the installer.
//   node scripts/build.mjs               → installer in desktop/release/ (Windows .exe on Windows)
//   node scripts/build.mjs --dir         → unpacked app only (quick test, no installer)
//   node scripts/build.mjs --no-package  → only build + copy the web files (used by `npm start`)
// API address: OPENCRM_API_URL env var, else VITE_API_URL in web/.env.desktop
import { execSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const desktopDir = join(dirname(fileURLToPath(import.meta.url)), '..')
const webDir = join(desktopDir, '..', 'web')
const args = process.argv.slice(2)

const envFile = join(webDir, '.env.desktop')
const fromFile = existsSync(envFile) ? /^VITE_API_URL=(.*)$/m.exec(readFileSync(envFile, 'utf8'))?.[1]?.trim() : ''
const apiUrl = (process.env.OPENCRM_API_URL ?? fromFile ?? '').trim()
if (!/^https?:\/\//.test(apiUrl)) {
  console.error('Set the API address: OPENCRM_API_URL=https://crm.example.com, or VITE_API_URL in web/.env.desktop')
  process.exit(1)
}
if (apiUrl.startsWith('http://') && !/localhost|127\.0\.0\.1|192\.168\./.test(apiUrl)) {
  console.warn(`⚠ ${apiUrl} is not https — use https for a real deployment.`)
}

console.log(`\n▶ Building web app for desktop with API ${apiUrl}\n`)
execSync('npm run build -- --mode desktop', {
  cwd: webDir,
  stdio: 'inherit',
  env: { ...process.env, VITE_API_URL: apiUrl },
})

const target = join(desktopDir, 'web')
rmSync(target, { recursive: true, force: true })
mkdirSync(target, { recursive: true })
cpSync(join(webDir, 'dist'), target, { recursive: true })
// The website's service worker is never used in the desktop app.
for (const f of ['sw.js', 'registerSW.js']) rmSync(join(target, f), { force: true })

mkdirSync(join(desktopDir, 'build'), { recursive: true })
cpSync(join(webDir, 'public', 'pwa-512x512.png'), join(desktopDir, 'build', 'icon.png'))

if (args.includes('--no-package')) process.exit(0)
console.log('\n▶ Packaging with electron-builder\n')
execSync(`npx electron-builder ${args.includes('--dir') ? '--dir' : ''}`, { cwd: desktopDir, stdio: 'inherit' })
