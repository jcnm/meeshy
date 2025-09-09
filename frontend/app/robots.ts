import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NODE_ENV === 'production' ? 'https://meeshy.me' : 'http://localhost:3100'
  
  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          '/about',
          '/contact',
          '/partners',
          '/privacy',
          '/terms',
          '/en/*',
          '/pt/*',
          '/api/health',
          '/_next/static/*',
          '/images/*',
          '/favicon.ico',
          '/sitemap.xml',
          '/robots.txt',
        ],
        disallow: [
          '/dashboard',
          '/conversations',
          '/chat/*',
          '/api/*',
          '/admin',
          '/_next/*',
          '/private/*',
          '/temp/*',
          '/logs/*',
          '/.env*',
          '/node_modules/*',
          '/.git/*',
          '/.next/*',
          '/coverage/*',
          '/test/*',
          '/__tests__/*',
          '/dist/*',
          '/build/*',
        ],
      },
      {
        userAgent: 'GPTBot',
        disallow: '/',
      },
      {
        userAgent: 'ChatGPT-User',
        disallow: '/',
      },
      {
        userAgent: 'CCBot',
        disallow: '/',
      },
      {
        userAgent: 'anthropic-ai',
        disallow: '/',
      },
      {
        userAgent: 'Claude-Web',
        disallow: '/',
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  }
}