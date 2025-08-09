import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  // Configuration Docker
  output: 'standalone',
  
  // Configuration des images (désactiver Sharp en production Docker)
  images: {
    domains: ['localhost'],
    unoptimized: true,
  },
  
  // Experimental pour éviter les problèmes avec Sharp
  serverExternalPackages: ['sharp'],
  
  // Configuration optimisée pour éviter les timeouts de build
  experimental: {
    optimizeCss: false, // Désactiver l'optimisation CSS pendant le build
  },
  
  // Configuration pour éviter les timeouts avec Google Fonts
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ]
  },
  
  // Configuration API - Routes directes vers la gateway via buildApiUrl
  // Les rewrites automatiques sont désactivés pour éviter la confusion
  // Tous les appels API doivent passer par buildApiUrl() qui pointe directement vers la gateway
  
  // Variables d'environnement publiques
  env: {
    NEXT_PUBLIC_BACKEND_URL: process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000',
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3000',
    NEXT_PUBLIC_TRANSLATION_URL: process.env.NEXT_PUBLIC_TRANSLATION_URL || 'http://localhost:8000',
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
