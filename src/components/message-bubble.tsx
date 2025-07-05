'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Eye,
  EyeOff,
  Languages,
  Edit,
  RotateCcw,
} from 'lucide-react';
import { TranslatedMessage, SUPPORTED_LANGUAGES, Translation, TRANSLATION_MODELS, TranslationModelType } from '@/types';

interface MessageBubbleProps {
  message: TranslatedMessage;
  currentUserId: string;
  onTranslate: (messageId: string, targetLanguage: string) => Promise<void>;
  onRetranslate: (messageId: string) => Promise<void>;
  onEdit: (messageId: string, newContent: string) => Promise<void>;
  onToggleOriginal: (messageId: string) => void;
}

export function MessageBubble({ 
  message, 
  currentUserId, 
  onTranslate, 
  onRetranslate,
  onEdit,
  onToggleOriginal 
}: MessageBubbleProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [isTranslating, setIsTranslating] = useState(false);
  
  const isOwnMessage = message.senderId === currentUserId;
  const isReceivedMessage = !isOwnMessage;
  const hasTranslations = message.translations && message.translations.length > 0;
  const hasFailedTranslation = message.translationFailed;
  const canShowHideOriginal = isReceivedMessage && (message.isTranslated || hasTranslations);

  // Determine the model border color
  const getModelBorderColor = (): string => {
    if (message.translatedContent && message.translations && message.translations.length > 0) {
      // Use the color of the most recently used model
      const lastTranslation = message.translations[message.translations.length - 1];
      if (lastTranslation.modelUsed) {
        return TRANSLATION_MODELS[lastTranslation.modelUsed].color;
      }
    }
    return 'transparent'; // No border if no translation
  };

  const modelBorderColor = getModelBorderColor();

  const handleTranslate = async (targetLanguage: string) => {
    if (isTranslating) return;
    
    setIsTranslating(true);
    try {
      await onTranslate(message.id, targetLanguage);
    } catch (error) {
      console.error('Erreur de traduction:', error);
    } finally {
      setIsTranslating(false);
    }
  };

  const handleRetranslate = async () => {
    if (isTranslating) return;
    
    setIsTranslating(true);
    try {
      await onRetranslate(message.id);
    } catch (error) {
      console.error('Erreur de retraduction:', error);
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
      setEditContent(message.content); // Reset content on error
    }
  };

  return (
    <div 
      className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} group`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div 
        className={`relative max-w-xs lg:max-w-md ${
          isOwnMessage 
            ? 'bg-blue-600 text-white' 
            : 'bg-white text-gray-900 border border-gray-200'
        } rounded-lg px-4 py-2 shadow-sm`}
        style={{
          borderRight: modelBorderColor !== 'transparent' 
            ? `3px solid ${modelBorderColor}` 
            : undefined
        }}
      >
        
        {/* Sender name for received messages */}
        {isReceivedMessage && (
          <p className="text-xs font-medium mb-1 opacity-70">
            {message.sender?.displayName || 
             `${message.sender?.firstName || ''} ${message.sender?.lastName || ''}`.trim() ||
             message.senderName || 
             'Utilisateur'}
          </p>
        )}
        
        {/* Message content */}
        {isEditing ? (
          <div className="space-y-2">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full p-2 text-sm bg-transparent border border-gray-300 rounded resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
            />
            <div className="flex justify-end space-x-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setIsEditing(false);
                  setEditContent(message.content);
                }}
                className="h-6 px-2 text-xs"
              >
                Annuler
              </Button>
              <Button
                size="sm"
                onClick={handleEdit}
                className="h-6 px-2 text-xs"
              >
                Sauvegarder
              </Button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm whitespace-pre-wrap">
              {message.showingOriginal 
                ? message.content 
                : (message.translatedContent || message.content)
              }
            </p>
            
            {/* Translations list */}
            {hasTranslations && (
              <div className="mt-2 space-y-1">
                {message.translations!.map((translation: Translation, index: number) => (
                  <div 
                    key={`${translation.language}-${index}`}
                    className={`flex items-start gap-2 p-2 rounded text-xs ${
                      isOwnMessage 
                        ? 'bg-blue-700/30' 
                        : 'bg-gray-100'
                    }`}
                    style={{
                      borderLeft: translation.modelUsed 
                        ? `2px solid ${TRANSLATION_MODELS[translation.modelUsed].color}`
                        : undefined
                    }}
                  >
                    <span className="text-sm">{translation.flag}</span>
                    <div className="flex-1">
                      <span className="block">{translation.content}</span>
                      {translation.modelUsed && (
                        <span className="text-xs opacity-60 mt-1 block">
                          via {translation.modelUsed}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
        
        {/* Message metadata */}
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center space-x-2">
            <p className="text-xs opacity-70">
              {new Date(message.createdAt).toLocaleTimeString()}
            </p>
            {message.isEdited && (
              <span className="text-xs opacity-60">(modifié)</span>
            )}
          </div>
          
          {/* Action icons */}
          <div className="flex items-center space-x-1">
            {/* Retranslate icon - always visible if translation failed, otherwise on hover */}
            {(hasFailedTranslation || isHovered) && (
              <Button
                variant="ghost"
                size="sm"
                className={`h-6 w-6 p-0 ${
                  isOwnMessage ? 'text-white hover:text-gray-200' : 'text-gray-600 hover:text-gray-800'
                } ${hasFailedTranslation ? 'text-red-500 hover:text-red-400' : ''}`}
                onClick={handleRetranslate}
                disabled={isTranslating}
                title="Retraduire avec un modèle plus puissant"
              >
                <RotateCcw className={`h-3 w-3 ${isTranslating ? 'animate-spin' : ''}`} />
              </Button>
            )}
            
            {/* Hover-only icons */}
            {isHovered && !isEditing && (
              <>
                {/* Show/hide original - only for received translated messages */}
                {canShowHideOriginal && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`h-6 w-6 p-0 ${
                      isOwnMessage ? 'text-white hover:text-gray-200' : 'text-gray-600 hover:text-gray-800'
                    }`}
                    onClick={() => onToggleOriginal(message.id)}
                    title={message.showingOriginal ? 'Voir la traduction' : 'Voir l\'original'}
                  >
                    {message.showingOriginal ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                  </Button>
                )}
                
                {/* Language selector for translation */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`h-6 w-6 p-0 ${
                        isOwnMessage ? 'text-white hover:text-gray-200' : 'text-gray-600 hover:text-gray-800'
                      }`}
                      disabled={isTranslating}
                      title="Traduire vers une langue"
                    >
                      <Languages className="h-3 w-3" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56 p-2">
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Traduire vers :</p>
                      <Select onValueChange={handleTranslate} disabled={isTranslating}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Choisir une langue" />
                        </SelectTrigger>
                        <SelectContent>
                          {SUPPORTED_LANGUAGES.map((lang) => (
                            <SelectItem key={lang.code} value={lang.code}>
                              <span className="flex items-center gap-2">
                                <span>{lang.flag}</span>
                                <span>{lang.name}</span>
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </PopoverContent>
                </Popover>
                
                {/* Edit icon - only for own messages */}
                {isOwnMessage && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-white hover:text-gray-200"
                    onClick={() => setIsEditing(true)}
                    title="Modifier le message"
                  >
                    <Edit className="h-3 w-3" />
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
