'use client';

import { usePathname } from 'next/navigation';
import { generateStructuredData } from '@/lib/seo-metadata';
import { useEffect } from 'react';

interface StructuredDataProps {
  page?: string;
  language?: string; // Langue fournie en prop pour éviter useLanguage
}

export default function StructuredData({ page, language = 'fr' }: StructuredDataProps) {
  const pathname = usePathname();

  // Déterminer la page en fonction du pathname si pas fournie
  const currentPage = page || (() => {
    const path = pathname.replace(/^\/(?:en|pt)/, '').replace(/^\//, '') || 'home';
    return ['home', 'about', 'contact', 'partners', 'privacy', 'terms'].includes(path) ? path : 'home';
  })();

  useEffect(() => {
    const structuredData = generateStructuredData(
      currentPage as keyof typeof import('@/lib/seo-metadata').seoConfig.fr,
      language as 'fr' | 'en' | 'pt'
    );

    // Supprimer l'ancien script de données structurées s'il existe
    const existingScript = document.querySelector('script[data-structured-data]');
    if (existingScript) {
      existingScript.remove();
    }

    // Ajouter le nouveau script dans le HEAD (optimal pour SEO)
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.setAttribute('data-structured-data', 'true');
    script.textContent = JSON.stringify(structuredData, null, 2);
    document.head.appendChild(script);

    return () => {
      // Nettoyer lors du démontage
      const scriptToRemove = document.querySelector('script[data-structured-data]');
      if (scriptToRemove) {
        scriptToRemove.remove();
      }
    };
  }, [currentPage, language]);

  return null; // Ce composant ne rend rien visuellement
}
