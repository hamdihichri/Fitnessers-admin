/** @type {import('next').NextConfig} */
const nextConfig = {
  // Do not send the X-Powered-By header
  poweredByHeader: false,
  // Produce a standalone server bundle — required for packaged Electron apps.
  // This makes `next start` work without resolving from the project's node_modules.
  output: 'standalone',
  // Disable the built-in image optimizer; it relies on sharp/libjpeg which are
  // not available in the sandboxed Electron resources folder.
  images: {
    unoptimized: true,
  },
}

module.exports = nextConfig
