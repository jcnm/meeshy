'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { SUPPORTED_LANGUAGES, formatLanguageName } from '@/utils/language-detection';
import { INTERFACE_LANGUAGES } from '@/types/frontend';
import { type LanguageChoice } from '@/lib/bubble-stream-modules';

interface LanguageFlagSelectorProps {
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  choices?: LanguageChoice[]; // Choix de langues spécifiques ou utilise SUPPORTED_LANGUAGES par défaut
  interfaceOnly?: boolean; // Si true, utilise seulement les langues d'interface (EN, FR, PT)
}

export function LanguageFlagSelector({
  value,
  onValueChange,
  disabled = false,
  className,
  choices,
  interfaceOnly = false,
}: LanguageFlagSelectorProps) {
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Détection mobile
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Utiliser les choix fournis, les langues d'interface limitées, ou les langues supportées par défaut
  const availableLanguages = choices 
    ? choices.map(choice => SUPPORTED_LANGUAGES.find(lang => lang.code === choice.code)).filter((lang): lang is typeof SUPPORTED_LANGUAGES[0] => lang !== undefined)
    : interfaceOnly 
      ? INTERFACE_LANGUAGES
      : SUPPORTED_LANGUAGES;

  const selectedLanguage = availableLanguages.find(
    (language) => language.code === value
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "justify-center h-6 sm:h-7 px-1 min-w-6 sm:min-w-7 w-6 sm:w-7 border-gray-200 hover:border-blue-300 rounded-md",
            className
          )}
        >
          <span className="text-base sm:text-base" style={{lineHeight: 1}}>
            {selectedLanguage?.flag || '🌐'}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className={cn(
          isMobile
            ? "p-0 bg-transparent border-0 shadow-none flex items-center justify-center z-[99999]"
            : "p-1 w-auto z-[99999]"
        )}
        style={isMobile ? { zIndex: 99999 } : { zIndex: 99999, position: 'fixed' }}
        side={isMobile ? undefined : "top"}
        align={isMobile ? undefined : "center"}
        sideOffset={isMobile ? undefined : 4}
      >
        <div
          className={cn(
            isMobile
              ? "bg-white dark:bg-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg p-1 flex flex-col gap-1 max-w-[120px] w-[120px] max-h-[30vh] mx-auto overflow-y-auto items-center justify-center"
              : "gap-1 items-center flex flex-col"
          )}
          style={isMobile ? {margin: '0 auto'} : {}}
        >
          {availableLanguages.map((language) => (
            <Button
              key={language.code}
              variant="ghost"
              size="icon"
              onClick={() => {
                onValueChange(language.code);
                setOpen(false);
              }}
              className={cn(
                isMobile
                  ? "flex flex-row items-center justify-center h-7 w-7 px-0 border border-gray-100 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900"
                  : "flex flex-row items-center justify-center h-7 w-7 px-0 hover:bg-blue-100",
                value === language.code && "bg-blue-50 dark:bg-blue-900/30"
              )}
              title={formatLanguageName(language.code)}
            >
              <span className="text-base" style={{lineHeight: 1}}>{language.flag}</span>
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
