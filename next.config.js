/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [],
  },
  output: 'standalone',
  webpack: (config) => {
    // Mark ssh2 as external to avoid webpack tracing into it and trying to
    // parse its native .node binary (sshcrypto.node).  dockerode uses only
    // unix-socket transport in this app, so ssh2 is never required at runtime
    // — Node.js resolves it directly from node_modules if it ever is.
    config.externals = [...(config.externals || []), 'ssh2']
    return config
  },
}

module.exports = nextConfig
