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
  usedLanguages: string[]; // Langues que l'utilisateur apprend
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

export function BubbleMessage({ message, currentUser, userLanguage, usedLanguages }: BubbleMessageProps) {
  const [currentDisplayLanguage, setCurrentDisplayLanguage] = useState(message.originalLanguage);
  const [showTranslationTimeline, setShowTranslationTimeline] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);
  const [showLearningMode, setShowLearningMode] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const getLanguageInfo = (langCode: string) => {
    return SUPPORTED_LANGUAGES.find(lang => lang.code === langCode) || SUPPORTED_LANGUAGES[0];
  };

  // Auto-transition vers la langue système de l'utilisateur
  useEffect(() => {
    // Vérifier si on a une traduction dans la langue système de l'utilisateur
    const systemLanguageTranslation = message.translations.find(t => 
      t.language === currentUser.systemLanguage && t.status === 'completed'
    );
    
    // Si le message original n'est pas dans la langue système et qu'on a une traduction
    if (message.originalLanguage !== currentUser.systemLanguage && 
        systemLanguageTranslation && 
        currentDisplayLanguage === message.originalLanguage) {
      
      // Délai pour permettre la lecture du message original (si différent de la langue système)
      const timer = setTimeout(() => {
        setCurrentDisplayLanguage(currentUser.systemLanguage);
      }, 1500); // Délai réduit pour une meilleure UX
      
      return () => clearTimeout(timer);
    }
  }, [message.translations, currentUser.systemLanguage, currentDisplayLanguage, message.originalLanguage]);

  // Détection des nouvelles traductions pour mise à jour en temps réel
  useEffect(() => {
    // Si on affiche la langue système et qu'une nouvelle traduction arrive
    const systemTranslation = message.translations.find(t => 
      t.language === currentUser.systemLanguage && t.status === 'completed'
    );
    
    if (systemTranslation && currentDisplayLanguage === currentUser.systemLanguage) {
      // Forcer la mise à jour du contenu (grâce à la clé dans AnimatePresence)
      console.log('🔄 Mise à jour traduction en temps réel:', {
        messageId: message.id,
        language: currentUser.systemLanguage,
        content: systemTranslation.content
      });
    }
  }, [message.translations, currentUser.systemLanguage, currentDisplayLanguage, message.id]);

  const getCurrentContent = () => {
    // Si on affiche la langue originale, retourner le contenu original
    if (currentDisplayLanguage === message.originalLanguage) {
      return message.content;
    }
    
    // Chercher la traduction pour la langue d'affichage actuelle
    const translation = message.translations.find(t => 
      t.language === currentDisplayLanguage && t.status === 'completed'
    );
    
    if (translation) {
      return translation.content;
    }
    
    // Fallback : si pas de traduction disponible, retourner le contenu original
    return message.content;
  };

  const getTranslationStatus = (langCode: string) => {
    const translation = message.translations.find(t => t.language === langCode);
    return translation?.status || 'pending';
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
  };

  const isOwnMessage = message.senderId === currentUser.id;
  const isUsedLanguage = usedLanguages.includes(currentDisplayLanguage);

  return (
    <TooltipProvider>
      <Card 
        className={`bubble-message relative transition-all duration-300 hover:shadow-md hover:-translate-y-1 ${
          isOwnMessage ? 'bg-blue-50 border-blue-200' : 'bg-white'
        } ${isUsedLanguage ? 'ring-2 ring-green-200 ring-opacity-50' : ''}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <CardContent className="p-4">
          {/* Header avec timeline des traductions */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center space-x-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={message.sender?.avatar} alt={message.sender?.firstName} />
                <AvatarFallback>
                  {message.sender?.firstName?.charAt(0)}{message.sender?.lastName?.charAt(0)}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <span className="font-medium text-gray-900">
                    @{message.sender?.username}
                  </span>
                  <span className="text-gray-500">•</span>
                  <span className="text-sm text-gray-500 flex items-center">
                    <Timer className="h-3 w-3 mr-1" />
                    {formatTimeAgo(message.createdAt)}
                  </span>
                  {message.location && (
                    <>
                      <span className="text-gray-500">•</span>
                      <span className="text-sm text-gray-500 flex items-center">
                        <MapPin className="h-3 w-3 mr-1" />
                        {message.location}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Timeline des langues avec statuts */}
            <div className="flex items-center space-x-1">
              {/* Indicateur de traduction active */}
              {message.translations.some(t => t.status === 'translating') && (
                <div className="flex items-center space-x-1 px-2 py-1 bg-blue-100 rounded-full">
                  <Loader2 className="h-3 w-3 animate-spin text-blue-600" />
                  <span className="text-xs text-blue-600 font-medium">Traduction...</span>
                </div>
              )}
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowTranslationTimeline(!showTranslationTimeline)}
                className="p-1"
                title="Voir timeline des traductions"
              >
                <Languages className="h-4 w-4" />
              </Button>
              
              <AnimatePresence>
                {showTranslationTimeline && (
                  <motion.div
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: 'auto' }}
                    exit={{ opacity: 0, width: 0 }}
                    className="flex items-center space-x-1 overflow-hidden"
                  >
                    {/* Langue originale */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant={currentDisplayLanguage === message.originalLanguage ? "default" : "outline"}
                          size="sm"
                          onClick={() => handleLanguageSwitch(message.originalLanguage)}
                          className="px-2 py-1 text-xs"
                        >
                          <span className="mr-1">{getLanguageInfo(message.originalLanguage).flag}</span>
                          <CheckCircle2 className="h-3 w-3 text-green-500" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        Version originale en {getLanguageInfo(message.originalLanguage).name}
                      </TooltipContent>
                    </Tooltip>

                    {/* Traductions */}
                    {message.translations.map((translation) => {
                      const langInfo = getLanguageInfo(translation.language);
                      return (
                        <Tooltip key={translation.language}>
                          <TooltipTrigger asChild>
                            <Button
                              variant={currentDisplayLanguage === translation.language ? "default" : "outline"}
                              size="sm"
                              onClick={() => translation.status === 'completed' && handleLanguageSwitch(translation.language)}
                              className="px-2 py-1 text-xs"
                              disabled={translation.status !== 'completed'}
                            >
                              <span className="mr-1">{langInfo.flag}</span>
                              {translation.status === 'completed' && <CheckCircle2 className="h-3 w-3 text-green-500" />}
                              {translation.status === 'translating' && <Loader2 className="h-3 w-3 animate-spin text-blue-500" />}
                              {translation.status === 'pending' && <div className="h-3 w-3 rounded-full bg-gray-300" />}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            {translation.status === 'completed' && `${langInfo.name} (${Math.round(translation.confidence * 100)}% confiance)`}
                            {translation.status === 'translating' && `Traduction vers ${langInfo.name} en cours...`}
                            {translation.status === 'pending' && `Traduction vers ${langInfo.name} en attente`}
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Contenu avec transition fluide */}
          <div className="mb-3 relative">
            <AnimatePresence mode="wait">
              <motion.div
                key={`${currentDisplayLanguage}-${getCurrentContent()}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ 
                  duration: 0.3, 
                  ease: [0.4, 0, 0.2, 1] // Courbe de Bézier pour une transition naturelle
                }}
                ref={contentRef}
              >
                <p className="text-gray-900 leading-relaxed whitespace-pre-wrap">
                  {getCurrentContent()}
                </p>
              </motion.div>
            </AnimatePresence>
            
            {/* Indicateur de langue actuelle */}
            <div className="mt-2 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Badge 
                  variant={isUsedLanguage ? "default" : "outline"} 
                  className={`text-xs ${
                    isUsedLanguage ? 'bg-green-100 text-green-800 border-green-300' : ''
                  }`}
                >
                  <span className="mr-1">{getLanguageInfo(currentDisplayLanguage).flag}</span>
                  {getLanguageInfo(currentDisplayLanguage).name}
                  {isUsedLanguage && ' 📚'}
                </Badge>
                
                {currentDisplayLanguage !== message.originalLanguage && (
                  <span className="text-xs text-gray-500 flex items-center">
                    <Globe2 className="h-3 w-3 mr-1" />
                    Traduit de {getLanguageInfo(message.originalLanguage).name}
                  </span>
                )}
              </div>

              {/* Mode apprentissage */}
              {isUsedLanguage && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowLearningMode(!showLearningMode)}
                  className="text-xs text-green-600 hover:text-green-800 p-0 h-auto"
                >
                  {showLearningMode ? <EyeOff className="h-3 w-3 mr-1" /> : <Eye className="h-3 w-3 mr-1" />}
                  {showLearningMode ? 'Masquer aide' : 'Aide apprentissage'}
                </Button>
              )}
            </div>

            {/* Panel d'aide à l'apprentissage */}
            <AnimatePresence>
              {showLearningMode && isUsedLanguage && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg"
                >
                  <div className="text-sm space-y-2">
                    <div className="flex justify-between">
                      <span className="font-medium text-green-800">Version originale :</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleLanguageSwitch(message.originalLanguage)}
                        className="text-xs p-1"
                      >
                        {getLanguageInfo(message.originalLanguage).flag} Voir
                      </Button>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="font-medium text-green-800">Votre langue :</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleLanguageSwitch(userLanguage)}
                        className="text-xs p-1"
                      >
                        {getLanguageInfo(userLanguage).flag} Voir
                      </Button>
                    </div>
                    
                    {/* Indicateur de difficulté basé sur la différence linguistique */}
                    <div className="flex items-center space-x-2 text-xs text-green-700">
                      <span>Difficulité estimée:</span>
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
          </div>

          {/* Actions (avec nouvelles fonctionnalités d'apprentissage) */}
          <div className={`flex items-center justify-between transition-all duration-200 ${
            isHovered ? 'opacity-100 transform translate-y-0' : 'opacity-0 transform translate-y-2'
          }`}>
            <div className="flex items-center space-x-1">
              {/* Actions existantes */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toast.info('Fonction de réponse à venir')}
                className="action-icon text-gray-500 hover:text-blue-600 hover:bg-blue-50 p-2"
                title="Répondre"
              >
                <MessageCircle className="h-4 w-4" />
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsFavorited(!isFavorited)}
                className={`action-icon p-2 ${
                  isFavorited 
                    ? 'text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50' 
                    : 'text-gray-500 hover:text-yellow-600 hover:bg-yellow-50'
                }`}
                title="Ajouter aux favoris"
              >
                <Star className={`h-4 w-4 ${isFavorited ? 'fill-current' : ''}`} />
              </Button>

              {/* Nouvelle action : Ajouter au vocabulaire d'apprentissage */}
              {isUsedLanguage && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toast.success('Ajouté au vocabulaire d\'apprentissage')}
                      className="action-icon text-gray-500 hover:text-green-600 hover:bg-green-50 p-2"
                    >
                      📚
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    Ajouter au vocabulaire d'apprentissage
                  </TooltipContent>
                </Tooltip>
              )}
            </div>

            {/* Timeline toggle visible au hover */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowTranslationTimeline(!showTranslationTimeline)}
              className="text-gray-500 hover:text-gray-700 p-2"
              title="Gérer les traductions"
            >
              <Languages className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}