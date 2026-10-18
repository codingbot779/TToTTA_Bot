import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Google 프로필 이미지
    remotePatterns: [{ protocol: "https", hostname: "*.googleusercontent.com" }],
  },
};

export default nextConfig;
