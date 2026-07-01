import {
  app,
  BrowserWindow,
  shell,
  Menu,
} from 'electron'
import * as path from 'path'
import * as childProcess from 'child_process'
import { waitForServer } from './wait-for-server'

// ── Constants ──────────────────────────────────────────────────────────────────
const DEV = process.env.IS_DEV === 'true'
const PORT = 3000
const APP_URL = `http://localhost:${PORT}`

let mainWindow: BrowserWindow | null = null
let nextServer: childProcess.ChildProcess | null = null

// ── Create Window ──────────────────────────────────────────────────────────────
function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 600,
    show: false, // show only after content loads
    autoHideMenuBar: true,
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,   // ✅ security: isolate renderer from main
      nodeIntegration: false,   // ✅ security: no Node in renderer
      sandbox: true,            // ✅ security: sandbox renderer process
      webSecurity: true,        // ✅ security: enforce same-origin
    },
  })

  // Hide the native menu bar completely
  Menu.setApplicationMenu(null)

  // Show window gracefully once ready
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  // Open external links in the default system browser, not in Electron
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

// ── Start Next.js server (production only) ────────────────────────────────────
function startNextServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    // Resolve the project root (two levels up from electron-dist/main.js)
    const projectRoot = path.join(__dirname, '..')

    nextServer = childProcess.spawn(
      process.execPath.replace('electron.exe', 'node.exe').replace('electron', 'node'),
      [path.join(projectRoot, 'node_modules', '.bin', 'next'), 'start', '--port', String(PORT)],
      {
        cwd: projectRoot,
        env: { ...process.env, NODE_ENV: 'production' },
        shell: true,
        windowsHide: true, // ✅ no terminal window visible on Windows
      }
    )

    nextServer.stdout?.on('data', (data: Buffer) => {
      const msg = data.toString()
      console.log('[next]', msg)
    })

    nextServer.stderr?.on('data', (data: Buffer) => {
      const msg = data.toString()
      console.error('[next error]', msg)
    })

    nextServer.on('error', (err) => {
      console.error('Failed to start Next.js server:', err)
      reject(err)
    })

    // The process started; actual readiness is checked by waitForServer
    resolve()
  })
}

// ── App Lifecycle ──────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  try {
    if (!DEV) {
      // In production: start Next.js server ourselves, then wait for it
      await startNextServer()
    }

    // Wait until the Next.js server actually responds (dev or prod)
    await waitForServer(APP_URL, 60_000)

    createWindow()
    mainWindow?.loadURL(APP_URL)
  } catch (err) {
    console.error('Failed to launch:', err)
    app.quit()
  }

  app.on('activate', () => {
    // macOS: re-open window when dock icon is clicked
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
      mainWindow?.loadURL(APP_URL)
    }
  })
})

app.on('window-all-closed', () => {
  // On Windows/Linux: quit when all windows are closed
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  // Cleanly kill the Next.js child process if we spawned it
  if (nextServer && !nextServer.killed) {
    nextServer.kill()
    nextServer = null
  }
})
