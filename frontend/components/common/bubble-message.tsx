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
  Globe
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
    originalContent: string; // Contenu original de l'auteur
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
  const [isTranslationPopoverOpen, setIsTranslationPopoverOpen] = useState(false);
  const [isForceTranslationPopoverOpen, setIsForceTranslationPopoverOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const messageRef = useRef<HTMLDivElement>(null);

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

  // Fermer le popover quand le message quitte l'écran
  useEffect(() => {
    if (!isTranslationPopoverOpen) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) {
          setIsTranslationPopoverOpen(false);
        }
      },
      { threshold: 0.1 }
    );

    if (messageRef.current) {
      observer.observe(messageRef.current);
    }

    return () => observer.disconnect();
  }, [isTranslationPopoverOpen]);

  const getCurrentContent = () => {
    // Si on affiche la langue originale, retourner TOUJOURS le contenu original de l'auteur
    if (currentDisplayLanguage === message.originalLanguage) {
      return message.originalContent;
    }
    
    // Chercher la traduction pour la langue d'affichage actuelle
    const translation = message.translations.find(t => 
      t.language === currentDisplayLanguage && t.status === 'completed'
    );
    
    return translation?.content || message.originalContent;
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

  // Obtenir les langues manquantes (supportées mais pas traduites)
  const getMissingLanguages = () => {
    const translatedLanguages = new Set([
      message.originalLanguage,
      ...message.translations.map(t => t.language)
    ]);
    
    return SUPPORTED_LANGUAGES.filter(lang => !translatedLanguages.has(lang.code));
  };

  const handleForceTranslation = (targetLanguage: string) => {
    setIsForceTranslationPopoverOpen(false);
    toast.info(`Traduction forcée vers ${getLanguageInfo(targetLanguage).name}`);
    // Ici on déclencherait la traduction vers la langue cible
  };

  const isOwnMessage = message.senderId === currentUser.id;
  const isUsedLanguage = usedLanguages?.includes(currentDisplayLanguage) || false;

  // Obtenir toutes les versions disponibles (original + traductions complètes)
  const availableVersions = [
    {
      language: message.originalLanguage,
      content: message.originalContent, // TOUJOURS le contenu original de l'auteur
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
  
  // Améliorer la visibilité de l'icône globe avec un badge
  const translationCount = availableVersions.length - 1; // Exclure l'original
  
  // Debug: afficher les informations de traduction
  console.log('🔍 BubbleMessage Debug:', {
    messageId: message.id,
    originalLanguage: message.originalLanguage,
    translationsCount: message.translations.length,
    completedTranslations: message.translations.filter(t => t.status === 'completed').length,
    availableVersions: availableVersions.length,
    canSeeTranslations,
    translationCount,
    messageTranslations: message.translations,
    hasOriginalContent: !!message.originalContent,
    messageKeys: Object.keys(message)
  });

  // Debug: afficher quand le popover s'ouvre
  console.log('🎯 Popover state:', {
    isTranslationPopoverOpen,
    translationCount,
    availableVersions: availableVersions.length
  });

  return (
    <TooltipProvider>
      <Card 
        ref={messageRef}
        className={`bubble-message relative transition-all duration-300 hover:shadow-lg ${
          isOwnMessage ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200'
        } ${isUsedLanguage ? 'ring-2 ring-green-200 ring-opacity-50' : ''}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => {
          setIsHovered(false);
          // Fermer le popover quand on quitte la zone du message
          setTimeout(() => setIsTranslationPopoverOpen(false), 300);
        }}
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

              {/* Icône de traduction - Force une nouvelle traduction */}
              <Popover open={isForceTranslationPopoverOpen} onOpenChange={setIsForceTranslationPopoverOpen}>
                <PopoverTrigger asChild>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-gray-500 hover:text-green-600 hover:bg-green-50 p-2 rounded-full"
                      >
                        <Languages className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Forcer traduction vers une nouvelle langue</TooltipContent>
                  </Tooltip>
                </PopoverTrigger>
                <PopoverContent 
                  className="w-72 p-0 shadow-xl border-0" 
                  side="top" 
                  align="start"
                  sideOffset={8}
                  style={{ zIndex: 9999 }}
                >
                  <div className="p-4 bg-white rounded-lg shadow-2xl border border-gray-200">
                    <div className="flex items-center space-x-2 mb-3 pb-2 border-b border-gray-100">
                      <Languages className="h-4 w-4 text-green-600" />
                      <span className="font-medium text-gray-900">Traduire vers</span>
                      <Badge variant="outline" className="text-xs bg-green-50 text-green-700">{getMissingLanguages().length}</Badge>
                    </div>
                    
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {getMissingLanguages().length > 0 ? (
                        getMissingLanguages().map((lang) => (
                          <button
                            key={lang.code}
                            onClick={() => handleForceTranslation(lang.code)}
                            className="w-full p-3 rounded-lg border border-gray-100 text-left transition-all hover:shadow-sm hover:border-green-200 hover:bg-green-50"
                          >
                            <div className="flex items-center space-x-3">
                              <span className="text-lg">{lang.flag}</span>
                              <div className="flex-1">
                                <span className="font-medium text-gray-900">{lang.name}</span>
                                <p className="text-xs text-gray-500 mt-1">Créer une traduction</p>
                              </div>
                            </div>
                          </button>
                        ))
                      ) : (
                        <div className="text-center p-4 text-gray-500">
                          <Languages className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                          <p className="text-sm">Toutes les langues sont déjà traduites</p>
                        </div>
                      )}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

{/* Icône globe - Voir les traductions disponibles */}
<Popover 
  open={isTranslationPopoverOpen} 
  onOpenChange={setIsTranslationPopoverOpen}
>
  <PopoverTrigger asChild>
    <Button
      variant="ghost"
      size="sm"
      onClick={(e) => {
        e.stopPropagation(); // Empêcher la propagation
        console.log('🌐 Click sur globe, état actuel:', isTranslationPopoverOpen);
        setIsTranslationPopoverOpen(!isTranslationPopoverOpen);
      }}
      className={`relative p-2 rounded-full transition-all duration-200 ${
        translationCount > 0 
          ? 'text-blue-600 hover:text-blue-700 hover:bg-blue-100' 
          : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
      }`}
    >
      <Globe className={`h-4 w-4 transition-transform duration-200 ${
        translationCount > 0 ? 'animate-pulse' : ''
      }`} />
      {/* Badge pour indiquer le nombre de traductions */}
      {translationCount > 0 && (
        <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-medium animate-bounce">
          {translationCount}
        </span>
      )}
             {/* Indicateur de debug temporaire */}
       {/* <span className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 text-xs text-red-600 bg-red-100 px-1 rounded whitespace-nowrap">
         {isTranslationPopoverOpen ? 'OUVERT' : 'FERMÉ'}
       </span> */}
    </Button>
  </PopoverTrigger>
     <PopoverContent 
     className="w-72 p-0 shadow-2xl border border-gray-200 bg-white/95 backdrop-blur-sm" 
     side="top" 
     align="start"
     sideOffset={8}
     alignOffset={0}
     avoidCollisions={true}
     style={{ 
       zIndex: 99999,
       backgroundColor: 'rgba(255, 255, 255, 0.95)',
       backdropFilter: 'blur(8px)'
     }}
     onOpenAutoFocus={(e) => e.preventDefault()}
     onInteractOutside={(e) => {
       console.log('🌐 Click outside popover');
       setIsTranslationPopoverOpen(false);
     }}
   >
     <div className="p-3 bg-transparent relative">
      
             <div className="space-y-1 max-h-64 overflow-y-auto scrollbar-thin">
         {availableVersions.length > 0 ? (
           availableVersions.map((version) => {
             const langInfo = getLanguageInfo(version.language);
             const isCurrentlyDisplayed = currentDisplayLanguage === version.language;
             
             return (
               <button
                 key={version.language}
                 onClick={(e) => {
                   e.stopPropagation();
                   console.log('🌐 Switch vers langue:', version.language);
                   handleLanguageSwitch(version.language);
                   setIsTranslationPopoverOpen(false);
                 }}
                 className={`w-full p-2.5 rounded-lg text-left transition-all duration-200 group ${
                   isCurrentlyDisplayed 
                     ? 'bg-blue-50/80 border border-blue-200/60' 
                     : 'bg-white/60 border border-transparent hover:bg-white/80 hover:border-gray-200/60'
                 }`}
               >
                 <div className="flex items-center justify-between mb-1.5">
                   <div className="flex items-center space-x-2">
                     <span className="text-base">{langInfo.flag}</span>
                     <span className={`font-medium text-sm ${
                       isCurrentlyDisplayed ? 'text-blue-700' : 'text-gray-700'
                     }`}>
                       {langInfo.name}
                     </span>
                     {version.isOriginal && (
                       <span className="text-xs text-gray-500 bg-gray-100/60 px-1.5 py-0.5 rounded">
                         Original
                       </span>
                     )}
                     {isCurrentlyDisplayed && (
                       <CheckCircle2 className="h-3.5 w-3.5 text-blue-600" />
                     )}
                   </div>
                   {!version.isOriginal && (
                     <span className="text-xs text-gray-500 bg-gray-100/60 px-1.5 py-0.5 rounded">
                       {Math.round(version.confidence * 100)}%
                     </span>
                   )}
                 </div>
                 
                 <p className="text-sm text-gray-600 leading-relaxed line-clamp-2 group-hover:text-gray-800">
                   {version.content}
                 </p>
                 
                 {/* Indicateur de qualité discret */}
                 {!version.isOriginal && (
                   <div className="mt-1.5 flex items-center space-x-1">
                     <div className="flex-1 bg-gray-200/40 rounded-full h-0.5">
                       <div 
                         className="bg-green-400 h-0.5 rounded-full transition-all duration-300"
                         style={{ width: `${Math.round(version.confidence * 100)}%` }}
                       />
                     </div>
                   </div>
                 )}
               </button>
             );
           })
         ) : (
           <div className="text-center p-4 text-gray-400">
             <Globe className="h-6 w-6 mx-auto mb-2 opacity-60" />
             <p className="text-xs">Aucune traduction disponible</p>
           </div>
         )}
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