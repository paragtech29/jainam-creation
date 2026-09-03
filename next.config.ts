import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets the owner open the dev server from his phone on the same Wi-Fi.
  allowedDevOrigins: ["192.168.1.5"],
  // Next's dev badge renders bottom-left, on top of the sidebar account
  // block. It never ships to production; off so dev looks like prod.
  devIndicators: false,
};

export default nextConfig;
