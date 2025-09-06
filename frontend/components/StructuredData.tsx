'use client';

import { usePathname } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';
import { generateStructuredData } from '@/lib/seo-metadata';

interface StructuredDataProps {
  page?: string;
}

export default function StructuredData({ page }: StructuredDataProps) {
  const pathname = usePathname();
  const { currentInterfaceLanguage } = useLanguage();

  // Déterminer la page en fonction du pathname si pas fournie
  const currentPage = page || (() => {
    const path = pathname.replace(/^\/(?:en|pt)/, '').replace(/^\//, '') || 'home';
    return ['home', 'about', 'contact', 'partners', 'privacy', 'terms'].includes(path) ? path : 'home';
  })();

  const structuredData = generateStructuredData(
    currentPage as keyof typeof import('@/lib/seo-metadata').seoConfig.fr,
    currentInterfaceLanguage as 'fr' | 'en' | 'pt'
  );

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(structuredData, null, 2)
      }}
    />
  );
}
