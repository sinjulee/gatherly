import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: process.cwd(),
  ...(process.env.VERCEL === "1" ? { outputFileTracingExcludes: {
    "/*": ["./storage/**/*", "./backups/**/*", "./prisma/*.db*", "./prisma/*.backup*", "./.env*", "./.omc/**/*", "./docs/gatherly-2.0/v0.5_assets/**/*"],
  } } : {}),
};

export default nextConfig;
