'use client';

import { NextIntlClientProvider } from 'next-intl';
import { useLanguage } from '@/context/LanguageContext';
import { useEffect, useState } from 'react';

interface TranslationProviderProps {
  children: React.ReactNode;
}

export function TranslationProvider({ children }: TranslationProviderProps) {
  const { currentInterfaceLanguage } = useLanguage();
  const [messages, setMessages] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadMessages = async () => {
      try {
        setIsLoading(true);
        const messages = await import(`../../locales/${currentInterfaceLanguage}.json`);
        setMessages(messages.default);
      } catch (error) {
        console.error(`Failed to load messages for locale: ${currentInterfaceLanguage}`, error);
        // Fallback to English
        const fallbackMessages = await import(`../../locales/en.json`);
        setMessages(fallbackMessages.default);
      } finally {
        setIsLoading(false);
      }
    };

    loadMessages();
  }, [currentInterfaceLanguage]);

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
    </div>;
  }

  return (
    <NextIntlClientProvider messages={messages} locale={currentInterfaceLanguage}>
      {children}
    </NextIntlClientProvider>
  );
}
