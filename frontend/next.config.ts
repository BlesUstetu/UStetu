import type { NextConfig } from "next";

const isGitHubPages = process.env.NEXT_DEPLOY_TARGET === "github-pages";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "export",
  basePath: isGitHubPages ? "/UStetu" : "",
  trailingSlash: true,

  // Version/cache skew protection for static deployments.
  // CI injects the commit SHA so every deployment gets a unique asset version.
  deploymentId: process.env.NEXT_DEPLOYMENT_ID ?? "local",
};

export default nextConfig;
