import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets the owner open the dev server from his phone on the same Wi-Fi.
  allowedDevOrigins: ["192.168.1.5"],
  /* config options here */
};

export default nextConfig;
