import type { NextConfig } from "next";
// Plugin next-intl désactivé pour éviter les redirections d'URL
// L'internationalisation est gérée côté client via le LanguageContext
// import createNextIntlPlugin from 'next-intl/plugin';

// const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // Configuration Docker - disabled standalone for now
  // output: 'standalone',
  
  // Configuration des images
  images: {
    domains: ['localhost', 'meeshy.me', 'gate.meeshy.me', 'ml.meeshy.me'],
    unoptimized: true
  },
  
  // Configuration API
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_BACKEND_URL || 'https://gate.meeshy.me'}/:path*`
      }
    ];
  },
  
  // Variables d'environnement publiques
  env: {
    NEXT_PUBLIC_BACKEND_URL: process.env.NEXT_PUBLIC_BACKEND_URL || 'https://gate.meeshy.me',
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL || 'wss://gate.meeshy.me',
    NEXT_PUBLIC_TRANSLATION_URL: process.env.NEXT_PUBLIC_TRANSLATION_URL || 'https://ml.meeshy.me',
  },
  
  // Configuration WebPack pour Docker
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    return config;
  },
};

export default nextConfig;
