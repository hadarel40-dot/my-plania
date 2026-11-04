import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    // מתקן את הייצוא ב-iPhone: כל ספריות הייצוא משתמשות באותו Symbol.dispose (ראו build/dispose-loader.cjs)
    config.module.rules.push({
      test: /[\\/]node_modules[\\/](@remotion[\\/](web-renderer|media)|mediabunny)[\\/].*\.(m?js|cjs)$/,
      use: [{ loader: path.resolve("build/dispose-loader.cjs") }],
    });
    return config;
  },
};

export default nextConfig;
