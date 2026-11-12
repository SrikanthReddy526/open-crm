// Open CRM desktop shell.
// Serves the React build (resources/web) from the secure custom origin app://open-crm, so that
// clean URLs, IndexedDB (offline data), localStorage, GPS and the API's CORS rules all work
// exactly like the website. No Node.js APIs are exposed to the page.
const { app, BrowserWindow, Menu, net, protocol, session, shell } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
const { pathToFileURL } = require('node:url')

const HOST = 'open-crm'
const ORIGIN = `app://${HOST}`
// `npm run dev` points the window at the Vite dev server instead of the packaged files.
const DEV_URL = process.env.ELECTRON_START_URL

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
])

function webRoot() {
  return app.isPackaged ? path.join(process.resourcesPath, 'web') : path.join(__dirname, 'web')
}

/** app://open-crm/<path> → file in the web build; unknown paths get index.html (single-page app). */
function serveApp() {
  const root = webRoot()
  protocol.handle('app', (request) => {
    const url = new URL(request.url)
    if (url.host !== HOST) return new Response('Not found', { status: 404 })
    const rel = decodeURIComponent(url.pathname).replace(/^\/+/, '')
    let file = path.normalize(path.join(root, rel))
    if (!file.startsWith(root)) return new Response('Forbidden', { status: 403 }) // no ../ escapes
    if (!rel || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(root, 'index.html')
    return net.fetch(pathToFileURL(file).toString())
  })
}

// ------------------------------------------------------------------ window size memory

const stateFile = () => path.join(app.getPath('userData'), 'window-state.json')

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(stateFile(), 'utf8'))
  } catch {
    return { width: 1280, height: 860 }
  }
}

function saveState(win) {
  try {
    const bounds = win.getNormalBounds()
    fs.writeFileSync(stateFile(), JSON.stringify({ ...bounds, maximized: win.isMaximized() }))
  } catch {
    /* not important */
  }
}

// ------------------------------------------------------------------ window

let mainWindow = null

function createWindow() {
  const state = loadState()
  mainWindow = new BrowserWindow({
    width: state.width,
    height: state.height,
    x: state.x,
    y: state.y,
    minWidth: 380,
    minHeight: 500,
    title: 'Open CRM',
    backgroundColor: '#f6f7f9',
    icon: path.join(__dirname, 'build', 'icon.png'),
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
    },
  })
  if (state.maximized) mainWindow.maximize()
  mainWindow.once('ready-to-show', () => mainWindow.show())
  mainWindow.on('close', () => saveState(mainWindow))

  // Links to other sites (maps, WhatsApp, mailto, tel) open in the normal browser / default app.
  const isAppUrl = (url) => url.startsWith(ORIGIN) || (DEV_URL && url.startsWith(DEV_URL))
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!isAppUrl(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isAppUrl(url)) {
      event.preventDefault()
      void shell.openExternal(url)
    }
  })

  void mainWindow.loadURL(DEV_URL || `${ORIGIN}/`)
}

function buildMenu() {
  const isMac = process.platform === 'darwin'
  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    { role: 'fileMenu' },
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        ...(app.isPackaged ? [] : [{ role: 'toggleDevTools' }]),
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    { role: 'windowMenu' },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

// ------------------------------------------------------------------ app lifecycle

// One window only: opening the app again focuses the existing window.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  })

  app.whenReady().then(() => {
    serveApp()
    // Allow only what the CRM uses: location (for visits/map) and notifications (reminders).
    session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
      callback(['geolocation', 'notifications', 'clipboard-sanitized-write'].includes(permission))
    })
    buildMenu()
    createWindow()
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
