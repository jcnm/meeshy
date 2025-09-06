import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NODE_ENV === 'production' ? 'https://meeshy.com' : 'http://localhost:3100';

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
          '/en/',
          '/en/about',
          '/en/contact',
          '/en/partners',
          '/en/privacy',
          '/en/terms',
          '/pt/',
          '/pt/about',
          '/pt/contact',
          '/pt/partners',
          '/pt/privacy',
          '/pt/terms'
        ],
        disallow: [
          '/api/',
          '/chat/',
          '/dashboard/',
          '/profile/',
          '/settings/',
          '/admin/',
          '/_next/',
          '/images/private/',
          '/temp/',
          '/*.json$',
          '/node_modules/'
        ],
      },
      // Règles spécifiques pour les crawlers de recherche majeurs
      {
        userAgent: 'Googlebot',
        allow: [
          '/',
          '/about',
          '/contact',
          '/partners',
          '/privacy',
          '/terms'
        ],
        disallow: [
          '/api/',
          '/chat/',
          '/dashboard/',
          '/profile/',
          '/settings/'
        ],
        crawlDelay: 1
      },
      {
        userAgent: 'Bingbot',
        allow: [
          '/',
          '/about',
          '/contact',
          '/partners',
          '/privacy',
          '/terms'
        ],
        disallow: [
          '/api/',
          '/chat/',
          '/dashboard/',
          '/profile/',
          '/settings/'
        ],
        crawlDelay: 2
      }
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl
  };
}
