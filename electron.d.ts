/**
 * Global type declarations for the Electron preload API.
 *
 * This file is automatically included by TypeScript (it's in the project root
 * and matched by tsconfig.json's include patterns).
 *
 * Provides type safety when accessing `window.electronAPI` inside Next.js pages.
 */
interface ElectronAPI {
  /** Current platform string: 'win32' | 'darwin' | 'linux' */
  platform: NodeJS.Platform
  /** True when running inside Electron, undefined in a normal browser */
  isElectron: boolean
  /** Send a one-way IPC message to the main process */
  send: (channel: string, data?: unknown) => void
  /** Send an IPC message and await a response from the main process */
  invoke: (channel: string, data?: unknown) => Promise<unknown>
}

interface Window {
  electronAPI?: ElectronAPI
}
