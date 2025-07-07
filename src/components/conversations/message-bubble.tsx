'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Eye,
  Languages,
  Edit,
  RotateCcw,
} from 'lucide-react';
import { TranslatedMessage, SUPPORTED_LANGUAGES, TRANSLATION_MODELS } from '@/types';

interface MessageBubbleProps {
  message: TranslatedMessage;
  currentUserId: string;
  currentUserLanguage: string;
  onTranslate: (messageId: string, targetLanguage: string, forceRetranslate?: boolean) => Promise<void>;
  onEdit: (messageId: string, newContent: string) => Promise<void>;
  onToggleOriginal: (messageId: string) => void;
}

export function MessageBubble({ 
  message, 
  currentUserId, 
  currentUserLanguage,
  onTranslate, 
  onEdit,
  onToggleOriginal 
}: MessageBubbleProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isTranslationPopoverOpen, setIsTranslationPopoverOpen] = useState(false);
  
  const isOwnMessage = message.senderId === currentUserId;
  const isReceivedMessage = !isOwnMessage;
  const hasTranslations = message.translations && message.translations.length > 0;
  const hasFailedTranslation = message.translationFailed;
  
  // Languages already translated
  const translatedLanguages = hasTranslations 
    ? message.translations!.map(t => t.language) 
    : [];
  
  // Available languages for new translations
  const availableLanguages = SUPPORTED_LANGUAGES.filter(lang => 
    !translatedLanguages.includes(lang.code) || lang.code === currentUserLanguage
  );
  
  // Checks
  const canToggleView = hasTranslations || message.showingOriginal !== undefined;
  
  // Get model color for border
  const modelBorderColor = message.translations && message.translations.length > 0 && message.translations[0].modelUsed
    ? TRANSLATION_MODELS[message.translations[0].modelUsed]?.color || 'transparent'
    : 'transparent';

  // Fonction pour nettoyer le contenu de traduction
  const cleanTranslationContent = (content: string): string => {
    if (!content) return '';
    
    return content
      .replace(/<extra_id_\d+>/g, '') // Supprimer les tokens extra_id
      .replace(/▁/g, '') // Supprimer les tokens de sous-mot
      .replace(/\s+/g, ' ') // Normaliser les espaces
      .trim();
  };

  // Get the display content
  const getDisplayContent = (): string => {
    const content = message.showingOriginal 
      ? message.content 
      : (message.translatedContent || message.content);
    
    // Nettoyer le contenu
    const cleanedContent = cleanTranslationContent(content);
    
    // Si le contenu est vide après nettoyage, utiliser l'original
    if (!cleanedContent || cleanedContent.length < 3) {
      return message.content;
    }
    
    return cleanedContent;
  };

  const getLanguageStatus = (languageCode: string): 'available' | 'translated' => {
    return translatedLanguages.includes(languageCode) ? 'translated' : 'available';
  };

  const handleTranslate = async (targetLanguage: string, forceRetranslate: boolean = false) => {
    try {
      setIsTranslating(true);
      await onTranslate(message.id, targetLanguage, forceRetranslate);
      // Fermer le popover après traduction réussie
      setIsTranslationPopoverOpen(false);
    } catch (error) {
      console.error('Erreur de traduction:', error);
    } finally {
      setIsTranslating(false);
    }
  };

  const handleEdit = async () => {
    if (editContent.trim() === message.content) {
      setIsEditing(false);
      return;
    }
    
    try {
      await onEdit(message.id, editContent.trim());
      setIsEditing(false);
    } catch (error) {
      console.error('Erreur d\'édition:', error);
      setEditContent(message.content);
    }
  };

  return (
    <div 
      className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} group mb-4`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div 
        className={`relative w-full max-w-xs lg:max-w-md xl:max-w-lg min-h-[80px] ${
          isOwnMessage 
            ? 'bg-blue-600 text-white' 
            : 'bg-white text-gray-900 border border-gray-200'
        } rounded-xl px-4 py-3 shadow-sm transition-all duration-200 hover:shadow-md`}
        style={{
          borderRight: modelBorderColor !== 'transparent' 
            ? `3px solid ${modelBorderColor}` 
            : undefined
        }}
      >
        
        {/* Sender name for received messages */}
        {isReceivedMessage && (
          <p className="text-xs font-medium mb-2 opacity-70">
            {message.sender?.displayName || 
             `${message.sender?.firstName || ''} ${message.sender?.lastName || ''}`.trim() ||
             message.senderName || 
             'Utilisateur'}
          </p>
        )}
        
        {/* Message content */}
        {isEditing ? (
          <div className="space-y-3">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full p-3 border rounded-lg text-black resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              autoFocus
              placeholder="Tapez votre message..."
            />
            <div className="flex justify-end space-x-2">
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => {
                  setIsEditing(false);
                  setEditContent(message.content);
                }}
                className="h-8 px-3 text-xs"
              >
                Annuler
              </Button>
              <Button 
                size="sm" 
                onClick={handleEdit} 
                disabled={!editContent.trim()}
                className="h-8 px-3 text-xs"
              >
                Sauvegarder
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Main content */}
            <div className="mb-3">
              <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                {getDisplayContent()}
              </p>
              
              {/* Translation quality indicator */}
              {!message.showingOriginal && message.translatedContent && (
                <div className="mt-2 text-xs opacity-60">
                  {message.translatedContent !== message.content && (
                    <span className="bg-black bg-opacity-10 px-2 py-1 rounded">
                      Traduit
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Show all translations when viewing original */}
            {message.showingOriginal && hasTranslations && (
              <div className="space-y-2 mt-3 pt-3 border-t border-gray-200 border-opacity-30">
                <p className="text-xs font-medium opacity-70">Traductions disponibles :</p>
                {message.translations!.map((translation, index) => {
                  const cleanedTranslation = cleanTranslationContent(translation.content);
                  const displayTranslation = cleanedTranslation || 'Traduction non disponible';
                  
                  return (
                    <div 
                      key={index} 
                      className={`p-3 rounded-lg text-sm bg-black bg-opacity-10 border-l-4`}
                      style={{
                        borderLeftColor: translation.modelUsed && TRANSLATION_MODELS[translation.modelUsed]
                          ? TRANSLATION_MODELS[translation.modelUsed].color
                          : '#ccc'
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-lg">{translation.flag}</span>
                        <div className="flex-1">
                          <p className="text-sm leading-relaxed">
                            {displayTranslation}
                          </p>
                          {translation.modelUsed && (
                            <span className="text-xs opacity-60 mt-1 block">
                              via {TRANSLATION_MODELS[translation.modelUsed].displayName}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
        
        {/* Message metadata and actions */}
        <div className="flex items-center justify-between mt-3 pt-2">
          <div className="flex items-center space-x-2">
            <p className="text-xs opacity-70">
              {new Date(message.createdAt).toLocaleTimeString('fr-FR', {
                hour: '2-digit',
                minute: '2-digit'
              })}
            </p>
            {message.isEdited && (
              <span className="text-xs opacity-60">(modifié)</span>
            )}
          </div>
          
          {/* Action icons - toujours visibles mais avec opacité variable */}
          <div className={`flex items-center space-x-1 transition-opacity duration-200 ${
            isHovered ? 'opacity-100' : 'opacity-40'
          }`}>
            
            {/* Eye icon - toggle between showing original/translations */}
            {isReceivedMessage && canToggleView && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-current hover:bg-black hover:bg-opacity-10 transition-all duration-200"
                onClick={() => onToggleOriginal(message.id)}
                title={message.showingOriginal ? 'Voir uniquement la traduction' : 'Voir l\'original et toutes les traductions'}
              >
                <Eye className="h-4 w-4" />
              </Button>
            )}
            
            {/* Translation icon */}
            {!isEditing && availableLanguages.length > 0 && (
              <Popover open={isTranslationPopoverOpen} onOpenChange={setIsTranslationPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-current hover:bg-black hover:bg-opacity-10 transition-all duration-200"
                    disabled={isTranslating}
                    title="Traduire vers une autre langue"
                  >
                    <Languages className={`h-4 w-4 ${isTranslating ? 'animate-spin' : ''}`} />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-3">
                  <div className="space-y-3">
                    <p className="text-sm font-medium">Traduire vers :</p>
                    <div className="grid grid-cols-1 gap-1 max-h-60 overflow-y-auto">
                      {availableLanguages.map(lang => {
                        const isAlreadyTranslated = getLanguageStatus(lang.code) === 'translated';
                        return (
                          <Button
                            key={lang.code}
                            variant="ghost"
                            size="sm"
                            className={`justify-between h-10 px-3 ${
                              isAlreadyTranslated ? 'bg-green-50 border border-green-200' : ''
                            }`}
                            onClick={() => handleTranslate(lang.code, isAlreadyTranslated)}
                            disabled={isTranslating}
                          >
                            <span className="flex items-center gap-3">
                              <span className="text-lg">{lang.flag}</span>
                              <span className="text-sm">{lang.name}</span>
                            </span>
                            {isAlreadyTranslated && (
                              <span className="text-xs text-green-600 font-medium">
                                ✓ Traduit
                              </span>
                            )}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            )}
            
            {/* Edit icon - only for own messages */}
            {isOwnMessage && !isEditing && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-current hover:bg-black hover:bg-opacity-10 transition-all duration-200"
                onClick={() => setIsEditing(true)}
                title="Modifier le message"
              >
                <Edit className="h-4 w-4" />
              </Button>
            )}
            
            {/* Retry translation for failed translations */}
            {(hasFailedTranslation || translatedLanguages.includes(currentUserLanguage)) && (
              <Button
                variant="ghost"
                size="sm"
                className={`h-8 w-8 p-0 transition-all duration-200 ${
                  hasFailedTranslation 
                    ? 'text-red-500 hover:bg-red-50' 
                    : 'text-current hover:bg-black hover:bg-opacity-10'
                }`}
                onClick={() => handleTranslate(currentUserLanguage, true)}
                disabled={isTranslating}
                title="Réessayer la traduction"
              >
                <RotateCcw className={`h-4 w-4 ${isTranslating ? 'animate-spin' : ''}`} />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
