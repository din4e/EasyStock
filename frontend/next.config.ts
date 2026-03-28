import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n.ts');

const nextConfig: NextConfig = {
  ...(process.env.NODE_ENV === "production" ? { output: "standalone" } : {}),
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api/v1",
  },
  // 允许局域网设备访问开发服务器
  allowedDevOrigins: ["192.168.30.81", "localhost", "127.0.0.1"],
};

export default withNextIntl(nextConfig);
