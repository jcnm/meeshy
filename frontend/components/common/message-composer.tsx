'use client';

import { useState, useRef, KeyboardEvent, forwardRef, useImperativeHandle, useEffect } from 'react';
import { Send, MapPin, X, MessageCircle, Languages } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { LanguageFlagSelector } from '@/components/translation';
import { MAX_MESSAGE_LENGTH } from '@/lib/constants/languages';
import { type LanguageChoice } from '@/lib/bubble-stream-modules';
import { useI18n } from '@/hooks/useI18n';
import { useReplyStore, type ReplyingToMessage } from '@/stores/reply-store';

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
  const { t } = useI18n('conversations');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { replyingTo, clearReply } = useReplyStore();
  
  // Utiliser le placeholder fourni ou la traduction par défaut
  const finalPlaceholder = placeholder || t('conversationSearch.shareMessage');

  useImperativeHandle(ref, () => ({
    focus: () => textareaRef.current?.focus(),
    blur: () => textareaRef.current?.blur(),
  }));

  // Initialiser la hauteur du textarea au montage
  useEffect(() => {
    if (textareaRef.current && textareaRef.current.style) {
      try {
        textareaRef.current.style.height = '80px'; // Hauteur minimale
      } catch (error) {
        console.warn('Erreur lors de l\'initialisation du textarea:', error);
      }
    }
  }, []);

  const handleKeyPress = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (onKeyPress) {
      onKeyPress(e);
    }
  };

  // Auto-resize du textarea comme dans BubbleStreamPage
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    
    // Auto-resize textarea avec gestion améliorée des retours à la ligne
    if (textareaRef.current && textareaRef.current.style) {
      try {
        // Réinitialiser la hauteur pour obtenir la hauteur naturelle du contenu
        textareaRef.current.style.height = 'auto';
        
        // Calculer la hauteur nécessaire avec une hauteur minimale
        const minHeight = 80; // Correspond à min-h-[80px]
        const maxHeight = 160; // Correspond à max-h-40 (40 * 4px = 160px)
        const scrollHeight = textareaRef.current.scrollHeight;
        
        // Utiliser la hauteur calculée en respectant les limites
        const newHeight = Math.max(minHeight, Math.min(scrollHeight, maxHeight));
        textareaRef.current.style.height = `${newHeight}px`;
        
        // Si le contenu dépasse la hauteur maximale, permettre le scroll
        if (scrollHeight > maxHeight) {
          textareaRef.current.style.overflowY = 'auto';
        } else {
          textareaRef.current.style.overflowY = 'hidden';
        }
      } catch (error) {
        console.warn('Erreur lors du redimensionnement du textarea:', error);
      }
    }
  };

  return (
    <div className={`relative ${className}`}>
      {/* Affichage du message auquel on répond */}
      {replyingTo && (
        <div className="mb-2 p-3 bg-gradient-to-r from-blue-50/90 to-indigo-50/90 dark:from-blue-900/30 dark:to-indigo-900/30 border-l-4 border-blue-400 dark:border-blue-500 rounded-t-lg backdrop-blur-sm">
          <div className="flex items-start justify-between space-x-2">
            <div className="flex items-start space-x-2 flex-1 min-w-0">
              <MessageCircle className="h-4 w-4 text-blue-500 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2 mb-1">
                  <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
                    {t('replyingTo')} {replyingTo.sender?.displayName || replyingTo.sender?.username || t('unknownUser')}
                  </span>
                  <span className="text-xs text-blue-600/60 dark:text-blue-400/60">
                    {new Date(replyingTo.createdAt).toLocaleString('fr-FR', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2 italic">
                  {replyingTo.content}
                </p>
                {replyingTo.translations && replyingTo.translations.length > 0 && (
                  <div className="mt-1 flex items-center space-x-1">
                    <Languages className="h-3 w-3 text-blue-500/60 dark:text-blue-400/60" />
                    <span className="text-xs text-blue-600/60 dark:text-blue-400/60">
                      {replyingTo.translations.length} {t('translations')}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearReply}
              className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 p-1 h-6 w-6"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
      
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={handleTextareaChange}
        onKeyPress={handleKeyPress}
        placeholder={finalPlaceholder}
        className={`expandable-textarea min-h-[60px] sm:min-h-[80px] max-h-40 resize-none pr-20 sm:pr-28 pb-8 sm:pb-10 pt-3 pl-3 text-sm sm:text-base border-blue-200/60 bg-white/90 backdrop-blur-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-400/30 focus:bg-white/95 placeholder:text-gray-600 scroll-hidden transition-all duration-200 ${replyingTo ? 'rounded-b-2xl rounded-t-none border-t-0' : 'rounded-2xl'}`}
        maxLength={MAX_MESSAGE_LENGTH}
        disabled={!isComposingEnabled}
        style={{
          borderRadius: replyingTo ? '0 0 16px 16px' : '16px',
          boxShadow: '0 4px 20px rgba(59, 130, 246, 0.15)'
        }}
      />
      
      {/* Indicateurs dans le textarea */}
      <div className="absolute bottom-2 sm:bottom-3 left-3 flex items-center space-x-2 sm:space-x-3 text-xs sm:text-sm text-gray-600 pointer-events-auto">
        {/* Localisation */}
        {location && (
          <div className="flex items-center space-x-1">
            <MapPin className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">{location}</span>
          </div>
        )}
      </div>

      {/* Bouton d'envoi, compteur et sélecteur de langue */}
      <div className="absolute bottom-2 sm:bottom-3 right-3 sm:right-4 flex items-center space-x-1 sm:space-x-2 pointer-events-auto">
        {/* Compteur de caractères - masqué sur mobile */}
        <span className={`hidden sm:inline text-xs ${value.length > MAX_MESSAGE_LENGTH * 0.8 ? 'text-orange-500' : 'text-gray-500'}`}>
          {value.length}/{MAX_MESSAGE_LENGTH}
        </span>
        
        {/* Sélecteur de langue d'envoi - au-dessus du bouton */}
        <div className="flex flex-col items-center space-y-1">
          <LanguageFlagSelector
            value={selectedLanguage}
            onValueChange={onLanguageChange}
            choices={choices}
          />
          
          {/* Bouton d'envoi */}
          <Button
            onClick={onSend}
            disabled={!value.trim() || !isComposingEnabled}
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 text-white h-7 w-7 sm:h-8 sm:w-8 p-0 rounded-full shadow-lg hover:shadow-xl transition-all duration-200"
          >
            <Send className="h-3 w-3 sm:h-4 sm:w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
});

MessageComposer.displayName = 'MessageComposer';
