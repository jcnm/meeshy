/**
 * Hook personnalisé pour les traductions utilisant notre LanguageContext
 * Compatible SSR avec fallback français par défaut
 */

import { useLanguage } from '@/context/LanguageContext';
import { useEffect, useState } from 'react';

interface TranslationMessages {
  [key: string]: any;
}

export function useTranslations(namespace: string) {
  const { currentInterfaceLanguage } = useLanguage();
  const [messages, setMessages] = useState<TranslationMessages>({});
  const [isClient, setIsClient] = useState(false);

  // Détection côté client
  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    const loadMessages = async () => {
      try {
        // Utiliser anglais par défaut pour le SSR, puis la langue détectée côté client
        const locale = isClient ? (currentInterfaceLanguage || 'en') : 'en';
        const messagesModule = await import(`@/locales/${locale}.json`);
        const allMessages = messagesModule.default;
        
        // Extraire le namespace demandé
        const namespaceMessages = (allMessages as any)[namespace] || {};
        setMessages(namespaceMessages);
      } catch (error) {
        // Fallback vers l'anglais silencieusement
        try {
          const fallbackModule = await import(`@/locales/en.json`);
          const fallbackMessages = fallbackModule.default;
          const namespaceFallback = (fallbackMessages as any)[namespace] || {};
          setMessages(namespaceFallback);
        } catch (fallbackError) {
          setMessages({});
        }
      }
    };

    loadMessages();
  }, [currentInterfaceLanguage, namespace, isClient]);

  // Fonction pour obtenir une traduction par clé avec support pour les clés imbriquées
  const t = (key: string, params?: Record<string, string>): string => {
    const keys = key.split('.');
    let value: any = messages;
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        // Pas de warning - retourner silencieusement la clé comme fallback
        return key; // Retourner la clé si la traduction n'est pas trouvée
      }
    }
    
    if (typeof value !== 'string') {
      // Pas de warning - retourner silencieusement la clé comme fallback
      return key;
    }
    
    // Remplacer les paramètres si fournis
    if (params) {
      return Object.entries(params).reduce((text, [param, replacement]) => {
        return text.replace(new RegExp(`{${param}}`, 'g'), replacement);
      }, value);
    }
    
    return value;
  };

  return t;
}

/**
 * Hook pour obtenir toutes les traductions d'un namespace
 */
export function useTranslationsData(namespace: string) {
  const { currentInterfaceLanguage } = useLanguage();
  const [messages, setMessages] = useState<TranslationMessages>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadMessages = async () => {
      setIsLoading(true);
      try {
        const locale = currentInterfaceLanguage || 'en';
        const messagesModule = await import(`@/locales/${locale}.json`);
        const allMessages = messagesModule.default;
        
        const namespaceMessages = allMessages[namespace] || {};
        setMessages(namespaceMessages);
      } catch (error) {
        // Fallback vers l'anglais silencieusement
        try {
          const fallbackModule = await import(`@/locales/en.json`);
          const fallbackMessages = fallbackModule.default;
          const namespaceFallback = (fallbackMessages as any)[namespace] || {};
          setMessages(namespaceFallback);
        } catch (fallbackError) {
          setMessages({});
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadMessages();
  }, [currentInterfaceLanguage, namespace]);

  return { messages, isLoading };
}

/**
 * Hook pour les traductions globales (racine du fichier JSON)
 */
export function useGlobalTranslations() {
  const { currentInterfaceLanguage } = useLanguage();
  const [messages, setMessages] = useState<TranslationMessages>({});

  useEffect(() => {
    const loadMessages = async () => {
      try {
        const locale = currentInterfaceLanguage || 'en';
        const messagesModule = await import(`@/locales/${locale}.json`);
        setMessages(messagesModule.default);
      } catch (error) {
        // Fallback vers l'anglais silencieusement
        try {
          const fallbackModule = await import(`@/locales/en.json`);
          setMessages(fallbackModule.default);
        } catch (fallbackError) {
          setMessages({});
        }
      }
    };

    loadMessages();
  }, [currentInterfaceLanguage]);

  return messages;
}
