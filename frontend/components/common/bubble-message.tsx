'use client';

import { useState, useEffect, useRef, memo, useMemo, useCallback } from 'react';
import { 
  MessageCircle,
  Star,
  Copy,
  AlertTriangle,
  Timer,
  Languages,
  MoreHorizontal,
  CheckCircle2,
  Loader2,
  ArrowUp,
  Search,
  X,
  Ghost,
  Edit,
  Trash2,
  Check,
  CheckCheck,
  Globe,
  Plus,
  Shield,
  ShieldCheck,
  Zap,
  RefreshCw,
  TrendingUp,
  Lock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
import type { User, BubbleTranslation } from '@shared/types';
import { SUPPORTED_LANGUAGES, getLanguageInfo } from '@shared/types';
import type { Message } from '@shared/types/conversation';
import type { BubbleStreamMessage } from '@/types/bubble-stream';
import { Z_CLASSES } from '@/lib/z-index';
import { useTranslations } from '@/hooks/useTranslations';
import { getMessageInitials } from '@/lib/avatar-utils';
import { cn } from '@/lib/utils';
import { useFixTranslationPopoverZIndex } from '@/hooks/use-fix-z-index'; 


interface BubbleMessageProps {
  message: Message & {
    location?: string;
    originalLanguage: string;
    translations: BubbleTranslation[];
    originalContent: string;
    readStatus?: Array<{ userId: string; readAt: Date }>;
  };
  currentUser: User;
  userLanguage: string;
  usedLanguages: string[];
  // Props pour les actions (remontées au parent)
  onForceTranslation?: (messageId: string, targetLanguage: string) => void;
  onEditMessage?: (messageId: string, newContent: string) => void;
  onDeleteMessage?: (messageId: string) => void;
  onLanguageSwitch?: (messageId: string, language: string) => void;
  // États contrôlés depuis le parent
  currentDisplayLanguage: string;
  isTranslating?: boolean;
  translationError?: string;
  conversationType?: 'direct' | 'group' | 'public' | 'global';
  userRole?: 'USER' | 'MEMBER' | 'MODERATOR' | 'ADMIN' | 'CREATOR' | 'AUDIT' | 'ANALYST' | 'BIGBOSS';
}

function BubbleMessageInner({ 
  message, 
  currentUser, 
  userLanguage, 
  usedLanguages = [],
  onForceTranslation,
  onEditMessage,
  onDeleteMessage,
  onLanguageSwitch,
  currentDisplayLanguage,
  isTranslating = false,
  translationError,
  conversationType = 'direct',
  userRole = 'USER'
}: BubbleMessageProps) {
  const { t } = useTranslations('bubbleStream');
  
  // Hook pour fixer les z-index des popovers de traduction
  useFixTranslationPopoverZIndex();
  
  // États UI locaux uniquement (pas de logique métier)
  const [isHovered, setIsHovered] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);
  const [isTranslationPopoverOpen, setIsTranslationPopoverOpen] = useState(false);
  const [previousTranslationCount, setPreviousTranslationCount] = useState(0);
  const [isNewTranslation, setIsNewTranslation] = useState(false);
  
  // Fonction pour gérer l'ouverture/fermeture de la popover de manière contrôlée
  const handlePopoverOpenChange = useCallback((open: boolean) => {
    console.log(`🔧 Popover ${open ? 'OUVERTURE' : 'FERMETURE'}:`, { messageId: message.id, open });
    setIsTranslationPopoverOpen(open);
    if (!open) {
      setTranslationFilter(''); // Réinitialiser le filtre quand on ferme
    }
    
    // Debug z-index quand on ouvre
    if (open) {
      setTimeout(() => {
        const popover = document.querySelector(`[data-radix-popover-content]`);
        if (popover) {
          const style = window.getComputedStyle(popover);
          console.log(`🎯 Popover style:`, {
            zIndex: style.zIndex,
            position: style.position,
            display: style.display,
            visibility: style.visibility,
            opacity: style.opacity
          });
        }
      }, 100);
    }
  }, [message.id]);
  const [translationFilter, setTranslationFilter] = useState('');
  
  const contentRef = useRef<HTMLDivElement>(null);
  const messageRef = useRef<HTMLDivElement>(null);
  const filterInputRef = useRef<HTMLInputElement>(null);

  // Effet pour détecter les nouvelles traductions et déclencher l'animation
  useEffect(() => {
    const currentCount = message.translations?.length || 0;
    
    if (currentCount > previousTranslationCount && previousTranslationCount > 0) {
      // Une nouvelle traduction a été ajoutée
      setIsNewTranslation(true);
      
      // Si la nouvelle traduction est dans la langue de l'utilisateur, afficher une notification
      const newTranslation = message.translations?.find((t: any) => 
        (t.language || t.targetLanguage) === userLanguage
      );
      
      if (newTranslation && currentDisplayLanguage === userLanguage) {
        console.log(`🎉 [AUTO-TRANSLATION] Affichage automatique de la traduction en ${userLanguage} pour le message ${message.id}`);
        toast.success(`Message traduit en ${userLanguage}`, {
          duration: 2000,
          position: 'bottom-right'
        });
      }
      
      // Arrêter l'animation après 2 secondes
      const timer = setTimeout(() => {
        setIsNewTranslation(false);
      }, 2000);
      
      return () => clearTimeout(timer);
    }
    
    setPreviousTranslationCount(currentCount);
  }, [message.translations?.length, previousTranslationCount, userLanguage, currentDisplayLanguage, message.id]);

  // Les traductions sont déjà normalisées
  const normalizedTranslations = message.translations || [];

  // Calculer si une traduction est réellement en cours
  const isActuallyTranslating = useMemo(() => {
    // Si aucune traduction, on se base sur la prop
    if (!message.translations || message.translations.length === 0) {
      console.log(`🔍 [BUBBLE] Message ${message.id}: Aucune traduction, isTranslating=${isTranslating}`);
      return isTranslating;
    }

    // Les traductions venant du backend sont déjà complétées
    // Seules les traductions en cours côté frontend ont un statut 'pending'
    const hasOngoingTranslations = message.translations.some((t: any) => {
      const status = t.status;
      return status === 'pending' || status === 'processing';
    });

    // Si une traduction a un translatedContent et pas de statut, elle est complétée
    const allCompleted = message.translations.every((t: any) => {
      const status = t.status;
      return !status || status === 'completed' || !!t.translatedContent;
    });

    // Debug uniquement en mode développement et pour les cas problématiques
    const shouldDebug = process.env.NODE_ENV === 'development' && (hasOngoingTranslations || isTranslating);
    
    if (shouldDebug) {
      console.log(`🔍 [BUBBLE] Message ${message.id}:`, {
        translationsCount: message.translations.length,
        hasOngoingTranslations,
        allCompleted,
        isTranslatingProp: isTranslating,
        translationStatuses: message.translations.map((t: any) => ({ lang: t.language || t.targetLanguage, status: t.status || 'completed' }))
      });
    }

    // Si toutes les traductions sont complétées, on n'est plus en cours de traduction
    if (allCompleted) {
      return false;
    }

    // Si on a des traductions en cours OU si le parent dit qu'on traduit ET qu'on n'a pas toutes les traductions complétées
    const result = hasOngoingTranslations || (isTranslating && !allCompleted);
    return result;
  }, [message.translations, isTranslating]);

  // Fonctions utilitaires (pas d'effets de bord)
  const getCurrentContent = () => {
    const originalLang = message.originalLanguage || 'fr';
    
    if (currentDisplayLanguage === originalLang) {
      return message.originalContent || message.content;
    }
    
    const translation = message.translations?.find((t: any) => 
      (t?.language || t?.targetLanguage) === currentDisplayLanguage
    );
    
    return ((translation as any)?.content || (translation as any)?.translatedContent) || message.originalContent || message.content;
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

  // Handlers qui remontent les actions au parent
  const handleLanguageSwitch = (langCode: string) => {
    handlePopoverOpenChange(false);
    onLanguageSwitch?.(message.id, langCode);
  };

  const handleForceTranslation = (targetLanguage: string) => {
    handlePopoverOpenChange(false);
    onForceTranslation?.(message.id, targetLanguage);
  };

  // Fonction pour obtenir le tier supérieur
  const getNextTier = (currentTier: string) => {
    const tiers = ['basic', 'medium', 'premium'];
    const currentIndex = tiers.indexOf(currentTier);
    return currentIndex < tiers.length - 1 ? tiers[currentIndex + 1] : null;
  };

  // Fonction pour forcer une re-traduction avec tier supérieur
  const handleUpgradeTier = async (targetLanguage: string, currentTier: string) => {
    const nextTier = getNextTier(currentTier);
    if (!nextTier) {
      toast.info('Modèle de traduction maximum déjà atteint');
      return;
    }

    handlePopoverOpenChange(false);
    
    if (onForceTranslation) {
      try {
        // Pour l'instant, utiliser la fonction de traduction normale
        // TODO: Ajouter support pour spécifier le modèle
        await onForceTranslation(message.id, targetLanguage);
        toast.success(`Retraduction en cours vers ${getLanguageInfo(targetLanguage).name} (modèle ${nextTier})`);
      } catch (error) {
        toast.error('Erreur lors de la demande d\'upgrade');
      }
    }
  };

  const handleEditMessage = () => {
    const newContent = prompt('Modifier le message:', message.content);
    if (newContent && newContent.trim() !== message.content) {
      onEditMessage?.(message.id, newContent.trim());
    }
  };

  const handleDeleteMessage = () => {
    const confirmed = confirm('Êtes-vous sûr de vouloir supprimer ce message ?');
    if (confirmed) {
      onDeleteMessage?.(message.id);
    }
  };

  // Logique de permissions (pure, pas d'effets de bord)
  const isOwnMessage = message.senderId === currentUser.id || 
                      message.anonymousSenderId === currentUser.id;
  
  const canModifyMessage = () => {
    if (isOwnMessage) return true;
    if (conversationType === 'group' || conversationType === 'public' || conversationType === 'global') {
      return ['MODERATOR', 'ADMIN', 'CREATOR', 'BIGBOSS'].includes(userRole);
    }
    return false;
  };

  const canDeleteMessage = () => {
    if (['BIGBOSS', 'ADMIN', 'MODERATOR'].includes(userRole)) return true;
    
    const messageAge = Date.now() - new Date(message.createdAt).getTime();
    const twelveHours = 12 * 60 * 60 * 1000;
    
    if (messageAge > twelveHours) return false;
    return canModifyMessage();
  };

  // Données dérivées pour l'affichage
  const availableVersions = [
    {
      language: message.originalLanguage || 'fr',
      content: message.originalContent || message.content,
      isOriginal: true,
      confidence: 1,
      model: 'original'
    },
    ...message.translations?.map((t: any) => ({
      language: t.language || t.targetLanguage,
      content: t.content || t.translatedContent,
      isOriginal: false,
      confidence: t.confidence || t.confidenceScore || 0.9,
      model: t.model || t.translationModel || 'basic'
    })) || []
  ];

  const getMissingLanguages = () => {
    const translatedLanguages = new Set([
      message.originalLanguage || 'fr',
      ...message.translations?.map((t: any) => t?.language || t?.targetLanguage).filter(Boolean) || []
    ]);
    
    return SUPPORTED_LANGUAGES.filter(lang => !translatedLanguages.has(lang.code));
  };

  // Utilitaires pour les modèles de traduction
  const getModelInfo = (model: string) => {
    switch (model) {
      case 'basic':
        return { 
          name: 'Basic', 
          icon: Shield, 
          color: 'text-gray-500', 
          bgColor: 'bg-gray-50',
          description: 'Traduction rapide'
        };
      case 'medium':
        return { 
          name: 'Medium', 
          icon: ShieldCheck, 
          color: 'text-blue-500', 
          bgColor: 'bg-blue-50',
          description: 'Traduction équilibrée'
        };
      case 'premium':
        return { 
          name: 'Premium', 
          icon: Zap, 
          color: 'text-purple-500', 
          bgColor: 'bg-purple-50',
          description: 'Traduction haute qualité'
        };
      default:
        return { 
          name: model, 
          icon: Shield, 
          color: 'text-gray-500', 
          bgColor: 'bg-gray-50',
          description: 'Modèle inconnu'
        };
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return 'text-green-600 bg-green-50';
    if (confidence >= 0.7) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 0.9) return 'Excellent';
    if (confidence >= 0.7) return 'Bon';
    return 'À améliorer';
  };

  const getUpgradeOptions = (currentModel: string) => {
    const models = ['basic', 'medium', 'premium'];
    const currentIndex = models.indexOf(currentModel);
    return models.slice(currentIndex + 1);
  };

  const filteredVersions = availableVersions.filter(version => {
    if (!translationFilter.trim()) return true;
    const langInfo = getLanguageInfo((version as any).language);
    const searchTerm = translationFilter.toLowerCase();
    return (
      langInfo.name.toLowerCase().includes(searchTerm) ||
      langInfo.code.toLowerCase().includes(searchTerm) ||
      (version as any).content.toLowerCase().includes(searchTerm)
    );
  });

  const filteredMissingLanguages = getMissingLanguages().filter(lang => {
    if (!translationFilter.trim()) return true;
    const searchTerm = translationFilter.toLowerCase();
    return (
      lang.name.toLowerCase().includes(searchTerm) ||
      lang.code.toLowerCase().includes(searchTerm)
    );
  });

  return (
    <TooltipProvider>
      <Card 
        ref={messageRef}
        className={cn(
          "bubble-message relative transition-all duration-300 hover:shadow-lg mx-2",
          isOwnMessage ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200'
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <CardContent className="p-4">
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center space-x-3">
              <Avatar className="h-10 w-10">
                <AvatarImage 
                  src={(message.sender as any)?.avatar} 
                  alt={message.sender?.firstName} 
                />
                <AvatarFallback className="bg-gray-100 text-gray-600 font-medium">
                  {getMessageInitials(message)}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <span className="font-medium text-gray-900">
                    @{message.sender?.username}
                  </span>
                  {message.anonymousSenderId && (
                    <Ghost className="h-4 w-4 text-gray-400" />
                  )}
                  <span className="text-gray-400">•</span>
                  <span className="text-gray-500 flex items-center text-sm">
                    <Timer className="h-3 w-3 mr-1" />
                    {formatTimeAgo(message.createdAt)}
                  </span>
                </div>
              </div>
            </div>

            {/* Indicateur de statut de traduction */}
            <div className="flex items-center space-x-2">
              {/* Indicateur de traduction automatique */}
              {currentDisplayLanguage !== (message.originalLanguage || 'fr') && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="secondary" className="text-xs px-2 py-1 bg-blue-100 text-blue-700 border-blue-200">
                      <Languages className="h-3 w-3 mr-1" />
                      {getLanguageInfo(currentDisplayLanguage).code.toUpperCase()}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    Traduit automatiquement en {getLanguageInfo(currentDisplayLanguage).name}
                  </TooltipContent>
                </Tooltip>
              )}
              
              {isActuallyTranslating && (
                <div className="flex items-center space-x-1 text-blue-600">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span className="text-xs">Traduction...</span>
                </div>
              )}
              
              {translationError && (
                <div className="flex items-center space-x-1 text-red-600">
                  <AlertTriangle className="h-3 w-3" />
                  <span className="text-xs">Erreur</span>
                </div>
              )}

              {/* Langue originale */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge 
                    variant="outline" 
                    className="bg-gray-50 border-gray-300 text-gray-700 font-medium cursor-pointer hover:bg-gray-100"
                    onClick={() => handleLanguageSwitch(message.originalLanguage || 'fr')}
                  >
                    <span className="mr-1">{getLanguageInfo(message.originalLanguage || 'fr').flag}</span>
                    {getLanguageInfo(message.originalLanguage || 'fr').code.toUpperCase()}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  {t('originalLanguage')}: {getLanguageInfo(message.originalLanguage || 'fr').name}
                </TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* Contenu principal */}
          <div className="mb-3">
            <AnimatePresence mode="wait">
              <motion.div
                key={`${message.id}-${currentDisplayLanguage}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                ref={contentRef}
              >
                <div className="space-y-2">
                  <p className="text-gray-900 leading-relaxed whitespace-pre-wrap text-base">
                    {getCurrentContent()}
                  </p>
                  
                  {/* Liste des drapeaux de traductions */}
                  <div className="flex items-center flex-wrap gap-1">
                    {/* Drapeau langue originale */}
                    <button
                      onClick={() => handleLanguageSwitch(message.originalLanguage || 'fr')}
                      className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium transition-all ${
                        currentDisplayLanguage === (message.originalLanguage || 'fr')
                          ? 'bg-blue-100 text-blue-700 border-blue-200 border'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-transparent'
                      }`}
                      title={`${t('originalLanguage')}: ${getLanguageInfo(message.originalLanguage || 'fr').name}`}
                    >
                      <span className="mr-1">{getLanguageInfo(message.originalLanguage || 'fr').flag}</span>
                      <span className="text-[10px] font-semibold">
                        {getLanguageInfo(message.originalLanguage || 'fr').code.toUpperCase()}
                      </span>
                      {currentDisplayLanguage === (message.originalLanguage || 'fr') && (
                        <span className="ml-1 text-blue-600 text-[8px]">●</span>
                      )}
                    </button>
                    
                    {/* Drapeaux des traductions disponibles */}
                    {message.translations?.map((translation, index) => {
                      const lang = (translation as any).language || (translation as any).targetLanguage;
                      const langInfo = getLanguageInfo(lang);
                      const isCurrentlyDisplayed = currentDisplayLanguage === lang;
                      
                      return (
                        <button
                          key={`${message.id}-flag-${lang}-${index}`}
                          onClick={() => handleLanguageSwitch(lang)}
                          className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium transition-all ${
                            isCurrentlyDisplayed
                              ? 'bg-blue-100 text-blue-700 border-blue-200 border'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-transparent'
                          }`}
                          title={`${langInfo.name}: ${((translation as any).content || (translation as any).translatedContent)?.substring(0, 50)}...`}
                        >
                          <span className="mr-1">{langInfo.flag}</span>
                          <span className="text-[10px] font-semibold">{langInfo.code.toUpperCase()}</span>
                          {isCurrentlyDisplayed && (
                            <span className="ml-1 text-blue-600 text-[8px]">●</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1">
              {/* Bouton traduction avec popover */}
              <Popover 
                open={isTranslationPopoverOpen} 
                onOpenChange={handlePopoverOpenChange}
              >
                <PopoverTrigger asChild>
                  <motion.div
                    animate={isNewTranslation ? {
                      scale: [1, 1.05, 1],
                      boxShadow: [
                        "0 0 0 0 rgba(34, 197, 94, 0)",
                        "0 0 0 8px rgba(34, 197, 94, 0.2)",
                        "0 0 0 0 rgba(34, 197, 94, 0)"
                      ]
                    } : {}}
                    transition={{
                      duration: 1,
                      ease: "easeOut"
                    }}
                    className="rounded-full"
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                      }}
                      className={cn(
                        "relative p-2 rounded-full transition-all duration-200",
                        isActuallyTranslating 
                          ? "text-blue-600 animate-ping" 
                          : isNewTranslation
                            ? "text-green-600 bg-green-50 hover:bg-green-100"
                            : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
                      )}
                    >
                    <motion.div
                      animate={isNewTranslation ? {
                        rotate: [0, -10, 10, -5, 5, 0],
                        scale: [1, 1.1, 1]
                      } : {}}
                      transition={{
                        duration: 0.8,
                        ease: "easeOut"
                      }}
                    >
                      <Languages className={cn(
                        "h-4 w-4",
                        isActuallyTranslating && "animate-pulse",
                        isNewTranslation && "text-green-600"
                      )} />
                    </motion.div>
                    {message.translations && message.translations.length > 0 && (
                      <motion.span 
                        className={cn(
                          "absolute -top-1 -right-1 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-medium transition-all duration-300",
                          isNewTranslation 
                            ? "bg-green-500 shadow-lg shadow-green-500/50 scale-110" 
                            : "bg-blue-500"
                        )}
                        initial={false}
                        animate={isNewTranslation ? {
                          scale: [1, 1.3, 1.1],
                          backgroundColor: ["#3b82f6", "#10b981", "#3b82f6"],
                        } : {
                          scale: 1,
                          backgroundColor: "#3b82f6"
                        }}
                        transition={{
                          duration: 0.6,
                          ease: "easeOut"
                        }}
                        key={message.translations.length} // Force re-render on count change
                      >
                        <motion.span
                          initial={false}
                          animate={isNewTranslation ? {
                            scale: [1, 0.8, 1],
                          } : {
                            scale: 1
                          }}
                          transition={{
                            duration: 0.4,
                            delay: 0.1,
                            ease: "easeOut"
                          }}
                        >
                          {message.translations.length}
                        </motion.span>
                      </motion.span>
                    )}
                    </Button>
                  </motion.div>
                </PopoverTrigger>
                <PopoverContent 
                  className={`w-72 p-0 shadow-2xl border border-gray-200 bg-white/95 backdrop-blur-sm ${Z_CLASSES.TRANSLATION_POPOVER}`}
                  style={{ zIndex: 9999 }}
                  side="top" 
                  align="start"
                  sideOffset={8}
                  alignOffset={0}
                  avoidCollisions={true}
                  onOpenAutoFocus={(e) => e.preventDefault()}
                  onInteractOutside={(e) => {
                    e.preventDefault();
                    handlePopoverOpenChange(false);
                  }}
                >
                  <div className="p-3 bg-transparent relative">
                    {/* Champ de filtre discret */}
                    {(availableVersions.length > 1 || getMissingLanguages().length > 0) && (
                      <div className="mb-3">
                        <div className="relative">
                          <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                          <Input
                            ref={filterInputRef}
                            placeholder="Filtrer les langues..."
                            value={translationFilter}
                            onChange={(e) => setTranslationFilter(e.target.value)}
                            className="pl-8 pr-8 h-8 text-xs bg-gray-50/80 border-gray-200/60 focus:bg-white focus:border-blue-300 transition-all"
                          />
                          {translationFilter && (
                            <button
                              onClick={() => setTranslationFilter('')}
                              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="space-y-1 max-h-64 overflow-y-auto scrollbar-thin">
                      {filteredVersions.length > 0 ? (
                        filteredVersions.map((version) => {
                          const versionAny = version as any;
                          const langInfo = getLanguageInfo(versionAny.language);
                          const isCurrentlyDisplayed = currentDisplayLanguage === versionAny.language;
                          
                          return (
                            <button
                              key={`${message.id}-${versionAny.language}-${versionAny.timestamp?.getTime() || Date.now()}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleLanguageSwitch(versionAny.language);
                                handlePopoverOpenChange(false);
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
                                  {versionAny.isOriginal && (
                                    <span className="text-xs text-gray-500 bg-gray-100/60 px-1.5 py-0.5 rounded">
                                      Original
                                    </span>
                                  )}
                                  {isCurrentlyDisplayed && (
                                    <CheckCircle2 className="h-3.5 w-3.5 text-blue-600" />
                                  )}
                                </div>
                                {!versionAny.isOriginal && (
                                  <div className="flex items-center space-x-1">
                                    {/* Icône d'upgrade vers tier supérieur */}
                                    {getNextTier && getNextTier(versionAny.model || 'basic') && (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <div
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleUpgradeTier && handleUpgradeTier(versionAny.language, versionAny.model || 'basic');
                                            }}
                                            className="p-1 rounded hover:bg-green-100 text-green-600 hover:text-green-700 transition-colors cursor-pointer"
                                          >
                                            <ArrowUp className="h-3 w-3" />
                                          </div>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          Améliorer la qualité (modèle {versionAny.model || 'basic'} → {getNextTier(versionAny.model || 'basic')})
                                        </TooltipContent>
                                      </Tooltip>
                                    )}
                                    <span className="text-xs text-gray-500 bg-gray-100/60 px-1.5 py-0.5 rounded">
                                      {Math.round(versionAny.confidence * 100)}%
                                    </span>
                                    {versionAny.model && (
                                      <span className="text-xs text-blue-600 bg-blue-100/60 px-1.5 py-0.5 rounded">
                                        {versionAny.model}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                              
                              <p className="text-sm text-gray-600 leading-relaxed line-clamp-2 group-hover:text-gray-800">
                                {versionAny.content}
                              </p>
                              
                              {/* Indicateur de qualité discret */}
                              {!versionAny.isOriginal && (
                                <div className="mt-1.5 flex items-center space-x-1">
                                  <div className="flex-1 bg-gray-200/40 rounded-full h-0.5">
                                    <div 
                                      className="bg-green-400 h-0.5 rounded-full transition-all duration-300"
                                      style={{ width: `${Math.round((versionAny.confidence || 0.9) * 100)}%` }}
                                    />
                                  </div>
                                </div>
                              )}
                            </button>
                          );
                        })
                      ) : (
                        <div className="text-center p-4 text-gray-400">
                          <Languages className="h-6 w-6 mx-auto mb-2 opacity-60" />
                          <p className="text-xs">
                            {translationFilter ? 'Aucune traduction trouvée' : 'Aucune traduction disponible'}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Séparateur et section pour les nouvelles traductions */}
                    {filteredMissingLanguages.length > 0 && (
                      <>
                        <div className="flex items-center my-3">
                          <div className="flex-1 h-px bg-gray-200/60"></div>
                          <div className="px-3">
                            <span className="text-xs text-gray-500 bg-gray-100/60 px-2 py-1 rounded-full">
                              Traduire vers d'autres langues  
                            </span>
                          </div>
                          <div className="flex-1 h-px bg-gray-200/60"></div>
                        </div>

                        <div className="space-y-1 max-h-32 overflow-y-auto">
                          {filteredMissingLanguages.map((lang) => (
                            <button
                              key={lang.code}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleForceTranslation(lang.code);
                                handlePopoverOpenChange(false);
                              }}
                              className="w-full p-2 rounded-lg border border-gray-100/60 text-left transition-all hover:shadow-sm hover:border-green-200/60 hover:bg-green-50/60"
                            >
                              <div className="flex items-center space-x-2">
                                <span className="text-sm">{lang.flag}</span>
                                <div className="flex-1">
                                  <span className="font-medium text-sm text-gray-700">{lang.name}</span>
                                  <p className="text-xs text-gray-500 mt-0.5">{lang.translateText}</p>
                                </div>
                                <Languages className="h-3 w-3 text-green-600 opacity-60" />
                              </div>
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  
                    {(normalizedTranslations.some((t: any) => t.status === 'translating') || isActuallyTranslating) && (
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

              {/* Autres boutons d'action */}
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

              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(getCurrentContent());
                }}
                className="text-gray-500 hover:text-gray-700 hover:bg-gray-50 p-2 rounded-full"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>

            {/* Menu d'options si permissions */}
            {canModifyMessage() && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-gray-500 hover:text-gray-700 hover:bg-gray-50 p-1 rounded-full"
                  >
                    <MoreHorizontal className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={handleEditMessage}>
                    <Edit className="h-4 w-4 mr-2" />
                    <span>{t('edit')}</span>
                  </DropdownMenuItem>
                  {canDeleteMessage() && (
                    <DropdownMenuItem 
                      onClick={handleDeleteMessage}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      <span>{t('delete')}</span>
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}

export const BubbleMessage = memo(BubbleMessageInner, (prevProps, nextProps) => {
  // Comparaison approfondie pour détecter les changements dans les traductions
  const prevTranslations = prevProps.message.translations || [];
  const nextTranslations = nextProps.message.translations || [];
  
  // Si le nombre de traductions a changé, re-render
  if (prevTranslations.length !== nextTranslations.length) {
    return false;
  }
  
  // Vérifier si le contenu des traductions a changé
  const translationsChanged = prevTranslations.some((prevTrans, index) => {
    const nextTrans = nextTranslations[index];
    return !nextTrans || 
           prevTrans.targetLanguage !== nextTrans.targetLanguage ||
           prevTrans.translatedContent !== nextTrans.translatedContent ||
           prevTrans.translationModel !== nextTrans.translationModel;
  });
  
  if (translationsChanged) {
    return false;
  }
  
  // Comparaison des autres props
  return (
    prevProps.message.id === nextProps.message.id &&
    prevProps.message.content === nextProps.message.content &&
    prevProps.currentDisplayLanguage === nextProps.currentDisplayLanguage &&
    prevProps.isTranslating === nextProps.isTranslating &&
    prevProps.translationError === nextProps.translationError
  );
});

BubbleMessage.displayName = 'BubbleMessage';