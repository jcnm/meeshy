'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';
import { seoConfig } from '@/lib/seo-metadata';

interface DynamicSEOProps {
  page?: string;
  customTitle?: string;
  customDescription?: string;
  customKeywords?: string[];
}

export function useDynamicSEO({ 
  page, 
  customTitle, 
  customDescription, 
  customKeywords 
}: DynamicSEOProps = {}) {
  const pathname = usePathname();
  const { currentInterfaceLanguage } = useLanguage();

  useEffect(() => {
    // Déterminer la page actuelle
    const currentPage = page || (() => {
      const path = pathname.replace(/^\/(?:en|pt)/, '').replace(/^\//, '') || 'home';
      return ['home', 'about', 'contact', 'partners', 'privacy', 'terms'].includes(path) ? path : 'home';
    })();

    const lang = currentInterfaceLanguage as 'fr' | 'en' | 'pt';
    const pageData = seoConfig[lang]?.[currentPage as keyof typeof seoConfig.fr];

    if (!pageData) return;

    // Mettre à jour le titre
    const title = customTitle || pageData.title;
    document.title = title;

    // Mettre à jour la description
    const description = customDescription || pageData.description;
    updateMetaTag('description', description);

    // Mettre à jour les mots-clés
    const keywords = customKeywords || pageData.keywords;
    updateMetaTag('keywords', keywords.join(', '));

    // Mettre à jour Open Graph
    if (pageData.openGraph) {
      updateMetaTag('og:title', pageData.openGraph.title, 'property');
      updateMetaTag('og:description', pageData.openGraph.description, 'property');
      updateMetaTag('og:type', pageData.openGraph.type || 'website', 'property');
      updateMetaTag('og:site_name', 'Meeshy', 'property');
      
      if (pageData.openGraph.images?.[0]) {
        const baseUrl = process.env.NODE_ENV === 'production' ? 'https://meeshy.com' : 'http://localhost:3100';
        updateMetaTag('og:image', `${baseUrl}${pageData.openGraph.images[0]}`, 'property');
      }
    }

    // Mettre à jour Twitter Cards
    if (pageData.twitter) {
      updateMetaTag('twitter:card', pageData.twitter.card, 'name');
      updateMetaTag('twitter:title', pageData.twitter.title, 'name');
      updateMetaTag('twitter:description', pageData.twitter.description, 'name');
      updateMetaTag('twitter:site', '@MeeshyApp', 'name');
      
      if (pageData.twitter.images?.[0]) {
        const baseUrl = process.env.NODE_ENV === 'production' ? 'https://meeshy.com' : 'http://localhost:3100';
        updateMetaTag('twitter:image', `${baseUrl}${pageData.twitter.images[0]}`, 'name');
      }
    }

    // Mettre à jour les liens alternatifs
    updateAlternateLinks(currentPage, lang);

  }, [pathname, currentInterfaceLanguage, page, customTitle, customDescription, customKeywords]);
}

function updateMetaTag(property: string, content: string, attribute: 'name' | 'property' = 'name') {
  let metaTag = document.querySelector(`meta[${attribute}="${property}"]`);
  
  if (!metaTag) {
    metaTag = document.createElement('meta');
    metaTag.setAttribute(attribute, property);
    document.head.appendChild(metaTag);
  }
  
  metaTag.setAttribute('content', content);
}

function updateAlternateLinks(currentPage: string, currentLang: string) {
  // Supprimer les liens alternatifs existants
  const existingLinks = document.querySelectorAll('link[rel="alternate"][hreflang]');
  existingLinks.forEach(link => link.remove());

  const baseUrl = process.env.NODE_ENV === 'production' ? 'https://meeshy.com' : 'http://localhost:3100';
  const pagePath = currentPage === 'home' ? '' : `/${currentPage}`;

  // Ajouter les nouveaux liens alternatifs
  const languages = [
    { code: 'fr', path: pagePath },
    { code: 'en', path: `/en${pagePath}` },
    { code: 'pt', path: `/pt${pagePath}` }
  ];

  languages.forEach(({ code, path }) => {
    const link = document.createElement('link');
    link.rel = 'alternate';
    link.hreflang = code;
    link.href = `${baseUrl}${path}`;
    document.head.appendChild(link);
  });

  // Ajouter le lien x-default (version française par défaut)
  const defaultLink = document.createElement('link');
  defaultLink.rel = 'alternate';
  defaultLink.hreflang = 'x-default';
  defaultLink.href = `${baseUrl}${pagePath}`;
  document.head.appendChild(defaultLink);

  // Mettre à jour le lien canonique
  let canonicalLink = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
  if (!canonicalLink) {
    canonicalLink = document.createElement('link');
    canonicalLink.rel = 'canonical';
    document.head.appendChild(canonicalLink);
  }
  
  const currentPath = currentLang === 'fr' ? pagePath : `/${currentLang}${pagePath}`;
  canonicalLink.href = `${baseUrl}${currentPath}`;
}
