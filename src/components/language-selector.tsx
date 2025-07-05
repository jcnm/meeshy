'use client';

import { useState } from 'react';
import { Check, ChevronDown, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { SUPPORTED_LANGUAGES, formatLanguageName } from '@/utils/language-detection';

interface LanguageSelectorProps {
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export function LanguageSelector({
  value,
  onValueChange,
  disabled = false,
  placeholder = "Sélectionner une langue...",
  className,
}: LanguageSelectorProps) {
  const [open, setOpen] = useState(false);

  const selectedLanguage = SUPPORTED_LANGUAGES.find(
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
            "justify-between min-w-[200px]",
            className
          )}
        >
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-muted-foreground" />
            {selectedLanguage ? (
              <span className="flex items-center gap-1">
                {formatLanguageName(selectedLanguage.code)}
              </span>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </div>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command>
          <CommandInput 
            placeholder="Rechercher une langue..." 
            className="h-9" 
          />
          <CommandList>
            <CommandEmpty>Aucune langue trouvée.</CommandEmpty>
            <CommandGroup>
              {SUPPORTED_LANGUAGES.map((language) => (
                <CommandItem
                  key={language.code}
                  value={`${language.name} ${language.nativeName} ${language.code}`}
                  onSelect={() => {
                    onValueChange(language.code);
                    setOpen(false);
                  }}
                  className="cursor-pointer"
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="flex items-center gap-2">
                      {formatLanguageName(language.code)}
                    </span>
                    <Check
                      className={cn(
                        "h-4 w-4",
                        value === language.code ? "opacity-100" : "opacity-0"
                      )}
                    />
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
