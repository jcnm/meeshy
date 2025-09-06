import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NODE_ENV === 'production' ? 'https://meeshy.com' : 'http://localhost:3100';
  
  // Pages principales
  const mainPages = [
    '',
    '/about',
    '/contact',
    '/partners',
    '/privacy',
    '/terms'
  ];

  // Langues supportées
  const languages = ['fr', 'en', 'pt'];

  const sitemap: MetadataRoute.Sitemap = [];

  // Générer toutes les combinaisons page/langue
  mainPages.forEach(page => {
    languages.forEach(lang => {
      const url = lang === 'fr' 
        ? `${baseUrl}${page}` // Français = langue par défaut, pas de préfixe
        : `${baseUrl}/${lang}${page}`;

      sitemap.push({
        url,
        lastModified: new Date(),
        changeFrequency: page === '' ? 'daily' : 'weekly',
        priority: getPriority(page, lang),
        alternates: {
          languages: getAlternateLanguages(page, baseUrl)
        }
      });
    });
  });

  return sitemap;
}

function getPriority(page: string, lang: string): number {
  // Page d'accueil française = priorité maximale
  if (page === '' && lang === 'fr') return 1.0;
  
  // Page d'accueil autres langues
  if (page === '') return 0.9;
  
  // Pages importantes en français
  if (lang === 'fr') {
    switch (page) {
      case '/about':
      case '/contact':
        return 0.8;
      case '/partners':
        return 0.7;
      case '/privacy':
      case '/terms':
        return 0.6;
      default:
        return 0.5;
    }
  }
  
  // Pages en autres langues
  switch (page) {
    case '/about':
    case '/contact':
      return 0.7;
    case '/partners':
      return 0.6;
    case '/privacy':
    case '/terms':
      return 0.5;
    default:
      return 0.4;
  }
}

function getAlternateLanguages(page: string, baseUrl: string): Record<string, string> {
  return {
    'fr': `${baseUrl}${page}`,
    'en': `${baseUrl}/en${page}`,
    'pt': `${baseUrl}/pt${page}`,
    'x-default': `${baseUrl}${page}` // Version française par défaut
  };
}
