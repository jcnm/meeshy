/**
 * Hook pour obtenir les noms de langues traduits dans la langue de l'interface utilisateur
 */

import { useTranslations } from './useTranslations';
import { INTERFACE_LANGUAGES } from '@/types';

export interface TranslatedLanguage {
  code: string;
  name: string;        // Nom en anglais
  nativeName: string;  // Nom natif de la langue (ex: Français)
  translatedName: string; // Nom traduit dans la langue de l'interface utilisateur
}

export function useLanguageNames(): TranslatedLanguage[] {
  const t = useTranslations('languageNames');

  return INTERFACE_LANGUAGES.map(lang => ({
    code: lang.code,
    name: lang.name,
    nativeName: lang.name,
    translatedName: t(lang.code) || lang.name // Utilise la traduction ou fallback vers le nom anglais
  }));
}

/**
 * Hook pour obtenir un nom de langue spécifique traduit
 */
export function useLanguageName(languageCode: string): string {
  const t = useTranslations('languageNames');
  return t(languageCode) || languageCode.toUpperCase();
}
