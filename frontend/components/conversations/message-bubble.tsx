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
  Globe,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { TranslatedMessage, SUPPORTED_LANGUAGES } from '@/types';

interface MessageBubbleProps {
  message: TranslatedMessage;
  currentUserId: string;
  currentUserLanguage: string;
  onTranslate: (messageId: string, targetLanguage: string, forceRetranslate?: boolean, sourceLanguage?: string) => Promise<{detectedLanguage?: string} | void>;
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
  const [isLocalTranslating, setIsLocalTranslating] = useState(false);
  const [isTranslationPopoverOpen, setIsTranslationPopoverOpen] = useState(false);
  const [isSourceLanguagePopoverOpen, setIsSourceLanguagePopoverOpen] = useState(false);
  const [selectedSourceLanguage, setSelectedSourceLanguage] = useState<string>(message.originalLanguage || 'auto');
  const [detectedLanguage, setDetectedLanguage] = useState<string | null>(null);
  
  const isTranslating = message.isTranslating || isLocalTranslating;
  {/* Show translation status */}
  const [isGlobePopoverOpen, setIsGlobePopoverOpen] = useState(false);

  const isOwnMessage = message.senderId === currentUserId;
  const isReceivedMessage = !isOwnMessage;
  const hasTranslations = message.translations && message.translations.length > 0;
  const hasFailedTranslation = message.translationFailed;
  
  // Languages already translated
  const translatedLanguages = hasTranslations 
    ? message.translations!.map(t => t.targetLanguage) 
    : [];
  
  // Available languages for new translations (TOUTES les langues supportées)
  const availableLanguages = SUPPORTED_LANGUAGES;
  
  // Checks
  const canToggleView = hasTranslations;

  // Fonction pour nettoyer le contenu de traduction
  const cleanTranslationContent = (content: string): string => {
    if (!content) return '';
    
    return content
      .replace(/<extra_id_\d+>/g, '') // Supprimer les tokens extra_id
      .replace(/▁/g, ' ') // Remplacer les tokens de sous-mot par des espaces
      .replace(/\<pad\>/g, '') // Supprimer les tokens pad
      .replace(/\<unk\>/g, '') // Supprimer les tokens unk
      .replace(/\<\/s\>/g, '') // Supprimer les tokens de fin de séquence
      .replace(/\<s\>/g, '') // Supprimer les tokens de début de séquence
      .replace(/\s+/g, ' ') // Normaliser les espaces
      .trim();
  };

  // Get the display content
  const getDisplayContent = (): string => {
    // Déterminer quel contenu afficher (original ou traduit)
    const content = message.showingOriginal 
      ? message.content 
      : (message.translatedContent || message.content);
    
    // Toujours nettoyer le contenu pour éviter les tokens spéciaux
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
      setIsLocalTranslating(true);
      
      // Utiliser la langue source sélectionnée
      const sourceLanguage = selectedSourceLanguage;
      
      // Si la traduction s'effectue et renvoie une langue détectée (quand sourceLanguage='auto')
      // la stocker pour l'afficher à l'utilisateur
      const result = await onTranslate(message.id, targetLanguage, forceRetranslate, sourceLanguage);
      if (result && result.detectedLanguage) {
        setDetectedLanguage(result.detectedLanguage);
      }
      
      // Fermer le popover après traduction réussie
      setIsTranslationPopoverOpen(false);
    } catch (error) {
      console.error('Erreur de traduction:', error);
    } finally {
      setIsLocalTranslating(false);
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
        className={cn(
          "max-w-[70%] px-3 py-2 rounded-lg relative word-wrap break-words transition-all duration-200",
          isOwnMessage
            ? "bg-blue-500 text-white rounded-br-sm ml-auto"
            : "bg-gray-200 text-gray-900 rounded-bl-sm"
        )}
        style={{
          wordBreak: 'break-word',
          overflowWrap: 'break-word',
          hyphens: 'auto',
          whiteSpace: 'pre-wrap'
        }}
      >        {/* Sender name for received messages */}
        {isReceivedMessage && (
          <p className="text-xs font-medium mb-2 opacity-70">
            {message.sender?.displayName || 
             `${message.sender?.firstName || ''} ${message.sender?.lastName || ''}`.trim() ||
             message.sender?.username || 
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
              
              {/* Indicateur de traduction avec langue source */}
              {!message.showingOriginal && hasTranslations && (
                <div className="mt-2 text-xs flex items-center space-x-1 opacity-70">
                  {detectedLanguage ? (
                    <>
                      <span>De: {SUPPORTED_LANGUAGES.find(l => l.code === detectedLanguage)?.flag || '🔍'}</span>
                      <span>•</span>
                      <span>Vers: {SUPPORTED_LANGUAGES.find(l => l.code === message.translations![0].targetLanguage)?.flag || '?'}</span>
                    </>
                  ) : (
                    <>
                      <span>De: {SUPPORTED_LANGUAGES.find(l => l.code === message.originalLanguage)?.flag || '?'}</span>
                      <span>•</span>
                      <span>Vers: {SUPPORTED_LANGUAGES.find(l => l.code === message.translations![0].targetLanguage)?.flag || '?'}</span>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Show all available translations ONLY when viewing original */}
            {message.showingOriginal && hasTranslations && (
              <div className="space-y-2 mt-3 pt-3 border-t border-gray-200 border-opacity-30">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium opacity-70">
                    Traductions disponibles ({message.translations!.length}) :
                  </p>
                  {message.translations!.length > 3 && (
                    <span className="text-xs text-gray-400">+{message.translations!.length - 3} autres</span>
                  )}
                </div>
                <div className="space-y-1">
                  {message.translations!.map((translation, index) => {
                      const cleanedTranslation = cleanTranslationContent(translation.translatedContent);
                      const displayTranslation = cleanedTranslation || 'Traduction non disponible';
                      
                      return (
                        <div 
                          key={`${translation.targetLanguage}-${index}`}
                          className="text-sm opacity-80 flex items-start gap-2"
                        >
                          <span className="text-base">{translation.targetLanguage.toUpperCase()}:</span>
                          <span className="flex-1 leading-relaxed">
                            {displayTranslation}
                          </span>
                        </div>
                      );
                    })
                  }
                </div>
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
            {canToggleView && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-current hover:bg-black hover:bg-opacity-10 transition-all duration-200 cursor-pointer"
                onClick={() => onToggleOriginal(message.id)}
                title={message.showingOriginal ? 'Voir la traduction' : 'Voir le message original'}
              >
                <Eye className="h-4 w-4" />
              </Button>
            )}
            
            {/* Source Language Selection - Flag Icon */}
            {!isEditing && (
              <Popover 
                open={isSourceLanguagePopoverOpen} 
                onOpenChange={setIsSourceLanguagePopoverOpen}
              >
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-current hover:bg-black hover:bg-opacity-10 transition-all duration-200 cursor-pointer"
                    disabled={isTranslating}
                    title="Sélectionner la langue source"
                  >
                    {detectedLanguage ? (
                      <span className="text-sm font-medium">
                        {SUPPORTED_LANGUAGES.find(l => l.code === detectedLanguage)?.flag || '🔍'}
                      </span>
                    ) : (
                      <span className="text-sm font-medium">
                        {SUPPORTED_LANGUAGES.find(l => l.code === selectedSourceLanguage)?.flag || '🔍'}
                      </span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-3">
                  <div className="space-y-3">
                    <p className="text-sm font-medium">Sélectionner la langue source :</p>
                    <div className="grid grid-cols-1 gap-1 max-h-60 overflow-y-auto">
                      {SUPPORTED_LANGUAGES.map(lang => {
                        const isSelected = selectedSourceLanguage === lang.code;
                        return (
                          <Button
                            key={`source-${lang.code}`}
                            variant="ghost"
                            size="sm"
                            className={`justify-between h-10 px-3 ${
                              isSelected ? 'bg-blue-50 border border-blue-200' : ''
                            }`}
                            onClick={() => {
                              setSelectedSourceLanguage(lang.code);
                              setDetectedLanguage(null); // Réinitialiser la langue détectée
                              setIsSourceLanguagePopoverOpen(false);
                            }}
                            disabled={isTranslating}
                          >
                            <span className="flex items-center gap-3">
                              <span className="text-lg">{lang.flag}</span>
                              <span className="text-sm">{lang.name}</span>
                            </span>
                            {isSelected && (
                              <span className="text-xs text-blue-600 font-medium">
                                ✓ Sélectionnée
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
            
            {/* Translation icon */}
            {!isEditing && availableLanguages.length > 0 && (
              <Popover open={isTranslationPopoverOpen} onOpenChange={setIsTranslationPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-current hover:bg-black hover:bg-opacity-10 transition-all duration-200 cursor-pointer"
                    disabled={isTranslating}
                    title="Traduire vers une autre langue"
                  >
                    <Languages className={`h-4 w-4 ${isTranslating ? 'animate-spin' : ''}`} />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-3">
                  <div className="space-y-3">
                    <p className="text-sm font-medium">Traduire vers :</p>
                    
                    {/* Si langue source est 'auto', afficher un message */}
                    {selectedSourceLanguage === 'auto' && !detectedLanguage && (
                      <div className="p-2 bg-blue-50 rounded-md mb-2">
                        <p className="text-xs text-blue-800">
                          La langue source sera détectée automatiquement lors de la traduction.
                        </p>
                      </div>
                    )}
                    
                    {/* Si langue détectée, afficher l'information */}
                    {detectedLanguage && selectedSourceLanguage === 'auto' && (
                      <div className="p-2 bg-blue-50 rounded-md mb-2">
                        <p className="text-xs text-blue-800">
                          Langue détectée: {SUPPORTED_LANGUAGES.find(l => l.code === detectedLanguage)?.name || detectedLanguage}
                          {' '}{SUPPORTED_LANGUAGES.find(l => l.code === detectedLanguage)?.flag || ''}
                        </p>
                      </div>
                    )}
                    
                    <div className="grid grid-cols-1 gap-1 max-h-60 overflow-y-auto">
                      {availableLanguages
                        .filter(lang => lang.code !== 'auto') // Ne pas montrer 'auto' dans le menu de langues cibles
                        .map(lang => {
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
            
            {/* Globe icon - View all available translations */}
            {hasTranslations && (
              <Popover open={isGlobePopoverOpen} onOpenChange={setIsGlobePopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-current hover:bg-black hover:bg-opacity-10 transition-all duration-200 cursor-pointer"
                    title="Voir toutes les traductions disponibles"
                  >
                    <Globe className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0 shadow-xl border-0" side="top" align="start" sideOffset={8}>
                  <div className="p-4 bg-white rounded-lg shadow-2xl border border-gray-200">
                    <div className="flex items-center space-x-2 mb-3 pb-2 border-b border-gray-100">
                      <Globe className="h-4 w-4 text-blue-600" />
                      <span className="font-medium text-gray-900">Traductions disponibles</span>
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-medium">
                        {message.translations!.length + 1}
                      </span>
                    </div>
                    
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {/* Original message */}
                      <div className={`p-3 rounded-lg border text-left transition-all hover:shadow-sm ${
                        message.showingOriginal 
                          ? 'bg-blue-50 border-blue-200 ring-2 ring-blue-400' 
                          : 'bg-white border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                      }`}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <span className="text-lg">
                              {SUPPORTED_LANGUAGES.find(l => l.code === message.originalLanguage)?.flag || '🌍'}
                            </span>
                            <span className="font-medium text-gray-900">
                              {SUPPORTED_LANGUAGES.find(l => l.code === message.originalLanguage)?.name || message.originalLanguage}
                            </span>
                            <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded font-medium">
                              Original
                            </span>
                            {message.showingOriginal && (
                              <span className="text-blue-600 text-xs font-medium">✓ Affiché</span>
                            )}
                          </div>
                        </div>
                        <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed">
                          {message.content}
                        </p>
                        {!message.showingOriginal && (
                          <button
                            onClick={() => onToggleOriginal(message.id)}
                            className="mt-2 text-xs text-blue-600 hover:text-blue-800 font-medium"
                          >
                            Afficher cette version
                          </button>
                        )}
                      </div>
                      
                      {/* All translations */}
                      {message.translations!.map((translation, index) => {
                        const langInfo = SUPPORTED_LANGUAGES.find(l => l.code === translation.targetLanguage);
                        const cleanedTranslation = cleanTranslationContent(translation.translatedContent);
                        const isCurrentlyShown = !message.showingOriginal && message.translatedContent === translation.translatedContent;
                        
                        return (
                          <div 
                            key={`${translation.targetLanguage}-${index}`}
                            className={`p-3 rounded-lg border text-left transition-all hover:shadow-sm ${
                              isCurrentlyShown
                                ? 'bg-blue-50 border-blue-200 ring-2 ring-blue-400' 
                                : 'bg-white border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center space-x-2">
                                <span className="text-lg">{langInfo?.flag || '🌍'}</span>
                                <span className="font-medium text-gray-900">
                                  {langInfo?.name || translation.targetLanguage}
                                </span>
                                {isCurrentlyShown && (
                                  <span className="text-blue-600 text-xs font-medium">✓ Affiché</span>
                                )}
                              </div>
                            </div>
                            <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed">
                              {cleanedTranslation || 'Traduction non disponible'}
                            </p>
                            {!isCurrentlyShown && cleanedTranslation && (
                              <button
                                onClick={() => {
                                  // Switch to this translation by toggling original view if needed
                                  if (message.showingOriginal) {
                                    onToggleOriginal(message.id);
                                  }
                                  setIsGlobePopoverOpen(false);
                                }}
                                className="mt-2 text-xs text-blue-600 hover:text-blue-800 font-medium"
                              >
                                Afficher cette version
                              </button>
                            )}
                          </div>
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
                className="h-8 w-8 p-0 text-current hover:bg-black hover:bg-opacity-10 transition-all duration-200 cursor-pointer"
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
                className={`h-8 w-8 p-0 transition-all duration-200 cursor-pointer ${
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
