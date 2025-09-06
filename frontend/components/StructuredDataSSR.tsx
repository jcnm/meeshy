'use client';

import { generateStructuredData } from '@/lib/seo-metadata';

interface StructuredDataSSRProps {
  page?: string;
  language?: string;
}

// Version SSR-compatible qui peut être utilisée dans le <head>
export default function StructuredDataSSR({ page = 'home', language = 'fr' }: StructuredDataSSRProps) {
  const structuredData = generateStructuredData(
    page as keyof typeof import('@/lib/seo-metadata').seoConfig.fr,
    language as 'fr' | 'en' | 'pt'
  );

  return (
    <script
      type="application/ld+json"
      data-structured-data-ssr="true"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(structuredData, null, 2)
      }}
    />
  );
}
