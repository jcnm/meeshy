'use client';

import { useState, useRef, KeyboardEvent, forwardRef, useImperativeHandle } from 'react';
import { Send, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { LanguageSelector } from '@/components/translation';
import { MAX_MESSAGE_LENGTH } from '@/lib/constants/languages';
import { type LanguageChoice } from '@/lib/bubble-stream-modules';
import { useTranslations } from '@/hooks/useTranslations';

interface MessageComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  selectedLanguage: string;
  onLanguageChange: (language: string) => void;
  location?: string;
  isComposingEnabled?: boolean;
  placeholder?: string;
  onKeyPress?: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  className?: string;
  choices?: LanguageChoice[]; // Choix de langues disponibles pour l'utilisateur
}

export interface MessageComposerRef {
  focus: () => void;
  blur: () => void;
}

/**
 * Composant modulaire pour la saisie et l'envoi de messages
 * Inclut le textarea, sélecteur de langue, localisation et bouton d'envoi
 */
export const MessageComposer = forwardRef<MessageComposerRef, MessageComposerProps>(({
  value,
  onChange,
  onSend,
  selectedLanguage,
  onLanguageChange,
  location,
  isComposingEnabled = true,
  placeholder,
  onKeyPress,
  className = "",
  choices
}, ref) => {
  const { t } = useTranslations('conversationSearch');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Utiliser le placeholder fourni ou la traduction par défaut
  const finalPlaceholder = placeholder || t('shareMessage');

  useImperativeHandle(ref, () => ({
    focus: () => textareaRef.current?.focus(),
    blur: () => textareaRef.current?.blur(),
  }));

  const handleKeyPress = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (onKeyPress) {
      onKeyPress(e);
    }
  };

  return (
    <div className={`relative ${className}`}>
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyPress={handleKeyPress}
        placeholder={finalPlaceholder}
        className="expandable-textarea min-h-[80px] max-h-40 resize-none pr-28 pb-14 pt-3 pl-3 text-base border-blue-200/60 bg-white/90 backdrop-blur-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-400/30 focus:bg-white/95 placeholder:text-gray-600 scroll-hidden transition-all duration-200"
        maxLength={MAX_MESSAGE_LENGTH}
        disabled={!isComposingEnabled}
        style={{
          borderRadius: '16px',
          boxShadow: '0 4px 20px rgba(59, 130, 246, 0.15)',
          paddingBottom: '56px'
        }}
      />
      
      {/* Indicateurs dans le textarea */}
      <div className="absolute bottom-3 left-3 flex items-center space-x-3 text-sm text-gray-600 pointer-events-auto">
        {/* Sélecteur de langue d'envoi */}
        <LanguageSelector
          value={selectedLanguage}
          onValueChange={onLanguageChange}
          placeholder="Langue d'écriture"
          className="border-gray-200 hover:border-blue-300"
          choices={choices}
        />
        
        {/* Localisation */}
        {location && (
          <div className="flex items-center space-x-1">
            <MapPin className="h-4 w-4" />
            <span>{location}</span>
          </div>
        )}
      </div>

      {/* Bouton d'envoi et compteur */}
      <div className="absolute bottom-3 right-3 flex items-center space-x-2 pointer-events-auto">
        {/* Compteur de caractères */}
        <span className={`text-xs ${value.length > MAX_MESSAGE_LENGTH * 0.8 ? 'text-orange-500' : 'text-gray-500'}`}>
          {value.length}/{MAX_MESSAGE_LENGTH}
        </span>
        
        {/* Bouton d'envoi */}
        <Button
          onClick={onSend}
          disabled={!value.trim() || !isComposingEnabled}
          size="sm"
          className="bg-blue-600 hover:bg-blue-700 text-white h-8 w-8 p-0 rounded-full shadow-lg hover:shadow-xl transition-all duration-200"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
});

MessageComposer.displayName = 'MessageComposer';
