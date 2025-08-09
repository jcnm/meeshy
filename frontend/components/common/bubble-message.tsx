'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  MessageCircle,
  Globe2,
  Star,
  Copy,
  AlertTriangle,
  MapPin,
  Timer,
  Languages,
  MoreHorizontal,
  CheckCircle2,
  Loader2,
  Eye,
  EyeOff
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import type { Message, User, BubbleTranslation } from '@/types';

interface BubbleMessageProps {
  message: Message & {
    location?: string;
    originalLanguage: string;
    translations: BubbleTranslation[];
  };
  currentUser: User;
  userLanguage: string;
  usedLanguages: string[];
}

const SUPPORTED_LANGUAGES = [
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'pt', name: 'Português', flag: '🇵🇹' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦' },
];

export function BubbleMessage({ 
  message, 
  currentUser, 
  userLanguage, 
  usedLanguages = []
}: BubbleMessageProps) {
  const [currentDisplayLanguage, setCurrentDisplayLanguage] = useState(message.originalLanguage);
  const [isHovered, setIsHovered] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);
  const [showLearningMode, setShowLearningMode] = useState(false);
  const [isTranslationPopoverOpen, setIsTranslationPopoverOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const getLanguageInfo = (langCode: string) => {
    return SUPPORTED_LANGUAGES.find(lang => lang.code === langCode) || SUPPORTED_LANGUAGES[0];
  };

  // Auto-transition vers la langue système dès qu'elle est disponible
  useEffect(() => {
    const systemLanguageTranslation = message.translations.find(t => 
      t.language === currentUser.systemLanguage && t.status === 'completed'
    );
    
    if (message.originalLanguage !== currentUser.systemLanguage && systemLanguageTranslation) {
      setCurrentDisplayLanguage(currentUser.systemLanguage);
    }
  }, [message.translations, currentUser.systemLanguage, message.originalLanguage]);

  const getCurrentContent = () => {
    // Si on affiche la langue originale, retourner TOUJOURS le contenu original
    if (currentDisplayLanguage === message.originalLanguage) {
      return message.content;
    }
    
    // Chercher la traduction pour la langue d'affichage actuelle
    const translation = message.translations.find(t => 
      t.language === currentDisplayLanguage && t.status === 'completed'
    );
    
    return translation?.content || message.content;
  };

  const formatTimeAgo = (timestamp: string | Date) => {
    const now = new Date();
    const messageTime = new Date(timestamp);
    const diffInMinutes = Math.floor((now.getTime() - messageTime.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return 'à l\'instant';
    if (diffInMinutes < 60) return `il y a ${diffInMinutes}min`;
    if (diffInMinutes < 1440) return `il y a ${Math.floor(diffInMinutes / 60)}h`;
    return `il y a ${Math.floor(diffInMinutes / 1440)}j`;
  };

  const handleLanguageSwitch = (langCode: string) => {
    setCurrentDisplayLanguage(langCode);
    setIsTranslationPopoverOpen(false);
  };

  const isOwnMessage = message.senderId === currentUser.id;
  const isUsedLanguage = usedLanguages?.includes(currentDisplayLanguage) || false;

  // Obtenir toutes les versions disponibles (original + traductions complètes)
  const availableVersions = [
    {
      language: message.originalLanguage,
      content: message.content, // TOUJOURS le contenu original, jamais une traduction
      isOriginal: true,
      status: 'completed' as const,
      confidence: 1,
      timestamp: new Date(message.createdAt)
    },
    ...message.translations.filter(t => t.status === 'completed').map(t => ({
      ...t,
      isOriginal: false
    }))
  ];

  const isTranslated = currentDisplayLanguage !== message.originalLanguage;
  
  // Permettre à l'émetteur de voir les traductions de son propre message
  const canSeeTranslations = availableVersions.length > 1;

  return (
    <TooltipProvider>
      <Card 
        className={`bubble-message relative transition-all duration-300 hover:shadow-lg ${
          isOwnMessage ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200'
        } ${isUsedLanguage ? 'ring-2 ring-green-200 ring-opacity-50' : ''}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <CardContent className="p-4">
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center space-x-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={message.sender?.avatar} alt={message.sender?.firstName} />
                <AvatarFallback className="bg-gray-100 text-gray-600 font-medium">
                  {message.sender?.firstName?.charAt(0)?.toUpperCase()}{message.sender?.lastName?.charAt(0)?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <span className="font-medium text-gray-900">
                    @{message.sender?.username}
                  </span>
                  <span className="text-gray-400">•</span>
                  <span className="text-sm text-gray-500 flex items-center">
                    <Timer className="h-3 w-3 mr-1" />
                    {formatTimeAgo(message.createdAt)}
                  </span>
                  {message.location && (
                    <>
                      <span className="text-gray-400">•</span>
                      <span className="text-sm text-gray-500 flex items-center">
                        <MapPin className="h-3 w-3 mr-1" />
                        {message.location}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Indicateur de langue originale seulement */}
            <div className="flex items-center space-x-2">
              {message.translations.some(t => t.status === 'translating') && (
                <div className="flex items-center space-x-1 px-2 py-1 bg-blue-100 rounded-full">
                  <Loader2 className="h-3 w-3 animate-spin text-blue-600" />
                  <span className="text-xs text-blue-600 font-medium">Traduction...</span>
                </div>
              )}
              
              {/* Langue originale du message uniquement */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge 
                    variant="outline" 
                    className="bg-gray-50 border-gray-300 text-gray-700 font-medium cursor-pointer hover:bg-gray-100"
                    onClick={() => handleLanguageSwitch(message.originalLanguage)}
                  >
                    <span className="mr-1">{getLanguageInfo(message.originalLanguage).flag}</span>
                    {getLanguageInfo(message.originalLanguage).code.toUpperCase()}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>Langue originale : {getLanguageInfo(message.originalLanguage).name} - Cliquer pour voir l'original</TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* Contenu principal */}
          <div className="mb-3">
            <AnimatePresence mode="wait">
              <motion.div
                key={`${currentDisplayLanguage}-${getCurrentContent()}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ 
                  duration: 0.3, 
                  ease: [0.4, 0, 0.2, 1]
                }}
                ref={contentRef}
              >
                <p className="text-gray-900 leading-relaxed whitespace-pre-wrap text-base">
                  {getCurrentContent()}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Indicateur de traduction avec icône Languages - Disponible pour tous si traductions existent */}
          {canSeeTranslations && (
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center space-x-2 text-sm text-gray-500">
                {isTranslated ? (
                  <>
                    <span>Traduit de {getLanguageInfo(message.originalLanguage).name}</span>
                    <span className="mx-2">•</span>
                    <span className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded-full">
                      {getLanguageInfo(currentDisplayLanguage).name}
                    </span>
                  </>
                ) : (
                  <>
                    <span>Traductions disponibles</span>
                  </>
                )}
                
                <Popover open={isTranslationPopoverOpen} onOpenChange={setIsTranslationPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost" 
                      size="sm"
                      className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 p-1 h-auto ml-1"
                      onMouseEnter={() => setIsTranslationPopoverOpen(true)}
                    >
                      <Languages className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent 
                    className="w-80 p-0 shadow-xl border-0" 
                    side="top" 
                    align="start"
                    sideOffset={8}
                    style={{ zIndex: 9999 }}
                  >
                    <div className="p-4 bg-white rounded-lg shadow-2xl border border-gray-200">
                      <div className="flex items-center space-x-2 mb-3 pb-2 border-b border-gray-100">
                        <Languages className="h-4 w-4 text-gray-600" />
                        <span className="font-medium text-gray-900">Versions disponibles</span>
                        <Badge variant="outline" className="text-xs">{availableVersions.length}</Badge>
                      </div>
                      
                      <div className="space-y-1 max-h-60 overflow-y-auto">
                        {availableVersions.map((version) => {
                          const langInfo = getLanguageInfo(version.language);
                          const isCurrentlyDisplayed = currentDisplayLanguage === version.language;
                          
                          return (
                            <button
                              key={version.language}
                              onClick={() => handleLanguageSwitch(version.language)}
                              className={`w-full p-3 rounded-lg border text-left transition-all hover:shadow-sm ${
                                isCurrentlyDisplayed 
                                  ? 'bg-blue-50 border-blue-200 ring-2 ring-blue-400' 
                                  : 'bg-white border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center space-x-2">
                                  <span className="text-lg">{langInfo.flag}</span>
                                  <span className="font-medium text-gray-900">{langInfo.name}</span>
                                  {version.isOriginal && (
                                    <Badge variant="outline" className="text-xs bg-gray-100">Original</Badge>
                                  )}
                                  {isCurrentlyDisplayed && (
                                    <CheckCircle2 className="h-4 w-4 text-blue-600" />
                                  )}
                                </div>
                                {!version.isOriginal && (
                                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                    {Math.round(version.confidence * 100)}%
                                  </span>
                                )}
                              </div>
                              
                              <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed">
                                {version.content}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                      
                      {message.translations.some(t => t.status === 'translating') && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <div className="flex items-center space-x-2 text-sm text-blue-700 bg-blue-50 p-2 rounded">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            <span>Traductions en cours...</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              
              {/* Bouton pour revenir à l'original ou voir une traduction */}
              {isTranslated ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleLanguageSwitch(message.originalLanguage)}
                  className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 text-sm px-2 py-1 h-auto"
                >
                  <span className="mr-1">{getLanguageInfo(message.originalLanguage).flag}</span>
                  Voir l'original
                </Button>
              ) : (
                // Si on affiche l'original et qu'il y a des traductions, proposer de voir une traduction
                availableVersions.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      // Prendre la première traduction disponible (probablement dans la langue système de l'utilisateur)
                      const firstTranslation = availableVersions.find(v => !v.isOriginal);
                      if (firstTranslation) {
                        handleLanguageSwitch(firstTranslation.language);
                      }
                    }}
                    className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 text-sm px-2 py-1 h-auto"
                  >
                    <Globe2 className="h-4 w-4 mr-1" />
                    Voir traduction
                  </Button>
                )
              )}
            </div>
          )}

          {/* Mode apprentissage */}
          {isUsedLanguage && (
            <AnimatePresence>
              {showLearningMode && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-3 p-3 bg-green-50 border border-green-200 rounded-lg"
                >
                  <div className="text-sm space-y-2">
                    <div className="flex justify-between">
                      <span className="font-medium text-green-800">Version originale :</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleLanguageSwitch(message.originalLanguage)}
                        className="text-xs p-1 text-green-700 hover:text-green-900"
                      >
                        {getLanguageInfo(message.originalLanguage).flag} Voir
                      </Button>
                    </div>
                    
                    <div className="flex items-center space-x-2 text-xs text-green-700">
                      <span>Difficulté estimée:</span>
                      <div className="flex space-x-1">
                        {[1, 2, 3].map(level => (
                          <div
                            key={level}
                            className={`w-2 h-2 rounded-full ${
                              level <= 2 ? 'bg-green-400' : 'bg-gray-300'
                            }`}
                          />
                        ))}
                      </div>
                      <span>Facile</span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          )}

          {/* Actions */}
          <div className={`flex items-center justify-between transition-all duration-200 ${
            isHovered ? 'opacity-100 transform translate-y-0' : 'opacity-40 transform translate-y-1'
          }`}>
            <div className="flex items-center space-x-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toast.info('Fonction de réponse à venir')}
                    className="text-gray-500 hover:text-blue-600 hover:bg-blue-50 p-2 rounded-full"
                  >
                    <MessageCircle className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Répondre</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsFavorited(!isFavorited)}
                    className={`p-2 rounded-full ${
                      isFavorited 
                        ? 'text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50' 
                        : 'text-gray-500 hover:text-yellow-600 hover:bg-yellow-50'
                    }`}
                  >
                    <Star className={`h-4 w-4 ${isFavorited ? 'fill-current' : ''}`} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Ajouter aux favoris</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(getCurrentContent());
                      toast.success('Texte copié');
                    }}
                    className="text-gray-500 hover:text-gray-700 hover:bg-gray-50 p-2 rounded-full"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Copier</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toast.info('Signaler le message')}
                    className="text-gray-500 hover:text-red-600 hover:bg-red-50 p-2 rounded-full"
                  >
                    <AlertTriangle className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Signaler</TooltipContent>
              </Tooltip>

              {isUsedLanguage && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowLearningMode(!showLearningMode)}
                      className="text-gray-500 hover:text-green-600 hover:bg-green-50 p-2 rounded-full"
                    >
                      {showLearningMode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {showLearningMode ? 'Masquer aide apprentissage' : 'Aide apprentissage'}
                  </TooltipContent>
                </Tooltip>
              )}
            </div>

            {/* Menu plus d'options */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-gray-500 hover:text-gray-700 hover:bg-gray-50 p-2 rounded-full"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => toast.info('Partager le message')}>
                  Partager
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => toast.info('Épingler le message')}>
                  Épingler
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => toast.info('Modifier le message')}>
                  Modifier
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}