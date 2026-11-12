// Starts the desktop window.
//   node scripts/dev.mjs          → loads the Vite dev server (run `npm run dev` in web/ first); UI changes show instantly
//   node scripts/dev.mjs --local  → loads the built files in desktop/web (after `node scripts/build.mjs --no-package`)
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const desktopDir = join(dirname(fileURLToPath(import.meta.url)), '..')
const env = { ...process.env }
// VS Code terminals set ELECTRON_RUN_AS_NODE, which would start Electron as plain Node.
delete env.ELECTRON_RUN_AS_NODE
if (process.argv.includes('--local')) delete env.ELECTRON_START_URL
else env.ELECTRON_START_URL ??= 'http://localhost:5173'

const child = spawn('npx', ['electron', '.'], { cwd: desktopDir, stdio: 'inherit', shell: true, env })
child.on('exit', (code) => process.exit(code ?? 0))
