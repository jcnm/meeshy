'use client';

import { useState, useEffect, useRef, memo } from 'react';
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
  CheckCheck
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
import type { Message } from '@shared/types/conversation';
import type { BubbleStreamMessage } from '@/types/bubble-stream';
import { Z_CLASSES } from '@/lib/z-index';
import { useTranslations } from '@/hooks/useTranslations';

interface BubbleMessageProps {
  message: Message & {
    location?: string;
    originalLanguage: string;
    translations: BubbleTranslation[];
    originalContent: string; // Contenu original de l'auteur
    readStatus?: Array<{ userId: string; readAt: Date }>; // Statut de lecture par utilisateur
  };
  currentUser: User;
  userLanguage: string;
  usedLanguages: string[];
  onForceTranslation?: (messageId: string, targetLanguage: string) => Promise<void>;
  onEditMessage?: (messageId: string, newContent: string) => Promise<void>;
  onDeleteMessage?: (messageId: string) => Promise<void>;
  conversationType?: 'direct' | 'group' | 'public' | 'global';
  userRole?: 'USER' | 'MEMBER' | 'MODERATOR' | 'ADMIN' | 'CREATOR' | 'AUDIT' | 'ANALYST' | 'BIGBOSS';
  // Nouvelles props pour gérer l'état des traductions en cours
  isTranslating?: (messageId: string, targetLanguage: string) => boolean;
}

const SUPPORTED_LANGUAGES = [
  { code: 'fr', name: 'Français', flag: '🇫🇷', translateText: 'Traduire ce message en français' },
  { code: 'en', name: 'English', flag: '🇬🇧', translateText: 'Translate this message to English' },
  { code: 'es', name: 'Español', flag: '🇪🇸', translateText: 'Traducir este mensaje al español' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪', translateText: 'Diese Nachricht ins Deutsche übersetzen' },
  { code: 'pt', name: 'Português', flag: '🇵🇹', translateText: 'Traduzir esta mensagem para português' },
  { code: 'zh', name: '中文', flag: '🇨🇳', translateText: '将此消息翻译成中文' },
  { code: 'ja', name: '日本語', flag: '🇯🇵', translateText: 'このメッセージを日本語に翻訳' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦', translateText: 'ترجمة هذه الرسالة إلى العربية' },
];

function BubbleMessageInner({ 
  message, 
  currentUser, 
  userLanguage, 
  usedLanguages = [],
  onForceTranslation,
  onEditMessage,
  onDeleteMessage,
  conversationType = 'direct',
  userRole = 'USER',
  isTranslating
}: BubbleMessageProps) {
  const { t } = useTranslations('bubbleStream');
  

  const [currentDisplayLanguage, setCurrentDisplayLanguage] = useState(message.originalLanguage);
  const [isHovered, setIsHovered] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);
  const [isTranslationPopoverOpen, setIsTranslationPopoverOpen] = useState(false);
  const [translationFilter, setTranslationFilter] = useState('');
  const [hasPendingForcedTranslation, setHasPendingForcedTranslation] = useState(false);
  const [newTranslationsCount, setNewTranslationsCount] = useState(0);
  const [lastTranslationCount, setLastTranslationCount] = useState(0);
  const [showNewTranslationsIndicator, setShowNewTranslationsIndicator] = useState(false);

  // Détecter les nouvelles traductions et mettre à jour le compteur
  useEffect(() => {
    const currentTranslationCount = message.translations?.length || 0;
    
    // Si c'est la première fois qu'on charge le message, initialiser le compteur
    if (lastTranslationCount === 0) {
      setLastTranslationCount(currentTranslationCount);
      return;
    }
    
    // Si le nombre de traductions a augmenté, c'est qu'il y a de nouvelles traductions
    if (currentTranslationCount > lastTranslationCount) {
      const newTranslations = currentTranslationCount - lastTranslationCount;
      setNewTranslationsCount(prev => prev + newTranslations);
      setLastTranslationCount(currentTranslationCount);
      
      // Afficher l'indicateur de nouvelles traductions
      setShowNewTranslationsIndicator(true);
      
      // Programmer la disparition de l'indicateur après 10 secondes
      const timer = setTimeout(() => {
        setShowNewTranslationsIndicator(false);
      }, 10000);
      
      
      // Nettoyer le timer si le composant se démonte
      return () => clearTimeout(timer);
    }
  }, [message.translations?.length, message.id, lastTranslationCount, newTranslationsCount]);
  const contentRef = useRef<HTMLDivElement>(null);
  const messageRef = useRef<HTMLDivElement>(null);
  const filterInputRef = useRef<HTMLInputElement>(null);

  // Vérifier si le message a été lu par l'utilisateur actuel
  const isMessageReadByCurrentUser = () => {
    // TEMPORAIRE : considérer les propres messages comme lus
    const isOwnMessage = message.senderId === currentUser.id || 
                        message.anonymousSenderId === currentUser.id;
    if (isOwnMessage) return true;
    
    // Vérifier via readStatus si disponible
    if (message.readStatus && message.readStatus.length > 0 && currentUser.id) {
      return message.readStatus.some(status => status.userId === currentUser.id);
    }
    
    // Fallback temporaire : messages anciens (créés il y a plus de 30 secondes) sont considérés comme lus
    const messageAge = Date.now() - new Date(message.createdAt).getTime();
    return messageAge > 30000; // 30 secondes au lieu de 10
  };

  // Fonction pour déterminer le statut de réception d'un message
  const getMessageDeliveryStatus = () => {
    const isOwnMessage = message.senderId === currentUser.id || 
                        message.anonymousSenderId === currentUser.id;
    
    if (!isOwnMessage) return null; // Seuls nos propres messages ont des indicateurs de réception
    
    // Si le message a un readStatus, compter les lecteurs
    if (message.readStatus && message.readStatus.length > 0) {
      const readCount = message.readStatus.length;
      
      if (readCount > 0) { // Au moins une personne a lu
        return { status: 'read' };
      }
    }
    
    // Par défaut, considérer comme envoyé
    return { status: 'sent' };
  };

  const getLanguageInfo = (langCode: string) => {
    // Validation stricte - les langues sont obligatoires dans Meeshy
    if (!langCode) {
      console.error('🚨 ERREUR CRITIQUE: Code de langue vide détecté!', { langCode, message });
      throw new Error(`Code de langue vide détecté pour le message ${message.id}`);
    }
    
    const found = SUPPORTED_LANGUAGES.find(lang => lang.code === langCode);
    if (found) return found;
    
    // Si la langue n'est pas trouvée, c'est un problème mais pas critique
    console.warn('⚠️ Langue non supportée détectée:', langCode, 'pour le message:', message.id);
    return {
      code: langCode,
      name: langCode.toUpperCase(),
      flag: '🌐'
    };
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

  // Réinitialiser l'état de traduction forcée quand les traductions sont mises à jour
  useEffect(() => {
    if (hasPendingForcedTranslation && message.translations.some(t => t.status === 'completed')) {
      setHasPendingForcedTranslation(false);
    }
  }, [message.translations, hasPendingForcedTranslation]);

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
    // Si on affiche la langue originale, retourner le contenu original
    if (currentDisplayLanguage === message.originalLanguage) {
      return message.originalContent || message.content;
    }
    
    // Chercher la traduction pour la langue d'affichage actuelle
    const translation = message.translations.find(t => 
      t.language === currentDisplayLanguage && t.status === 'completed'
    );
    
    return translation?.content || message.originalContent || message.content;
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
    setTranslationFilter(''); // Réinitialiser le filtre lors du changement de langue
  };

  // Obtenir les langues manquantes (supportées mais pas traduites)
  const getMissingLanguages = () => {
    const translatedLanguages = new Set([
      message.originalLanguage,
      ...message.translations.map(t => t.language)
    ]);
    
    return SUPPORTED_LANGUAGES.filter(lang => !translatedLanguages.has(lang.code));
  };

  // Obtenir les traductions disponibles (pour affichage du badge)
  const getAvailableTranslations = () => {
    return message.translations.filter(t => t.status === 'completed');
  };

  // Vérifier si des traductions sont disponibles
  const hasAvailableTranslations = getAvailableTranslations().length > 0;

  const handleForceTranslation = async (targetLanguage: string) => {
    setIsTranslationPopoverOpen(false);
    setTranslationFilter(''); // Réinitialiser le filtre
    setHasPendingForcedTranslation(true); // Marquer qu'une traduction forcée est en attente
    
    if (onForceTranslation) {
      try {
        await onForceTranslation(message.id, targetLanguage);
        // Le toast de succès est géré dans bubble-stream-page.tsx, pas ici
      } catch (error) {
        toast.error(t('toasts.messages.translationError'));
      } finally {
        setHasPendingForcedTranslation(false); // Réinitialiser l'état
      }
    } else {
      setHasPendingForcedTranslation(false); // Réinitialiser l'état
    }
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
      toast.info(t('toasts.messages.translationMaxTier'));
      return;
    }

    setIsTranslationPopoverOpen(false);
    setTranslationFilter(''); // Réinitialiser le filtre
    
    if (onForceTranslation) {
      try {
        // Appeler le service de traduction directement avec le bon modèle
        const { messageTranslationService } = await import('@/services/message-translation.service');
        
        const result = await messageTranslationService.requestTranslation({
          messageId: message.id,
          targetLanguage,
          sourceLanguage: message.originalLanguage,
          model: nextTier as 'basic' | 'medium' | 'premium'
        });
        
        toast.success(`Retraduction en cours vers ${getLanguageInfo(targetLanguage).name} (modèle ${nextTier})`);
        
        // Déclencher le callback pour mettre à jour l'interface
        await onForceTranslation(message.id, targetLanguage);
        
      } catch (error) {
        toast.error('Erreur lors de la demande d\'upgrade');
      }
    }
  };

  const isOwnMessage = message.senderId === currentUser.id || 
                      message.anonymousSenderId === currentUser.id;
  const isUsedLanguage = usedLanguages?.includes(currentDisplayLanguage) || false;

  // Vérifier si l'utilisateur peut modifier/supprimer le message
  const canModifyMessage = () => {
    // L'auteur du message peut toujours le modifier
    if (isOwnMessage) return true;
    
    // Dans un groupe, seuls les modérateurs, admins et créateurs peuvent modifier les messages d'autres utilisateurs
    if (conversationType === 'group' || conversationType === 'public' || conversationType === 'global') {
      return userRole === 'MODERATOR' || userRole === 'ADMIN' || userRole === 'CREATOR' || userRole === 'BIGBOSS';
    }
    
    return false;
  };

  // Vérifier si l'utilisateur peut supprimer le message (avec restriction temporelle)
  const canDeleteMessage = () => {
    // Les utilisateurs avec des rôles élevés peuvent toujours supprimer
    if (userRole === 'BIGBOSS' || userRole === 'ADMIN' || userRole === 'MODERATOR') {
      return true;
    }
    
    // Pour les autres utilisateurs, vérifier l'âge du message
    const messageAge = Date.now() - new Date(message.createdAt).getTime();
    const twelveHoursInMs = 12 * 60 * 60 * 1000; // 12 heures en millisecondes
    
    // Si le message a plus de 12h, seuls les rôles élevés peuvent le supprimer
    if (messageAge > twelveHoursInMs) {
      return false;
    }
    
    // Sinon, utiliser la logique normale de modification
    return canModifyMessage();
  };

  const canShowOptionsMenu = canModifyMessage();

  // Fonctions pour gérer l'édition et la suppression
  const handleEditMessage = async () => {
    if (!onEditMessage) return;
    
    const newContent = prompt('Modifier le message:', message.content);
    if (newContent && newContent.trim() !== message.content) {
      try {
        await onEditMessage(message.id, newContent.trim());
        toast.success('Message modifié avec succès');
      } catch (error) {
        toast.error('Erreur lors de la modification du message');
      }
    }
  };

  const handleDeleteMessage = async () => {
    if (!onDeleteMessage) return;
    
    // Vérifier si l'utilisateur peut supprimer le message
    if (!canDeleteMessage()) {
      const messageAge = Date.now() - new Date(message.createdAt).getTime();
      const twelveHoursInMs = 12 * 60 * 60 * 1000;
      
      if (messageAge > twelveHoursInMs) {
        toast.error(t('messageTooOldToDelete'));
      } else {
        toast.error(t('noRightsToDelete'));
      }
      return;
    }
    
    const confirmed = confirm('Êtes-vous sûr de vouloir supprimer ce message ?');
    if (confirmed) {
      try {
        await onDeleteMessage(message.id);
        toast.success('Message supprimé avec succès');
      } catch (error) {
        toast.error('Erreur lors de la suppression du message');
      }
    }
  };

  // Obtenir toutes les versions disponibles (original + traductions complètes)
  // CORRECTION: Déduplication des traductions pour éviter les doublons
  const availableVersions = [
    {
      language: message.originalLanguage,
      content: message.originalContent || message.content, // TOUJOURS le contenu original de l'auteur
      isOriginal: true,
      status: 'completed' as const,
      confidence: 1,
      timestamp: new Date(message.createdAt)
    },
    // Déduplication des traductions par langue - garder la plus récente
    ...Object.values(
      message.translations
        .filter(t => t.status === 'completed' && t.language) // Filtrer les traductions valides
        .reduce((acc, t) => {
          // Garder la traduction la plus récente pour chaque langue
          const currentTimestamp = new Date(t.timestamp || 0);
          const existingTimestamp = acc[t.language] ? new Date(acc[t.language].timestamp || 0) : new Date(0);
          
          if (!acc[t.language] || currentTimestamp > existingTimestamp) {
            acc[t.language] = {
              ...t,
              isOriginal: false,
              model: (t as any).model || 'basic' // Inclure le modèle de traduction
            };
          }
          return acc;
        }, {} as Record<string, any>)
    )
  ];

  const isTranslated = currentDisplayLanguage !== message.originalLanguage;
  
  
  // Permettre à l'émetteur de voir les traductions de son propre message
  const canSeeTranslations = availableVersions.length > 1;
  
  // Améliorer la visibilité de l'icône globe avec un badge
  const translationCount = availableVersions.length - 1; // Exclure l'original
  
  // Calculer le nombre total de traductions à afficher dans le badge
  // Afficher le badge si le message n'est pas lu OU s'il y a de nouvelles traductions avec indicateur actif
  const isRead = isMessageReadByCurrentUser();
  const shouldShowTranslationBadge = !isRead || showNewTranslationsIndicator || translationCount > 0;
  const totalTranslationBadgeCount = !isRead ? 1 : Math.max(translationCount, (showNewTranslationsIndicator ? newTranslationsCount : 0));

  // FORCE l'affichage du badge pour les messages non lus (temporaire pour debug)
  const forceShowBadge = !isRead;
  const finalShouldShowBadge = shouldShowTranslationBadge || forceShowBadge;
  const finalBadgeCount = forceShowBadge ? 1 : totalTranslationBadgeCount;


  // Filtrer les versions disponibles selon le filtre de recherche
  const filteredVersions = availableVersions.filter(version => {
    if (!translationFilter.trim()) return true;
    
    const langInfo = getLanguageInfo(version.language);
    const searchTerm = translationFilter.toLowerCase();
    
    return (
      langInfo.name.toLowerCase().includes(searchTerm) ||
      langInfo.code.toLowerCase().includes(searchTerm) ||
      version.content.toLowerCase().includes(searchTerm)
    );
  });

  // Filtrer les langues manquantes selon le filtre de recherche
  const filteredMissingLanguages = getMissingLanguages().filter(lang => {
    if (!translationFilter.trim()) return true;
    
    const searchTerm = translationFilter.toLowerCase();
    return (
      lang.name.toLowerCase().includes(searchTerm) ||
      lang.code.toLowerCase().includes(searchTerm)
    );
  });

  // Focus sur le champ de filtre quand le popover s'ouvre
  useEffect(() => {
    if (isTranslationPopoverOpen && filterInputRef.current) {
      setTimeout(() => {
        filterInputRef.current?.focus();
      }, 100);
    }
  }, [isTranslationPopoverOpen]);

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
          setTimeout(() => {
            setIsTranslationPopoverOpen(false);
            setTranslationFilter(''); // Réinitialiser le filtre
          }, 300);
        }}
      >
        <CardContent className="p-4">
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center space-x-3">
              <Avatar className="h-10 w-10">
                <AvatarImage 
                  src={(message.sender as any)?.avatar} 
                  alt={message.sender?.firstName || message.anonymousSender?.firstName} 
                />
                <AvatarFallback className="bg-gray-100 text-gray-600 font-medium">
                  {message.sender ? (
                    <>
                      {message.sender?.firstName?.charAt(0)?.toUpperCase()}{message.sender?.lastName?.charAt(0)?.toUpperCase()}
                    </>
                  ) : (
                    <>
                      {message.anonymousSender?.firstName?.charAt(0)?.toUpperCase()}{message.anonymousSender?.lastName?.charAt(0)?.toUpperCase()}
                    </>
                  )}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <span className="font-medium text-gray-900">
                    @{message.sender?.username || message.anonymousSender?.username}
                  </span>
                  {message.anonymousSender && (
                    <Ghost className="h-4 w-4 text-gray-400" />
                  )}
                  <span className="text-gray-400">•</span>
                  <span className="text-sm text-gray-500 flex items-center">
                    <Timer className="h-3 w-3 mr-1" />
                    {formatTimeAgo(message.createdAt)}
                  </span>
                  {/* Indicateur de position temporairement désactivé - à réactiver plus tard */}
                  {/* {message.location && (
                    <>
                      <span className="text-gray-400">•</span>
                      <span className="text-sm text-gray-500 flex items-center">
                        <MapPin className="h-3 w-3 mr-1" />
                        {message.location}
                      </span>
                    </>
                  )} */}
                </div>
              </div>
            </div>

            {/* Indicateur de langue originale seulement */}
            <div className="flex items-center space-x-2">
              {(message.translations.some(t => t.status === 'translating') || (isTranslating && isTranslating(message.id, userLanguage))) && (
                <div className="flex items-center space-x-1 px-2 py-1 bg-blue-100 rounded-full">
                  <Loader2 className="h-3 w-3 animate-spin text-blue-600" />
                  <span className="text-xs text-blue-600 font-medium">{t('translating')}</span>
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
                <TooltipContent>{t('originalLanguage')}: {getLanguageInfo(message.originalLanguage).name} - {t('clickToViewOriginal')}</TooltipContent>
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
                transition={{ 
                  duration: 0.3, 
                  ease: [0.4, 0, 0.2, 1]
                }}
                ref={contentRef}
              >
                <div className="flex items-start justify-between">
                  <p className="text-gray-900 leading-relaxed whitespace-pre-wrap text-base flex-1">
                    {getCurrentContent()}
                  </p>
                  {/* Indicateur de traductions disponibles */}
                  {hasAvailableTranslations && currentDisplayLanguage === message.originalLanguage && (showNewTranslationsIndicator || !isMessageReadByCurrentUser()) && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="ml-2 mt-1 flex items-center space-x-1">
                          <div className="flex -space-x-1">
                            {getAvailableTranslations().slice(0, 3).map((translation, index) => (
                              <div
                                key={`${message.id}-translation-${translation.language}-${index}`}
                                className="w-4 h-4 rounded-full border border-white bg-blue-100 flex items-center justify-center text-xs font-medium text-blue-600"
                                title={`${getLanguageInfo(translation.language).name}: ${translation.content.substring(0, 20)}...`}
                              >
                                {getLanguageInfo(translation.language).flag}
                              </div>
                            ))}
                          </div>
                          {getAvailableTranslations().length > 3 && (
                            <span className="text-xs text-gray-500 font-medium">
                              +{getAvailableTranslations().length - 3}
                            </span>
                          )}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <div className="text-xs">
                          <div className="font-medium mb-1">{t('availableTranslations')}:</div>
                          {getAvailableTranslations().map((translation, index) => (
                            <div key={`${message.id}-tooltip-translation-${translation.language}-${index}`} className="flex items-center space-x-1">
                              <span>{getLanguageInfo(translation.language).flag}</span>
                              <span>{getLanguageInfo(translation.language).name}</span>
                            </div>
                          ))}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
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
                    disabled
                    className="text-gray-300 hover:text-gray-300 hover:bg-transparent p-2 rounded-full cursor-not-allowed"
                  >
                    <MessageCircle className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('reply')} (Non implémenté)</TooltipContent>
              </Tooltip>

              {/* Icône traduction - Interface complète */}
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
                      setIsTranslationPopoverOpen(!isTranslationPopoverOpen);
                      
                      // Réinitialiser le compteur de nouvelles traductions quand on ouvre le popover
                      // Seulement si le message n'est pas lu ou s'il y a de nouvelles traductions
                      if (!isTranslationPopoverOpen && (newTranslationsCount > 0 || !isMessageReadByCurrentUser())) {
                        setNewTranslationsCount(0);
                        setShowNewTranslationsIndicator(false);
                      }
                    }}
                    className={`relative p-2 rounded-full transition-all duration-200 ${
                      shouldShowTranslationBadge && totalTranslationBadgeCount > 0
                        ? 'text-green-600 hover:text-green-700 hover:bg-green-100' 
                        : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <Languages className={`h-4 w-4 transition-transform duration-200 ${
                      (hasPendingForcedTranslation || message.translations.some(t => t.status === 'translating') || (isTranslating && isTranslating(message.id, userLanguage))) ? 'animate-pulse text-blue-600' : ''
                    }`} />
                    {/* Badge pour indiquer le nombre de traductions */}
                    {finalShouldShowBadge && finalBadgeCount > 0 && (
                      <span className={`absolute -top-1 -right-1 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-medium ${
                        showNewTranslationsIndicator 
                          ? 'bg-orange-500 animate-bounce' // Orange pour les nouvelles traductions
                          : forceShowBadge 
                            ? 'bg-blue-600' // Bleu pour les messages non lus
                            : 'bg-green-600' // Vert pour les traductions normales
                      }`}>
                        {finalBadgeCount}
                      </span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent 
                  className={`w-72 p-0 shadow-2xl border border-gray-200 bg-white/95 backdrop-blur-sm ${Z_CLASSES.TRANSLATION_POPOVER}`}
                  side="top" 
                  align="start"
                  sideOffset={8}
                  alignOffset={0}
                  avoidCollisions={true}
                  onOpenAutoFocus={(e) => e.preventDefault()}
                  onInteractOutside={(e) => {
                    setIsTranslationPopoverOpen(false);
                    setTranslationFilter(''); // Réinitialiser le filtre
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
                            placeholder={t('filterLanguages')}
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
                          const langInfo = getLanguageInfo(version.language);
                          const isCurrentlyDisplayed = currentDisplayLanguage === version.language;
                          
                          return (
                            <button
                              key={`${message.id}-${version.language}-${version.timestamp?.getTime() || Date.now()}`}
                              onClick={(e) => {
                                e.stopPropagation();
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
                                      {t('original')}
                                    </span>
                                  )}
                                  {isCurrentlyDisplayed && (
                                    <CheckCircle2 className="h-3.5 w-3.5 text-blue-600" />
                                  )}
                                </div>
                                {!version.isOriginal && (
                                  <div className="flex items-center space-x-1">
                                    {/* Icône d'upgrade vers tier supérieur */}
                                    {getNextTier(version.model || 'basic') && (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <div
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleUpgradeTier(version.language, version.model || 'basic');
                                            }}
                                            className="p-1 rounded hover:bg-green-100 text-green-600 hover:text-green-700 transition-colors cursor-pointer"
                                          >
                                            <ArrowUp className="h-3 w-3" />
                                          </div>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          {t('improveTranslationQuality')} (modèle {version.model || 'basic'} → {getNextTier(version.model || 'basic')})
                                        </TooltipContent>
                                      </Tooltip>
                                    )}
                                    <span className="text-xs text-gray-500 bg-gray-100/60 px-1.5 py-0.5 rounded">
                                      {Math.round(version.confidence * 100)}%
                                    </span>
                                    {version.model && (
                                      <span className="text-xs text-blue-600 bg-blue-100/60 px-1.5 py-0.5 rounded">
                                        {version.model}
                                      </span>
                                    )}
                                  </div>
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
                          <Languages className="h-6 w-6 mx-auto mb-2 opacity-60" />
                          <p className="text-xs">
                            {translationFilter ? t('noTranslationFound') : t('noTranslationAvailable')}
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
                              {t('translateToOtherLanguages')}
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
                                setIsTranslationPopoverOpen(false);
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
                  
                    {(message.translations.some(t => t.status === 'translating') || (isTranslating && isTranslating(message.id, userLanguage))) && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <div className="flex items-center space-x-2 text-sm text-blue-700 bg-blue-50 p-2 rounded">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          <span>{t('translationsInProgress')}</span>
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
                <TooltipContent>{t('addToFavorites')}</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(getCurrentContent());
                      toast.success(t('toasts.messages.textCopied'));
                    }}
                    className="text-gray-500 hover:text-gray-700 hover:bg-gray-50 p-2 rounded-full"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('copy')}</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled
                    className="text-gray-300 hover:text-gray-300 hover:bg-transparent p-2 rounded-full cursor-not-allowed"
                  >
                    <AlertTriangle className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('report')} (Non implémenté)</TooltipContent>
              </Tooltip>
            </div>

            {/* Indicateurs de réception pour les messages de l'utilisateur actuel */}
            {(() => {
              const deliveryStatus = getMessageDeliveryStatus();
              if (!deliveryStatus) return null;

              const { status } = deliveryStatus;
              
              return (
                <div className="flex items-center space-x-2">
                  {status === 'sent' && (
                    <div className="flex items-center space-x-1 text-gray-400">
                      <Check className="h-3 w-3" />
                      <span className="text-xs">{t('deliveryStatus.sent')}</span>
                    </div>
                  )}
                  {status === 'read' && (
                    <div className="flex items-center space-x-1 text-green-500">
                      <CheckCheck className="h-3 w-3" />
                      <span className="text-xs">{t('deliveryStatus.read')}</span>
                    </div>
                  )}
                  
                  {/* Menu plus d'options - Affiché à droite des indicateurs d'état */}
                  {canShowOptionsMenu && (
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
                        <DropdownMenuItem onClick={handleEditMessage} className="flex items-center space-x-2">
                          <Edit className="h-4 w-4" />
                          <span>{t('edit')}</span>
                        </DropdownMenuItem>
                        {canDeleteMessage() && (
                          <DropdownMenuItem 
                            onClick={handleDeleteMessage} 
                            className="flex items-center space-x-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                            <span>{t('delete')}</span>
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              );
            })()}
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}

export const BubbleMessage = memo(BubbleMessageInner);
