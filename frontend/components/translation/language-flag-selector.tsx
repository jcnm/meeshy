'use client';

import { useState } from 'react';
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

  // Utiliser les choix fournis, les langues d'interface limitées, ou les langues supportées par défaut
  const availableLanguages = choices 
    ? choices.map(choice => SUPPORTED_LANGUAGES.find(lang => lang.code === choice.code)).filter(Boolean)
    : interfaceOnly 
      ? INTERFACE_LANGUAGES
      : SUPPORTED_LANGUAGES;

  const selectedLanguage = availableLanguages.find(
    (language) => language?.code === value
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
            "justify-center w-6 h-6 sm:w-7 sm:h-7 p-0 border-gray-200 hover:border-blue-300",
            className
          )}
        >
          <span className="text-xs sm:text-sm">
            {selectedLanguage?.flag || '🌐'}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-10 p-2" 
        side="top" 
        align="center"
        sideOffset={4}
      >
        <div className="flex flex-col gap-1 items-center">
          {availableLanguages.map((language) => (
            <Button
              key={language?.code}
              variant="ghost"
              size="sm"
              onClick={() => {
                if (language?.code) {
                  onValueChange(language.code);
                  setOpen(false);
                }
              }}
              className="h-8 w-8 p-0 flex items-center justify-center hover:bg-blue-100"
              title={language?.code && formatLanguageName(language.code)}
            >
              <span className="text-sm">{language?.flag}</span>
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
