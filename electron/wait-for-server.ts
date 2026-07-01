/**
 * waitForServer
 *
 * Polls the given URL until it returns a successful HTTP response (2xx/3xx),
 * or until the timeout expires.
 *
 * Used by the Electron main process to hold off loading the BrowserWindow
 * until the Next.js server (dev or prod) is actually ready to serve pages.
 */
import * as http from 'http'
import * as https from 'https'

/**
 * @param url       Full URL to poll, e.g. "http://localhost:3000"
 * @param timeoutMs Maximum total wait time in milliseconds (default 60s)
 * @param intervalMs How often to retry in milliseconds (default 500ms)
 */
export function waitForServer(
  url: string,
  timeoutMs = 60_000,
  intervalMs = 500
): Promise<void> {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now()
    const protocol = url.startsWith('https') ? https : http

    function attempt() {
      const elapsed = Date.now() - startedAt
      if (elapsed >= timeoutMs) {
        reject(
          new Error(
            `Timed out after ${timeoutMs}ms waiting for server at ${url}`
          )
        )
        return
      }

      const req = protocol.get(url, (res) => {
        // Any response (even 404) means the server is up
        if (res.statusCode && res.statusCode < 500) {
          resolve()
        } else {
          // Server returned a 5xx — retry
          res.resume()
          setTimeout(attempt, intervalMs)
        }
      })

      req.on('error', () => {
        // Connection refused / ECONNREFUSED — server not up yet, retry
        setTimeout(attempt, intervalMs)
      })

      req.setTimeout(intervalMs, () => {
        req.destroy()
        setTimeout(attempt, intervalMs)
      })
    }

    // First attempt immediately
    attempt()
  })
}
