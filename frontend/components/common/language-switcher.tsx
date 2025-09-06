'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Languages, Check } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { useTranslations } from '@/hooks/useTranslations';
import { useLanguageNames } from '@/hooks/useLanguageNames';

export function LanguageSwitcher() {
  const { currentInterfaceLanguage, setInterfaceLanguage } = useLanguage();
  const { t } = useTranslations('language');
  const translatedLanguages = useLanguageNames();
  const [isOpen, setIsOpen] = useState(false);

  const handleLanguageChange = (languageCode: string) => {
    setInterfaceLanguage(languageCode);
    setIsOpen(false);
  };

  const currentLanguage = translatedLanguages.find(lang => lang.code === currentInterfaceLanguage);

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="flex items-center space-x-2">
          <Languages className="h-4 w-4" />
          <span className="hidden sm:inline">
            {currentLanguage?.nativeName || currentInterfaceLanguage.toUpperCase()}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <div className="px-2 py-1.5 text-sm font-medium text-gray-500">
          {t('selectLanguage')}
        </div>
        {translatedLanguages.map((language) => (
          <DropdownMenuItem
            key={language.code}
            onClick={() => handleLanguageChange(language.code)}
            className="flex items-center justify-between cursor-pointer"
          >
            <div className="flex items-center space-x-2">
              <span className="text-sm">{language.nativeName}</span>
              <span className="text-xs text-gray-400">({language.translatedName})</span>
            </div>
            {currentInterfaceLanguage === language.code && (
              <Check className="h-4 w-4 text-blue-600" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
