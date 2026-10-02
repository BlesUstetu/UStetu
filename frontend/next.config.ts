import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "export",
  basePath: "/UStetu",
  trailingSlash: true,

  // Version/cache skew protection for static GitHub Pages deployments.
  // CI injects the commit SHA so every deployment gets a unique asset version.
  deploymentId: process.env.NEXT_DEPLOYMENT_ID ?? "local",
};

export default nextConfig;
