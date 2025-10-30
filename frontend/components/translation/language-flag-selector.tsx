"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { SUPPORTED_LANGUAGES, formatLanguageName } from "@/utils/language-detection";
import { INTERFACE_LANGUAGES } from "@/types/frontend";
import { type LanguageChoice } from "@/lib/bubble-stream-modules";

interface LanguageFlagSelectorProps {
	value: string;
	onValueChange: (value: string) => void;
	disabled?: boolean;
	className?: string;
	choices?: LanguageChoice[];
	interfaceOnly?: boolean;
	showLanguageName?: boolean;
}

export function LanguageFlagSelector({
	value,
	onValueChange,
	disabled = false,
	className,
	choices,
	interfaceOnly = false,
	showLanguageName = true,
}: LanguageFlagSelectorProps) {
	const [open, setOpen] = useState(false);
	const [isMobile, setIsMobile] = useState(false);

	useEffect(() => {
		const checkMobile = () => setIsMobile(window.innerWidth < 768);
		checkMobile();
		window.addEventListener("resize", checkMobile);
		return () => window.removeEventListener("resize", checkMobile);
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
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "justify-center h-7 w-7 sm:h-8 sm:w-8 px-0 border-gray-200 hover:border-blue-300",
            className
          )}
        >
          <span className="text-lg sm:text-xl">
            {selectedLanguage?.flag || '🌐'}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" side="top" sideOffset={8} className="p-2 w-[180px] max-w-[96vw] sm:max-w-[320px] min-w-[140px]">
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
