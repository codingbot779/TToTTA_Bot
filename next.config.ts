import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Google 프로필 이미지
    remotePatterns: [{ protocol: "https", hostname: "*.googleusercontent.com" }],
  },
  // PDF 파서(네이티브 canvas 포함)는 번들하지 않고 Node에서 직접 로드
  serverExternalPackages: ["pdf-parse", "@napi-rs/canvas", "xlsx", "cfb"],
};

export default nextConfig;
