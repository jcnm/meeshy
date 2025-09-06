'use client';

import { useEffect, useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';
import { seoConfig } from '@/lib/seo-metadata';

interface DynamicSEOProps {
  page?: string;
  customTitle?: string;
  customDescription?: string;
  customKeywords?: string[];
}

// Throttle function to prevent excessive updates
const throttle = (func: Function, delay: number) => {
  let timeoutId: NodeJS.Timeout | null = null;
  let lastExecTime = 0;
  
  return (...args: any[]) => {
    const currentTime = Date.now();
    
    if (currentTime - lastExecTime > delay) {
      func(...args);
      lastExecTime = currentTime;
    } else {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        func(...args);
        lastExecTime = Date.now();
        timeoutId = null;
      }, delay - (currentTime - lastExecTime));
    }
  };
};

export function useDynamicSEO({ 
  page, 
  customTitle, 
  customDescription, 
  customKeywords 
}: DynamicSEOProps = {}) {
  const pathname = usePathname();
  const { currentInterfaceLanguage } = useLanguage();
  const lastUpdateRef = useRef<string>('');
  const updateTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // Memoized SEO update function
  const updateSEO = useCallback((
    currentPage: string,
    lang: string,
    customTitle?: string,
    customDescription?: string,
    customKeywords?: string[]
  ) => {
    const updateKey = `${currentPage}-${lang}-${customTitle || ''}-${customDescription || ''}-${customKeywords?.join(',') || ''}`;
    
    // Skip if same update was just applied
    if (lastUpdateRef.current === updateKey) return;
    lastUpdateRef.current = updateKey;

    const pageData = seoConfig[lang as 'fr' | 'en' | 'pt']?.[currentPage as keyof typeof seoConfig.fr];
    if (!pageData) return;

    // Update title
    const title = customTitle || pageData.title;
    if (document.title !== title) {
      document.title = title;
    }

    // Update meta tags
    updateMetaTag('description', customDescription || pageData.description);
    updateMetaTag('keywords', (customKeywords || pageData.keywords).join(', '));

    // Update Open Graph
    if (pageData.openGraph) {
      updateMetaTag('og:title', pageData.openGraph.title, 'property');
      updateMetaTag('og:description', pageData.openGraph.description, 'property');
      updateMetaTag('og:type', pageData.openGraph.type || 'website', 'property');
      updateMetaTag('og:site_name', 'Meeshy', 'property');
      
      if (pageData.openGraph.images?.[0]) {
        const baseUrl = process.env.NODE_ENV === 'production' ? 'https://meeshy.me' : 'http://localhost:3100';
        updateMetaTag('og:image', `${baseUrl}${pageData.openGraph.images[0]}`, 'property');
      }
    }

    // Update Twitter Cards
    if (pageData.twitter) {
      updateMetaTag('twitter:card', pageData.twitter.card, 'name');
      updateMetaTag('twitter:title', pageData.twitter.title, 'name');
      updateMetaTag('twitter:description', pageData.twitter.description, 'name');
      updateMetaTag('twitter:site', '@MeeshyApp', 'name');
      
      if (pageData.twitter.images?.[0]) {
        const baseUrl = process.env.NODE_ENV === 'production' ? 'https://meeshy.me' : 'http://localhost:3100';
        updateMetaTag('twitter:image', `${baseUrl}${pageData.twitter.images[0]}`, 'name');
      }
    }

    // Update alternate links
    updateAlternateLinks(currentPage, lang);
  }, []);

  // Throttled update function
  const throttledUpdate = useCallback(
    throttle(updateSEO, 300), // Throttle updates to every 300ms
    [updateSEO]
  );

  useEffect(() => {
    // Clear any pending updates
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }

    // Determine current page
    const currentPage = page || (() => {
      const path = pathname.replace(/^\/(?:en|pt)/, '').replace(/^\//, '') || 'home';
      return ['home', 'about', 'contact', 'partners', 'privacy', 'terms'].includes(path) ? path : 'home';
    })();

    const lang = currentInterfaceLanguage || 'en';

    // Defer SEO update to prevent blocking
    updateTimeoutRef.current = setTimeout(() => {
      throttledUpdate(currentPage, lang, customTitle, customDescription, customKeywords);
    }, 50);

    // Cleanup
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, [pathname, currentInterfaceLanguage, page, throttledUpdate]); // Removed custom props from deps

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, []);
}

function updateMetaTag(property: string, content: string, attribute: 'name' | 'property' = 'name') {
  let metaTag = document.querySelector(`meta[${attribute}="${property}"]`);
  
  if (!metaTag) {
    metaTag = document.createElement('meta');
    metaTag.setAttribute(attribute, property);
    document.head.appendChild(metaTag);
  }
  
  if (metaTag.getAttribute('content') !== content) {
    metaTag.setAttribute('content', content);
  }
}

function updateAlternateLinks(currentPage: string, currentLang: string) {
  // Remove existing alternate links
  const existingLinks = document.querySelectorAll('link[rel="alternate"][hreflang]');
  existingLinks.forEach(link => link.remove());

  const baseUrl = process.env.NODE_ENV === 'production' ? 'https://meeshy.me' : 'http://localhost:3100';
  const pagePath = currentPage === 'home' ? '' : `/${currentPage}`;

  // Add new alternate links
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

  // Add x-default link
  const defaultLink = document.createElement('link');
  defaultLink.rel = 'alternate';
  defaultLink.hreflang = 'x-default';
  defaultLink.href = `${baseUrl}${pagePath}`;
  document.head.appendChild(defaultLink);

  // Update canonical link
  let canonicalLink = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
  if (!canonicalLink) {
    canonicalLink = document.createElement('link');
    canonicalLink.rel = 'canonical';
    document.head.appendChild(canonicalLink);
  }
  
  const currentPath = currentLang === 'fr' ? pagePath : `/${currentLang}${pagePath}`;
  const newHref = `${baseUrl}${currentPath}`;
  if (canonicalLink.href !== newHref) {
    canonicalLink.href = newHref;
  }
}
