import type { NextConfig } from "next";

const isGitHubPages = process.env.NEXT_DEPLOY_TARGET === "github-pages";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  ...(isGitHubPages ? { output: "export", basePath: "/UStetu" } : {}),
  trailingSlash: true,

  // GitHub Pages CI injects a unique commit SHA.
  // Vercel must not receive a fixed deploymentId such as "local".
  ...(process.env.NEXT_DEPLOYMENT_ID
    ? { deploymentId: process.env.NEXT_DEPLOYMENT_ID }
    : {}),
};

export default nextConfig;
