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
   *
   * Opt in from the Dockerfile rather than detecting Vercel: `VERCEL=1` is only
   * present when a project has "Automatically expose System Environment
   * Variables" switched on, so keying off it means the build mode depends on a
   * setting in someone's dashboard. The only build that needs standalone is the
   * one we control, so that build is the one that asks for it.
   */
  output: process.env.BUILD_STANDALONE === "1" ? "standalone" : undefined,
  // Without this Turbopack walks up past the repo looking for a lockfile and
  // picks up an unrelated one from the home directory.
  turbopack: { root: __dirname },
  // This repo documents itself in README.md and docs/; don't generate a second
  // set of agent instruction files on every dev boot.
  agentRules: false,
};

export default nextConfig;
