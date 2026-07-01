/**
 * Electron Preload Script
 *
 * This script runs in a privileged context BEFORE the renderer page loads.
 * It uses contextBridge to safely expose controlled APIs to the renderer,
 * without ever exposing raw Node.js / Electron APIs.
 *
 * Security: contextIsolation=true means the renderer cannot access this
 * scope directly — only what we explicitly expose via contextBridge.
 */
import { contextBridge, ipcRenderer } from 'electron'

// Expose a typed, limited API to the renderer (window.electronAPI)
contextBridge.exposeInMainWorld('electronAPI', {
  /**
   * Returns the current platform string ('win32', 'darwin', 'linux').
   * Useful for conditional UI in the renderer.
   */
  platform: process.platform,

  /**
   * Returns true when running inside Electron (vs a normal browser).
   * The renderer can use this to show desktop-specific UI.
   */
  isElectron: true,

  /**
   * Example: send a one-way message to the main process.
   * Add handlers in main.ts with ipcMain.on('channel', ...) as needed.
   */
  send: (channel: string, data?: unknown) => {
    // Allowlist channels to avoid arbitrary IPC abuse
    const allowed = ['app:minimize', 'app:maximize', 'app:quit']
    if (allowed.includes(channel)) {
      ipcRenderer.send(channel, data)
    }
  },

  /**
   * Example: request a value from the main process and get a response.
   */
  invoke: (channel: string, data?: unknown): Promise<unknown> => {
    const allowed = ['app:version']
    if (allowed.includes(channel)) {
      return ipcRenderer.invoke(channel, data)
    }
    return Promise.reject(new Error(`IPC channel not allowed: ${channel}`))
  },
})

// TypeScript declaration — keeps renderer code typed
// Add this to a global.d.ts in your Next.js app if you use window.electronAPI
export {}
