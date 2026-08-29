import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /*
   * Standalone output, except on Vercel.
   *
   * The Docker image needs it: the Dockerfile copies `.next/standalone` and
   * runs `node server.js`, so without this there is nothing to run and no
   * node_modules to fall back on.
   *
   * Vercel cannot use it. Its own post-build step reads the file trace that
   * standalone mode replaces, and fails with a bare
   * `ENOENT … .next/next-server.js.nft.json` *after* a build that otherwise
   * succeeded — which reads like a missing file rather than a mode conflict.
   * `VERCEL=1` is set in every Vercel build environment, so the two targets
   * each get the output they can actually consume.
   */
  output: process.env.VERCEL ? undefined : "standalone",
  // Without this Turbopack walks up past the repo looking for a lockfile and
  // picks up an unrelated one from the home directory.
  turbopack: { root: __dirname },
  // This repo documents itself in README.md and docs/; don't generate a second
  // set of agent instruction files on every dev boot.
  agentRules: false,
};

export default nextConfig;
