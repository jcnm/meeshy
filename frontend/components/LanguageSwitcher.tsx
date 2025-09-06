/**
 * Composant de test pour le changement de langue - Phase 2
 * Simple sélecteur de langue sans localStorage
 */

'use client';

import { useLanguage } from '@/context/LanguageContext';

export function LanguageSwitcher() {
  const { currentInterfaceLanguage, setInterfaceLanguage, getSupportedLanguages } = useLanguage();
  
  const supportedLanguages = [
    { code: 'fr', name: 'Français' },
    { code: 'en', name: 'English' },
  ];

  return (
    <div className="fixed top-4 right-4 bg-white border rounded-lg p-2 shadow-lg z-50">
      <label className="block text-sm font-medium mb-1">
        Langue: {currentInterfaceLanguage}
      </label>
      <select 
        value={currentInterfaceLanguage} 
        onChange={(e) => setInterfaceLanguage(e.target.value)}
        className="border rounded px-2 py-1"
      >
        {supportedLanguages.map(lang => (
          <option key={lang.code} value={lang.code}>
            {lang.name}
          </option>
        ))}
      </select>
    </div>
  );
}
