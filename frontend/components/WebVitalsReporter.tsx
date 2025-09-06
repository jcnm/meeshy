'use client';

import { useEffect } from 'react';

interface WebVitalsData {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
}

// Déclaration globale pour gtag
declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    va?: (...args: any[]) => void;
  }
}

export default function WebVitalsReporter() {
  useEffect(() => {
    // Importer web-vitals dynamiquement pour éviter les erreurs SSR
    import('web-vitals').then(({ getCLS, getFID, getFCP, getLCP, getTTFB }) => {
      // Fonction pour envoyer les métriques (en production, envoyez vers votre analytics)
      const sendToAnalytics = (metric: WebVitalsData) => {
        // En développement, afficher dans la console
        if (process.env.NODE_ENV === 'development') {
          console.log('📊 Web Vitals:', {
            name: metric.name,
            value: Math.round(metric.value),
            rating: metric.rating,
            threshold: getThreshold(metric.name)
          });
        }

        // En production, envoyez vers Google Analytics, Vercel Analytics, etc.
        if (process.env.NODE_ENV === 'production') {
          // Exemple pour Google Analytics 4
          if (typeof window !== 'undefined' && window.gtag) {
            window.gtag('event', metric.name, {
              value: Math.round(metric.value),
              custom_parameter_1: metric.rating,
            });
          }

          // Exemple pour Vercel Analytics
          if (typeof window !== 'undefined' && window.va) {
            window.va('track', 'Web Vitals', {
              metric: metric.name,
              value: Math.round(metric.value),
              rating: metric.rating
            });
          }
        }
      };

      // Mesurer toutes les métriques Core Web Vitals
      getCLS(sendToAnalytics);
      getFID(sendToAnalytics);
      getFCP(sendToAnalytics);
      getLCP(sendToAnalytics);
      getTTFB(sendToAnalytics);

    }).catch(error => {
      console.warn('Web Vitals not available:', error);
    });
  }, []);

  return null; // Ce composant ne rend rien visuellement
}

  return null; // Ce composant ne rend rien visuellement
}

function getThreshold(metricName: string): string {
  const thresholds: Record<string, string> = {
    'CLS': 'Good: ≤0.1, Poor: >0.25',
    'FID': 'Good: ≤100ms, Poor: >300ms',
    'FCP': 'Good: ≤1.8s, Poor: >3s',
    'LCP': 'Good: ≤2.5s, Poor: >4s',
    'TTFB': 'Good: ≤800ms, Poor: >1.8s'
  };
  return thresholds[metricName] || 'Unknown metric';
}

// Hook pour mesurer des métriques personnalisées
export function usePerformanceMetrics() {
  useEffect(() => {
    // Mesurer le temps de chargement des polices
    const measureFontLoading = () => {
      if ('fonts' in document) {
        const startTime = performance.now();
        document.fonts.ready.then(() => {
          const duration = performance.now() - startTime;
          console.log('🔤 Font loading time:', Math.round(duration), 'ms');
        });
      }
    };

    // Mesurer le temps de première interaction
    const measureFirstInteraction = () => {
      let firstInteraction = true;
      const handleFirstInput = () => {
        if (firstInteraction) {
          const firstInputTime = performance.now();
          console.log('👆 First user interaction at:', Math.round(firstInputTime), 'ms');
          firstInteraction = false;
          
          // Nettoyer les écouteurs après la première interaction
          document.removeEventListener('click', handleFirstInput);
          document.removeEventListener('keydown', handleFirstInput);
          document.removeEventListener('touchstart', handleFirstInput);
        }
      };

      document.addEventListener('click', handleFirstInput, { once: true });
      document.addEventListener('keydown', handleFirstInput, { once: true });
      document.addEventListener('touchstart', handleFirstInput, { once: true });
    };

    // Démarrer les mesures
    measureFontLoading();
    measureFirstInteraction();

    // Mesurer le temps de rendu des composants React
    if (process.env.NODE_ENV === 'development') {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'measure' && entry.name.includes('React')) {
            console.log('⚛️ React render:', entry.name, Math.round(entry.duration), 'ms');
          }
        }
      });
      observer.observe({ entryTypes: ['measure'] });

      return () => observer.disconnect();
    }
  }, []);
}
