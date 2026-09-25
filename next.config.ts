import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a self-contained server bundle (.next/standalone) so the container image
  // only needs Node + the traced files, not the full node_modules. See Dockerfile.
  output: "standalone",
  experimental: {
    // src/proxy.ts runs on every request, and Next buffers request bodies for proxy up to this
    // size — silently truncating anything larger before the route handler sees it. The default
    // (10 MB) is too small for the legacy compliance review import, whose CSV carries a base64
    // signature per row; the API accepts up to 64 MB for it.
    proxyClientMaxBodySize: "64mb",
  },
};

export default nextConfig;
