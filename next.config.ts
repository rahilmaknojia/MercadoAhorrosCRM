import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a self-contained server bundle (.next/standalone) so the container image
  // only needs Node + the traced files, not the full node_modules. See Dockerfile.
  output: "standalone",
};

export default nextConfig;
