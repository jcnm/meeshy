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
            "justify-center h-8 sm:h-9 px-2 border-gray-200 hover:border-blue-300",
            className
          )}
        >
          <span className="text-lg sm:text-xl">
            {selectedLanguage?.flag || '🌐'}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className={cn(
          isMobile
            ? "p-0 bg-transparent border-0 shadow-none flex items-center justify-center"
            : "p-2 w-auto"
        )}
        side={isMobile ? undefined : "top"}
        align={isMobile ? undefined : "center"}
        sideOffset={isMobile ? undefined : 4}
      >
        <div
          className={cn(
            isMobile
              ? "bg-white dark:bg-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg p-2 flex flex-col gap-2 max-w-[160px] w-[160px] max-h-[40vh] mx-auto overflow-y-auto items-center justify-center"
              : "gap-2 items-center flex flex-col"
          )}
          style={isMobile ? {margin: '0 auto'} : {}}
        >
          {availableLanguages.map((language) => (
            <Button
              key={language.code}
              variant="ghost"
              size="sm"
              onClick={() => {
                onValueChange(language.code);
                setOpen(false);
              }}
              className={cn(
                isMobile
                  ? "flex flex-row items-center justify-start h-10 w-full px-2 gap-2 border border-gray-100 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900"
                  : "flex flex-row items-center justify-start h-10 w-full px-3 gap-2 hover:bg-blue-100",
                value === language.code && "bg-blue-50 dark:bg-blue-900/30"
              )}
              title={formatLanguageName(language.code)}
            >
              <span className={isMobile ? "text-xl" : "text-base"}>{language.flag}</span>
              <span className={cn(
                "font-medium",
                isMobile ? "text-sm" : "text-sm"
              )}>
                {language.name}
              </span>
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
