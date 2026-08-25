import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emits a self-contained server bundle with only the modules actually
  // imported, so the runtime image doesn't need node_modules at all.
  output: "standalone",
  // Without this Turbopack walks up past the repo looking for a lockfile and
  // picks up an unrelated one from the home directory.
  turbopack: { root: __dirname },
  // This repo documents itself in README.md and docs/; don't generate a second
  // set of agent instruction files on every dev boot.
  agentRules: false,
};

export default nextConfig;
