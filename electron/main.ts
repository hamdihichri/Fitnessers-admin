import {
  app,
  BrowserWindow,
  shell,
  Menu,
} from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import * as childProcess from 'child_process'
import { waitForServer } from './wait-for-server'

// ── Constants ────────────────────────────────────────────────────────────────
const DEV = process.env.IS_DEV === 'true'
const PORT = 3000
const APP_URL = `http://localhost:${PORT}`

let mainWindow: BrowserWindow | null = null
let nextServer: childProcess.ChildProcess | null = null


// ── Load .env.local for server-side variables ────────────────────────────────
// Next.js standalone server.js does NOT auto-load .env.local at runtime.
// We must read it here in the Electron main process and pass the values
// explicitly to the spawned child process so that ADMIN_EMAIL, ADMIN_PASSWORD,
// JWT_SECRET, etc. are available inside the API routes.
function loadEnvFile(projectRoot: string): Record<string, string> {
  const envVars: Record<string, string> = {}

  // Candidate .env files in priority order (matches Next.js resolution)
  const candidates = [
    path.join(projectRoot, '.env.local'),
    path.join(projectRoot, '.env.production'),
    path.join(projectRoot, '.env'),
  ]

  for (const envPath of candidates) {
    if (!fs.existsSync(envPath)) continue
    console.log('[env] Loading', envPath)
    const content = fs.readFileSync(envPath, 'utf-8')
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eqIdx = trimmed.indexOf('=')
      if (eqIdx === -1) continue
      const key = trimmed.slice(0, eqIdx).trim()
      const val = trimmed.slice(eqIdx + 1).trim()
      // Only set if not already defined (first file wins)
      if (!(key in envVars)) {
        envVars[key] = val
      }
    }
    break // only load first file found
  }

  return envVars
}


// ── Resolve the Node.js executable ──────────────────────────────────────────
// In the packaged app process.execPath is "OpenGym Admin.exe", NOT "electron.exe".
// The simple string-replace would silently return the wrong path and Electron
// would spawn *itself* as the Next.js server, causing an infinite launch loop.
// Instead we look for node.exe next to the Electron binary, then fall back to
// the system PATH.
function resolveNodeExecutable(): string {
  const electronDir = path.dirname(process.execPath)
  const candidates = [
    path.join(electronDir, 'node.exe'),                  // bundled alongside electron.exe
    path.join(electronDir, 'resources', 'node.exe'),     // some electron-builder layouts
    'node',                                               // system PATH fallback
  ]
  for (const candidate of candidates) {
    if (candidate === 'node') return candidate            // always accept PATH fallback
    if (fs.existsSync(candidate)) return candidate
  }
  return 'node'
}


// ── Create Window ────────────────────────────────────────────────────────────
function createWindow(): void {

  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'build', 'icon.ico')
    : path.join(__dirname, '..', 'build', 'icon.ico')


  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    icon: iconPath,

    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  })


  Menu.setApplicationMenu(null)


  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })


  mainWindow.webContents.setWindowOpenHandler(({ url }) => {

    if (!url.startsWith(APP_URL)) {
      shell.openExternal(url)
      return { action: 'deny' }
    }

    return { action: 'allow' }
  })


  mainWindow.webContents.on('will-navigate', (event, url) => {

    if (!url.startsWith(APP_URL)) {
      event.preventDefault()
      shell.openExternal(url)
    }

  })


  mainWindow.on('closed', () => {
    mainWindow = null
  })
}



// ── Start Next.js server (production only) ───────────────────────────────────
function startNextServer(): Promise<void> {

  return new Promise((resolve, reject) => {


    const projectRoot = app.isPackaged
      ? path.join(process.resourcesPath, 'app')
      : path.join(__dirname, '..')

    // With `output: 'standalone'`, Next.js generates a self-contained server
    // at .next/standalone/server.js — no need to invoke the `next` CLI.
    const standaloneDir = path.join(projectRoot, '.next', 'standalone')
    const serverScript = path.join(standaloneDir, 'server.js')

    const nodeExec = resolveNodeExecutable()

    console.log('Node executable:', nodeExec)
    console.log('Project root:', projectRoot)
    console.log('Standalone server:', serverScript)

    // Guard: if server.js doesn't exist the app would hang waiting for the
    // port to open. Fail fast with a clear error instead.
    if (!fs.existsSync(serverScript)) {
      const msg = `Next.js standalone server not found at:\n${serverScript}\n\nRun "npm run build" before packaging.`
      console.error(msg)
      reject(new Error(msg))
      return
    }

    // Load server-side env vars from .env.local (not bundled by Next.js
    // standalone — must be passed explicitly to the child process).
    const envFileVars = loadEnvFile(projectRoot)

    nextServer = childProcess.spawn(

      nodeExec,

      [serverScript],

      {
        // cwd must be the standalone dir so it can find its own node_modules
        cwd: standaloneDir,
        env: {
          ...process.env,
          // Explicit env file vars come first so they are not overridden by
          // an empty process.env entry on Windows.
          ...envFileVars,
          NODE_ENV: 'production',
          PORT: String(PORT),
          HOSTNAME: '127.0.0.1',
        },
        windowsHide: true,
        shell: false
      }

    )


    nextServer.stdout?.on('data', (data: Buffer) => {
      console.log('[next]', data.toString())
    })


    nextServer.stderr?.on('data', (data: Buffer) => {
      console.error('[next error]', data.toString())
    })


    nextServer.on('error', (err) => {

      console.error(
        'Failed to start Next.js server:',
        err
      )

      reject(err)

    })


    resolve()

  })

}



// ── App Lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(async () => {

  try {


    if (!DEV) {

      await startNextServer()

    }


    await waitForServer(
      APP_URL,
      60000
    )


    createWindow()

    mainWindow?.loadURL(APP_URL)



  } catch (err) {

    console.error(
      'Failed to launch:',
      err
    )

    app.quit()

  }



  app.on('activate', () => {

    if (BrowserWindow.getAllWindows().length === 0) {

      createWindow()

      mainWindow?.loadURL(APP_URL)

    }

  })


})



app.on('window-all-closed', () => {

  if (process.platform !== 'darwin') {

    app.quit()

  }

})



app.on('before-quit', () => {


  if (nextServer && !nextServer.killed) {

    nextServer.kill()

    nextServer = null

  }


})