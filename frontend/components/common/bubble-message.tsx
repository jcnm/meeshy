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
import type { User, MessageTranslation } from '@shared/types';
import type { Message } from '@shared/types/conversation';
import type { BubbleStreamMessage } from '@/types/bubble-stream';
import { Z_CLASSES } from '@/lib/z-index';
import { useTranslations } from '@/hooks/useTranslations';
import { getMessageInitials } from '@/lib/avatar-utils';
import { cn } from '@/lib/utils';
import { TranslationStatusIndicator, useTranslationStatus } from '@/components/translation/translation-status-indicator';

interface BubbleMessageProps {
  message: Message & {
    location?: string;
    originalLanguage: string;
    translations: MessageTranslation[];
    originalContent: string;
    readStatus?: Array<{ userId: string; readAt: Date }>;
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
  // Clé de re-render basée sur les traductions pour forcer la mise à jour
  const messageKey = useMemo(() => {
    const translationsKey = message.translations?.map((t: any) => 
      `${t.targetLanguage || t.language}-${(t.translatedContent || t.content)?.length || 0}-${t.id || ''}`
    ).join('|') || '';
    const finalKey = `${message.id}-${message.translations?.length || 0}-${translationsKey}`;
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔑 [MessageKey] ${message.id}: ${finalKey}`);
    }
    
    return finalKey;
  }, [message.id, message.translations, message.translations?.length]);

  // Debug: Vérifier les données de traduction reçues
  if (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_DEBUG_MESSAGES === 'true') {
    console.log(`🔍 [BubbleMessage] Message ${message.id} - données reçues:`, {
      messageId: message.id,
      translationsCount: message.translations?.length || 0,
      rawTranslations: message.translations,
      firstTranslation: message.translations?.[0] ? {
        id: message.translations[0].id,
        targetLanguage: message.translations[0].targetLanguage,
        translatedContent: message.translations[0].translatedContent?.substring(0, 30) + '...',
        translationModel: message.translations[0].translationModel,
        confidenceScore: message.translations[0].confidenceScore,
        cacheKey: message.translations[0].cacheKey,
        cached: message.translations[0].cached,
        createdAt: message.translations[0].createdAt,
        sourceLanguage: message.translations[0].sourceLanguage
      } : null
    });
  }
  const { t } = useTranslations('bubbleStream');
  
  // Hook pour gérer l'état des traductions
  const translationStatus = useTranslationStatus(message.id);
  
  // Détection mobile
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);
    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);
  

  const [currentDisplayLanguage, setCurrentDisplayLanguage] = useState(message.originalLanguage || 'fr');
  const [isHovered, setIsHovered] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);
  const [isTranslationPopoverOpen, setIsTranslationPopoverOpen] = useState(false);
  const [translationFilter, setTranslationFilter] = useState('');
  const [hasPendingForcedTranslation, setHasPendingForcedTranslation] = useState(false);
  const [newTranslationsCount, setNewTranslationsCount] = useState(0);
  const [lastTranslationCount, setLastTranslationCount] = useState(0);
  const [showNewTranslationsIndicator, setShowNewTranslationsIndicator] = useState(false);
  const [showTranslationArrivedIndicator, setShowTranslationArrivedIndicator] = useState(false);
  const [forceRenderCounter, setForceRenderCounter] = useState(0);
  const [shouldShowTranslationBadge, setShouldShowTranslationBadge] = useState(false);
  const [totalTranslationBadgeCount, setTotalTranslationBadgeCount] = useState(0);
  
  // État pour suivre les traductions déjà vues et afficher les toasts
  const [seenTranslations, setSeenTranslations] = useState(new Set<string>());
  
  // Force le re-rendu quand les données de traduction changent
  useEffect(() => {
    setForceRenderCounter(prev => prev + 1);
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔄 [BubbleMessage] Force re-render ${message.id} - counter: ${forceRenderCounter + 1}`);
    }
  }, [messageKey, message.translations?.length]);

  // Normaliser les traductions pour supporter les deux formats (backend et frontend)
  const normalizedTranslations = useMemo(() => {
    if (!message.translations || !Array.isArray(message.translations)) return [];
    
    const normalized = message.translations.map((t: any) => {
      // Support des deux formats : nouveau (language/content) et ancien (targetLanguage/translatedContent)
      const language = t.language || t.targetLanguage;
      const content = t.content || t.translatedContent;
      
      // Préserver TOUTES les données de traduction du backend
      return {
        ...t, // Préserver toutes les propriétés originales
        // Support des deux formats de langue - normaliser
        language: language,
        content: content,
        targetLanguage: t.targetLanguage || language,
        translatedContent: t.translatedContent || content,
        // S'assurer que toutes les nouvelles données sont préservées
        id: t.id, // ID de la traduction en base
        translationModel: t.translationModel || t.model, // Modèle utilisé
        cacheKey: t.cacheKey, // Clé de cache
        cached: t.cached, // Statut de cache
        confidenceScore: t.confidenceScore || t.confidence, // Score de confiance
        createdAt: t.createdAt, // Date de création
        sourceLanguage: t.sourceLanguage // Langue source
      };
    }).filter(t => {
      const hasLanguage = !!(t.language || t.targetLanguage);
      const hasContent = !!(t.content || t.translatedContent);
      
      if (!hasLanguage || !hasContent) {
        console.warn('🚫 Traduction filtrée (données manquantes):', {
          messageId: message.id,
          hasLanguage,
          hasContent,
          translation: t
        });
      }
      
      return hasLanguage && hasContent;
    });

    // Debug: Vérifier les traductions normalisées
    if (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_DEBUG_MESSAGES === 'true') {
      console.log(`🔍 [BubbleMessage] Message ${message.id} - traductions normalisées:`, {
        rawCount: message.translations?.length || 0,
        normalizedCount: normalized.length,
        normalizedTranslations: normalized
      });
    }

    return normalized;
  }, [message.translations, message.id]);

  // Détecter les nouvelles traductions et mettre à jour le compteur
  useEffect(() => {
    const currentTranslationCount = normalizedTranslations.length;
    const currentTranslationIds = new Set(normalizedTranslations.map(t => t.id || `${t.language}-${t.cacheKey}`));
    
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
      
      // 🔄 Déclencher l'animation de scintillement pour la traduction en cours
      translationStatus.setCompleted(undefined, 0.9);
      
      // Log pour déboguer la détection de nouvelles traductions
      if (process.env.NODE_ENV === 'development') {
        console.log(`🆕 [BubbleMessage] Nouvelles traductions détectées:`, {
          messageId: message.id,
          previousCount: lastTranslationCount,
          currentCount: currentTranslationCount,
          newTranslations: newTranslations,
          messageContent: message.content?.substring(0, 30) + '...',
          normalizedTranslations: normalizedTranslations.map(t => ({
            id: t.id,
            language: t.language,
            hasContent: !!t.content,
            cacheKey: t.cacheKey
          })),
          translationIds: Array.from(currentTranslationIds)
        });
      }

      // 🎉 Afficher un toast pour chaque nouvelle traduction
      normalizedTranslations.forEach(translation => {
        const translationKey = translation.id || `${translation.language}-${translation.cacheKey}`;
        
        // Vérifier si cette traduction est nouvelle (pas encore vue)
        if (!seenTranslations.has(translationKey)) {
          const languageFlag = SUPPORTED_LANGUAGES.find(lang => lang.code === translation.language)?.flag || '🌐';
          const languageName = SUPPORTED_LANGUAGES.find(lang => lang.code === translation.language)?.name || translation.language;
          const modelName = translation.translationModel || 'basic';
          const translatedText = translation.content?.substring(0, 100) || '';
          const confidence = translation.confidenceScore || 0.9;
          
          // Afficher le toast
          toast.success(
            `${languageFlag} Nouvelle traduction ${languageName}`,
            {
              description: `${translatedText}${translatedText.length > 100 ? '...' : ''}\n\nModèle: ${modelName} • Confiance: ${Math.round(confidence * 100)}%`,
              duration: 4000,
              action: {
                label: "Voir",
                onClick: () => {
                  setCurrentDisplayLanguage(translation.language);
                  setIsTranslationPopoverOpen(false);
                }
              }
            }
          );

          // Marquer cette traduction comme vue
          setSeenTranslations(prev => new Set([...prev, translationKey]));
        }
      });
      
      // ✨ Afficher l'indicateur de nouvelles traductions (icône scintillante + pastille orange)
      setShowNewTranslationsIndicator(true);
      
      // 🌟 Afficher l'indicateur "traduction arrivée" temporaire
      setShowTranslationArrivedIndicator(true);
      
      // Programmer la disparition de l'indicateur "traduction arrivée" après 3 secondes
      const translationArrivedTimer = setTimeout(() => {
        setShowTranslationArrivedIndicator(false);
        if (process.env.NODE_ENV === 'development') {
          console.log(`📥 [BubbleMessage] Fin de l'indicateur traduction arrivée pour message ${message.id}`);
        }
      }, 3000);
      
      // Programmer la disparition de l'indicateur après 8 secondes
      const timer = setTimeout(() => {
        setShowNewTranslationsIndicator(false);
        if (process.env.NODE_ENV === 'development') {
          console.log(`⏰ [BubbleMessage] Fin de l'animation pour message ${message.id}`);
        }
      }, 8000);
      
      // Nettoyer les timers si le composant se démonte
      return () => {
        clearTimeout(timer);
        clearTimeout(translationArrivedTimer);
      };
    }
  }, [normalizedTranslations, lastTranslationCount, message.id, translationStatus]);
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

  // Cache pour éviter les warnings répétés
  const [loggedWarnings, setLoggedWarnings] = useState<Set<string>>(new Set());

  const getLanguageInfo = (langCode: string | undefined) => {
    // Validation robuste avec fallback
    if (!langCode || langCode.trim() === '') {
      const warningKey = `no-lang-${message.id}`;
      if (!loggedWarnings.has(warningKey)) {
        console.warn('⚠️ Code de langue vide détecté, utilisation du fallback français', { 
          langCode, 
          messageId: message.id,
          messageContent: message.content?.substring(0, 50) + '...',
          availableTranslations: normalizedTranslations.length,
          translationLanguages: normalizedTranslations.map(t => t.targetLanguage)
        });
        setLoggedWarnings(prev => new Set(prev).add(warningKey));
      }
      
      // Fallback vers le français par défaut
      return {
        code: 'fr',
        name: 'Français',
        flag: '🇫🇷'
      };
    }
    
    const found = SUPPORTED_LANGUAGES.find(lang => lang.code === langCode);
    if (found) return found;
    
    // Si la langue n'est pas trouvée, c'est un problème mais pas critique
    const warningKey = `unsupported-lang-${message.id}-${langCode}`;
    if (!loggedWarnings.has(warningKey)) {
      console.warn('⚠️ Langue non supportée détectée:', langCode, 'pour le message:', message.id);
      setLoggedWarnings(prev => new Set(prev).add(warningKey));
    }
    
    return {
      code: langCode,
      name: langCode.toUpperCase(),
      flag: '🌐'
    };
  };

  // Auto-transition vers la langue système dès qu'elle est disponible
  useEffect(() => {
    const systemLanguageTranslation = normalizedTranslations.find((t: any) => 
      (t?.language || t?.targetLanguage) === currentUser.systemLanguage
    );
    
    const originalLang = message.originalLanguage || 'fr';
    
    console.log(`🔄 [AUTO-TRANSITION] Message ${message.id}:`, {
      originalLang,
      userSystemLanguage: currentUser.systemLanguage,
      currentDisplayLanguage,
      foundSystemTranslation: !!systemLanguageTranslation,
      systemTranslationContent: systemLanguageTranslation?.content || systemLanguageTranslation?.translatedContent,
      willAutoTransition: originalLang !== currentUser.systemLanguage && systemLanguageTranslation
    });
    
    if (originalLang !== currentUser.systemLanguage && systemLanguageTranslation) {
      console.log(`✅ [AUTO-TRANSITION] Basculement vers ${currentUser.systemLanguage} pour le message ${message.id}`);
      setCurrentDisplayLanguage(currentUser.systemLanguage);
    }
  }, [normalizedTranslations, currentUser.systemLanguage, message.originalLanguage, currentDisplayLanguage, message.id]);

  // Réinitialiser l'état de traduction forcée quand les traductions sont mises à jour
  useEffect(() => {
    if (hasPendingForcedTranslation && normalizedTranslations.length > 0) {
      setHasPendingForcedTranslation(false);
    }
  }, [normalizedTranslations, hasPendingForcedTranslation]);

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

  // 🎯 EFFECT SPÉCIAL POUR TRACER LES CHANGEMENTS DU BADGE DE TRADUCTIONS
  useEffect(() => {
    const originalLang = message.originalLanguage || 'fr';
    const isDisplayingOriginal = currentDisplayLanguage === originalLang;
    const isRead = isMessageReadByCurrentUser();
    
    // Calculer le nombre de traductions alternatives disponibles
    let availableAlternativeTranslations = 0;
    if (isDisplayingOriginal) {
      // Si on affiche l'original, compter toutes les traductions disponibles
      availableAlternativeTranslations = normalizedTranslations.filter(t => 
        (t.language || t.targetLanguage) !== originalLang
      ).length;
    } else {
      // Si on affiche une traduction, compter les autres traductions + l'original
      availableAlternativeTranslations = normalizedTranslations.filter(t => 
        (t.language || t.targetLanguage) !== currentDisplayLanguage
      ).length + 1; // +1 pour l'original
    }
    
    // Le badge ne s'affiche que si :
    // 1. Le message n'est pas lu ET il y a des traductions alternatives
    // 2. Ou s'il y a de nouvelles traductions à signaler
    const calculatedShouldShowTranslationBadge = (!isRead && availableAlternativeTranslations > 0) || showNewTranslationsIndicator;
    const calculatedTotalTranslationBadgeCount = !isRead ? availableAlternativeTranslations : (showNewTranslationsIndicator ? newTranslationsCount : 0);
    
    // Mettre à jour les états
    setShouldShowTranslationBadge(calculatedShouldShowTranslationBadge);
    setTotalTranslationBadgeCount(calculatedTotalTranslationBadgeCount);
    
    console.group(`🏷️ [BUBBLE-MESSAGE] BADGE DE TRADUCTIONS - Message ${message.id}`);
    console.log(`📊 État actuel du badge:`, {
      messageId: message.id,
      messageContent: message.content.substring(0, 50) + '...',
      // Langues
      originalLang: originalLang,
      currentDisplayLanguage: currentDisplayLanguage,
      isDisplayingOriginal: isDisplayingOriginal,
      // Compteurs
      totalTranslations: normalizedTranslations.length,
      availableAlternativeTranslations: availableAlternativeTranslations,
      newTranslationsCount: newTranslationsCount,
      lastTranslationCount: lastTranslationCount,
      // États boolean
      isRead: isRead,
      showNewTranslationsIndicator: showNewTranslationsIndicator,
      shouldShowTranslationBadge: calculatedShouldShowTranslationBadge,
      // Badge final
      totalTranslationBadgeCount: calculatedTotalTranslationBadgeCount,
      willShowBadge: calculatedShouldShowTranslationBadge && calculatedTotalTranslationBadgeCount > 0
    });
    
    console.log(`🌐 Traductions disponibles:`, 
      normalizedTranslations.map(t => `${t.language || t.targetLanguage}: "${(t.content || t.translatedContent)?.substring(0, 30)}..." (${t.translationModel})`)
    );
    
    if (calculatedShouldShowTranslationBadge && calculatedTotalTranslationBadgeCount > 0) {
      console.log(`✅ [BUBBLE-MESSAGE] Badge sera affiché avec le nombre: ${calculatedTotalTranslationBadgeCount}`);
    } else {
      console.log(`❌ [BUBBLE-MESSAGE] Badge ne sera PAS affiché`, {
        shouldShowTranslationBadge: calculatedShouldShowTranslationBadge,
        totalTranslationBadgeCount: calculatedTotalTranslationBadgeCount
      });
    }
    
    console.groupEnd();
  }, [normalizedTranslations, newTranslationsCount, lastTranslationCount, showNewTranslationsIndicator, message.id, message.content, currentDisplayLanguage, message.originalLanguage]);

  const getCurrentContent = () => {
    const originalLang = message.originalLanguage || 'fr';
    
    // Si on affiche la langue originale, retourner le contenu original
    if (currentDisplayLanguage === originalLang) {
      return message.originalContent || message.content;
    }
    
    // Chercher la traduction pour la langue d'affichage actuelle
    const translation = normalizedTranslations.find((t: any) => 
      (t?.language || t?.targetLanguage) === currentDisplayLanguage
    );
    
    return (translation as any)?.content || translation?.translatedContent || message.originalContent || message.content;
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

  // Obtenir les langues manquantes (supportées mais pas traduites) - mémorisé
  const getMissingLanguages = useCallback(() => {
    const originalLang = message.originalLanguage || 'fr';
    
    // Collecter toutes les langues déjà traduites (support des deux formats)
    const translatedLanguages = new Set([
      originalLang,
      ...normalizedTranslations.map((t: any) => {
        // Support des deux formats : nouveau (language) et ancien (targetLanguage)
        return t?.language || t?.targetLanguage;
      }).filter(Boolean) // Filtrer les valeurs undefined/null
    ]);
    
    return SUPPORTED_LANGUAGES.filter(lang => !translatedLanguages.has(lang.code));
  }, [message.originalLanguage, normalizedTranslations]);

  // Obtenir les traductions disponibles (pour affichage du badge) - mémorisé
  const getAvailableTranslations = useCallback(() => {
    // Utiliser les traductions normalisées (déjà filtrées)
    const availableTranslations = normalizedTranslations;
    
    // Debug: Vérifier les traductions dans BubbleMessage (conditionné)
    if (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_DEBUG_MESSAGES === 'true') {
      console.log(`🔍 [BubbleMessage] Message ${message.id} - traductions:`, {
        totalTranslations: message.translations?.length || 0,
        normalizedTranslations: normalizedTranslations.length,
        availableTranslations: availableTranslations.length,
        rawTranslations: message.translations,
        normalizedData: normalizedTranslations,
        availableData: availableTranslations,
        backendFormat: (message.translations as any[])?.filter(t => t?.targetLanguage)?.length || 0,
        frontendFormat: (message.translations as any[])?.filter(t => t?.language)?.length || 0,
        missingLanguages: SUPPORTED_LANGUAGES.filter(lang => {
          const originalLang = message.originalLanguage || 'fr';
          const translatedLanguages = new Set([
            originalLang,
            ...normalizedTranslations.map((t: any) => t?.language || t?.targetLanguage).filter(Boolean)
          ]);
          return !translatedLanguages.has(lang.code);
        }).length
      });
    }
    
    return availableTranslations;
  }, [normalizedTranslations, message.translations, message.id]);

  // Vérifier si des traductions sont disponibles (mémorisé)
  const hasAvailableTranslations = useMemo(() => {
    const availableTranslations = getAvailableTranslations();
    return availableTranslations.length > 0;
  }, [getAvailableTranslations]);

  const handleForceTranslation = async (targetLanguage: string) => {
    setIsTranslationPopoverOpen(false);
    setTranslationFilter(''); // Réinitialiser le filtre
    setHasPendingForcedTranslation(true); // Marquer qu'une traduction forcée est en attente
    
    // ✨ Démarrer l'animation de traduction
    translationStatus.startTranslation();
    setTimeout(() => translationStatus.setTranslating(), 100); // Délai pour l'animation
    
    if (onForceTranslation) {
      try {
        await onForceTranslation(message.id, targetLanguage);
        
        // ✅ Marquer la traduction comme complétée
        translationStatus.setCompleted(undefined, 0.9);
        
        // Le toast de succès est géré dans bubble-stream-page.tsx, pas ici
      } catch (error) {
        // ❌ Marquer la traduction comme échouée
        translationStatus.setErrorStatus('Erreur lors de la traduction');
        toast.error(t('toasts.messages.translationError'));
      } finally {
        setHasPendingForcedTranslation(false); // Réinitialiser l'état
        
        // Reset du statut après 3 secondes
        setTimeout(() => translationStatus.reset(), 3000);
      }
    } else {
      setHasPendingForcedTranslation(false); // Réinitialiser l'état
      translationStatus.reset();
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
    
    // ✨ Démarrer l'animation de traduction pour l'upgrade
    translationStatus.startTranslation();
    setTimeout(() => translationStatus.setTranslating(), 100);
    
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
        
        // ✅ Marquer la traduction comme complétée
        translationStatus.setCompleted(undefined, 0.95); // Confiance plus élevée pour les modèles premium
        
        // Reset du statut après 3 secondes
        setTimeout(() => translationStatus.reset(), 3000);
        
      } catch (error) {
        // ❌ Marquer la traduction comme échouée
        translationStatus.setErrorStatus('Erreur lors de la demande d\'upgrade');
        toast.error('Erreur lors de la demande d\'upgrade');
        
        // Reset du statut après 5 secondes pour les erreurs
        setTimeout(() => translationStatus.reset(), 5000);
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
  const availableVersions = useMemo(() => {
    const originalLang = message.originalLanguage || 'fr';
    const versions = [
      {
        language: originalLang,
        content: message.originalContent || message.content,
        isOriginal: true,
        confidence: 1,
        model: 'original'
      }
    ];
    
    // Ajouter les traductions disponibles (normalisées)
    normalizedTranslations.forEach((t: any) => {
      // Les traductions sont déjà normalisées et filtrées
      const language = t.language;
      const content = t.content;
      
      if (language && content) {
        versions.push({
          language: language,
          content: content,
          isOriginal: false,
          confidence: (t.confidence || t.confidenceScore || 0.9),
          model: t.model || t.translationModel || 'basic'
        });
        
        if (process.env.NODE_ENV === 'development') {
          console.log('✅ Traduction ajoutée:', {
            messageId: message.id,
            translationId: t.id, // ID de la traduction
            language: language,
            content: content.substring(0, 30) + '...',
            confidence: t.confidence || t.confidenceScore || 0.9,
            model: t.model || t.translationModel || 'basic',
            cacheKey: t.cacheKey, // Clé de cache
            cached: t.cached, // Statut de cache
            createdAt: t.createdAt, // Date de création
            sourceLanguage: t.sourceLanguage // Langue source
          });
        }
      } else {
        // Log pour debug si une traduction est malformée
        if (process.env.NODE_ENV === 'development') {
          console.warn('⚠️ Traduction malformée ignorée:', {
            messageId: message.id,
            translation: t,
            hasLanguage: !!language,
            hasContent: !!content,
            allProps: Object.keys(t || {})
          });
        }
      }
    });
    
    return versions;
  }, [message.originalLanguage, message.originalContent, message.content, normalizedTranslations]);

  const isTranslated = currentDisplayLanguage !== (message.originalLanguage || 'fr');
  
  // Debug: Vérifier les versions disponibles pour le popover (conditionné)
  if (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_DEBUG_MESSAGES === 'true') {
    console.log(`🎭 [BubbleMessage] Message ${message.id} - versions popover:`, {
      totalVersions: availableVersions.length,
      originalLanguage: message.originalLanguage,
      currentDisplayLanguage,
      versions: availableVersions.map(v => ({
        language: (v as any).language,
        isOriginal: (v as any).isOriginal,
        hasContent: !!(v as any).content,
        status: (v as any).status,
        model: (v as any).model,
        confidence: (v as any).confidence,
        id: (v as any).id // ID de la traduction
      })),
      // Vérifier les données de traduction normalisées
      normalizedTranslations: normalizedTranslations.map(t => ({
        id: t.id,
        language: t.language,
        targetLanguage: t.targetLanguage,
        translationModel: t.translationModel,
        confidenceScore: t.confidenceScore,
        cacheKey: t.cacheKey,
        cached: t.cached,
        createdAt: t.createdAt,
        sourceLanguage: t.sourceLanguage
      }))
    });
  }
  
  // Permettre à l'émetteur de voir les traductions de son propre message
  const canSeeTranslations = availableVersions.length > 1;  

  // Améliorer la visibilité de l'icône globe avec un badge
  const translationCount = availableVersions.length - 1; // Exclure l'original
  
  // Calculer les valeurs dérivées pour le badge (les états sont mis à jour dans useEffect)
  const isRead = isMessageReadByCurrentUser();
  const forceShowBadge = !isRead;
  const finalShouldShowBadge = shouldShowTranslationBadge || forceShowBadge;
  const finalBadgeCount = forceShowBadge ? 1 : totalTranslationBadgeCount;


  // Filtrer les versions disponibles selon le filtre de recherche
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
          key={messageKey} // Forcer le re-render avec la clé basée sur les traductions
          ref={messageRef}
          className={cn(
            "bubble-message relative transition-all duration-300 hover:shadow-lg mx-2",
            isOwnMessage ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200',
            isUsedLanguage && 'ring-2 ring-green-200 ring-opacity-50',
            isMobile && 'bubble-message-mobile'
          )}
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
        <CardContent className={cn("p-4", isMobile && "py-2 px-4")}>
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center space-x-3">
              <Avatar className={cn(isMobile ? "mobile-avatar" : "h-10 w-10")}>
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
                  <span className={cn("font-medium text-gray-900 participant-name", isMobile && "mobile-text-sm")}>
                    @{message.sender?.username}
                  </span>
                  {message.anonymousSenderId && (
                    <Ghost className="h-4 w-4 text-gray-400" />
                  )}
                  <span className="text-gray-400">•</span>
                  <span className={cn("text-gray-500 flex items-center timestamp", isMobile ? "mobile-text-xs" : "text-sm")}>
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
            {/* Indicateur de statut de traduction amélioré */}
            {(translationStatus.status !== 'idle' || (isTranslating && isTranslating(message.id, userLanguage))) && (
              <TranslationStatusIndicator
                status={translationStatus.status !== 'idle' ? translationStatus.status : 'translating'}
                sourceLanguage={message.originalLanguage}
                targetLanguage={userLanguage}
                translationTime={translationStatus.translationTime}
                confidence={translationStatus.confidence}
                error={translationStatus.error}
                size="sm"
                showDetails={!isMobile}
                onRetry={() => {
                  translationStatus.reset();
                  if (onForceTranslation) {
                    handleForceTranslation(userLanguage);
                  }
                }}
              />
            )}
            
            {/* Indicateur "Traduction arrivée" temporaire */}
            {showTranslationArrivedIndicator && (
              <div className="flex items-center space-x-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs animate-pulse">
                <CheckCircle2 className="h-3 w-3" />
                <span className="font-medium">Traduction reçue</span>
              </div>
            )}
            
            {/* Langue originale du message uniquement */}
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
                <TooltipContent>{t('originalLanguage')}: {getLanguageInfo(message.originalLanguage || 'fr').name} - {t('clickToViewOriginal')}</TooltipContent>
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
                  <p className={cn("text-gray-900 leading-relaxed whitespace-pre-wrap flex-1", isMobile ? "mobile-text-base" : "text-base")}>
                    {getCurrentContent()}
                  </p>
                  {/* Indicateur de traductions disponibles */}
                  {shouldShowTranslationBadge && totalTranslationBadgeCount > 0 && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="ml-2 mt-1 flex items-center space-x-1">
                          <div className="flex -space-x-1">
                            {getAvailableTranslations().slice(0, 3).map((translation, index) => (
                              <div
                                key={`${message.id}-translation-${translation.targetLanguage || translation.language}-${index}`}
                                className="w-4 h-4 rounded-full border border-white bg-blue-100 flex items-center justify-center text-xs font-medium text-blue-600"
                                title={`${getLanguageInfo(translation.targetLanguage || translation.language).name}: ${(translation.translatedContent || translation.content)?.substring(0, 20)}...`}
                              >
                                {getLanguageInfo(translation.targetLanguage || translation.language).flag}
                              </div>
                            ))}
                          </div>
                          {totalTranslationBadgeCount > 3 && (
                            <span className="text-xs text-gray-500 font-medium">
                              +{totalTranslationBadgeCount - 3}
                            </span>
                          )}
                          {/* Badge avec nombre de traductions */}
                          <div className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold">
                            {totalTranslationBadgeCount}
                          </div>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <div className="text-xs">
                          <div className="font-medium mb-1">{t('availableTranslations')}:</div>
                          {getAvailableTranslations().map((translation, index) => (
                            <div key={`${message.id}-tooltip-translation-${translation.targetLanguage || translation.language}-${index}`} className="flex items-center space-x-1">
                              <span>{getLanguageInfo(translation.targetLanguage || translation.language).flag}</span>
                              <span>{getLanguageInfo(translation.targetLanguage || translation.language).name}</span>
                            </div>
                          ))}
                          {/* Afficher l'original si on affiche une traduction */}
                          {currentDisplayLanguage !== (message.originalLanguage || 'fr') && (
                            <div className="flex items-center space-x-1 border-t pt-1 mt-1">
                              <span>{getLanguageInfo(message.originalLanguage || 'fr').flag}</span>
                              <span>{getLanguageInfo(message.originalLanguage || 'fr').name} (Original)</span>
                            </div>
                          )}
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
                    <Languages className={`h-4 w-4 transition-all duration-300 ${
                      // 🔄 Animation de scintillement pendant la traduction avec opacity 0.1 à 1.0
                      (hasPendingForcedTranslation || (isTranslating && isTranslating(message.id, userLanguage))) 
                        ? 'text-blue-600 drop-shadow-lg animate-pulse opacity-90' 
                        // ✨ Scintillement pour nouvelles traductions (opacity cycling)
                        : showNewTranslationsIndicator 
                          ? 'text-orange-500 drop-shadow-lg animate-ping opacity-80'
                          // État normal avec couleur selon disponibilité des traductions
                          : shouldShowTranslationBadge && totalTranslationBadgeCount > 0
                            ? 'text-green-600 opacity-100' 
                            : hasAvailableTranslations
                              ? 'text-blue-500 opacity-60'  // Bleu pour les traductions déjà affichées
                              : 'text-gray-400 opacity-70'
                    }`} 
                    style={
                      (hasPendingForcedTranslation || (isTranslating && isTranslating(message.id, userLanguage))) 
                        ? {
                            animation: 'translation-shimmer 1.5s ease-in-out infinite'
                          }
                        : showNewTranslationsIndicator 
                          ? {
                              animation: 'new-translation-glow 2s ease-in-out infinite'
                            }
                          : undefined
                    }
                    />
                    
                    {/* Pastille de nombre - utilise la logique calculée */}
                    {shouldShowTranslationBadge && totalTranslationBadgeCount > 0 && (
                      <span className={`absolute -top-1 -right-1 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-medium transition-all duration-300 ${
                        showNewTranslationsIndicator 
                          ? 'bg-orange-500 animate-bounce scale-110' // Orange animé pour les nouvelles traductions
                          : 'bg-green-600' // Vert pour l'état normal
                      }`}>
                        {totalTranslationBadgeCount}
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
                          const versionAny = version as any;
                          const langInfo = getLanguageInfo(versionAny.language);
                          const isCurrentlyDisplayed = currentDisplayLanguage === versionAny.language;
                          
                          return (
                            <button
                              key={`${message.id}-${versionAny.language}-${versionAny.timestamp?.getTime() || Date.now()}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleLanguageSwitch(versionAny.language);
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
                                  {versionAny.isOriginal && (
                                    <span className="text-xs text-gray-500 bg-gray-100/60 px-1.5 py-0.5 rounded">
                                      {t('original')}
                                    </span>
                                  )}
                                  {isCurrentlyDisplayed && (
                                    <CheckCircle2 className="h-3.5 w-3.5 text-blue-600" />
                                  )}
                                </div>
                                {!versionAny.isOriginal && (
                                  <div className="flex items-center space-x-1">
                                    {/* Icône d'upgrade vers tier supérieur */}
                                    {getNextTier(versionAny.model || 'basic') && (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <div
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleUpgradeTier(versionAny.language, versionAny.model || 'basic');
                                            }}
                                            className="p-1 rounded hover:bg-green-100 text-green-600 hover:text-green-700 transition-colors cursor-pointer"
                                          >
                                            <ArrowUp className="h-3 w-3" />
                                          </div>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          {t('improveTranslationQuality')} (modèle {versionAny.model || 'basic'} → {getNextTier(versionAny.model || 'basic')})
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
                                    {/* Afficher l'ID de traduction en mode debug */}
                                    {process.env.NODE_ENV === 'development' && versionAny.id && (
                                      <span className="text-xs text-purple-600 bg-purple-100/60 px-1.5 py-0.5 rounded" title={`ID: ${versionAny.id}`}>
                                        ID
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                              
                              <p className="text-sm text-gray-600 leading-relaxed line-clamp-2 group-hover:text-gray-800">
                                {versionAny.content}
                              </p>
                              
                              {/* Indicateur de qualité discret */}
                              {!version.isOriginal && (
                                <div className="mt-1.5 flex items-center space-x-1">
                                  <div className="flex-1 bg-gray-200/40 rounded-full h-0.5">
                                    <div 
                                      className="bg-green-400 h-0.5 rounded-full transition-all duration-300"
                                      style={{ width: `${Math.round((version.confidence || 0.9) * 100)}%` }}
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
                  
                    {(isTranslating && isTranslating(message.id, userLanguage)) && (
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

export const BubbleMessage = memo(BubbleMessageInner, (prevProps, nextProps) => {
  // Re-rendre si les traductions ont changé
  const prevTranslationsKey = prevProps.message.translations?.map((t: any) => 
    `${t.targetLanguage || t.language}-${(t.translatedContent || t.content)?.length || 0}-${t.id || ''}`
  ).join('|') || '';
  
  const nextTranslationsKey = nextProps.message.translations?.map((t: any) => 
    `${t.targetLanguage || t.language}-${(t.translatedContent || t.content)?.length || 0}-${t.id || ''}`
  ).join('|') || '';
  
  const shouldUpdate = prevTranslationsKey !== nextTranslationsKey || 
                      prevProps.message.translations?.length !== nextProps.message.translations?.length ||
                      prevProps.message.id !== nextProps.message.id;
  
  if (process.env.NODE_ENV === 'development' && shouldUpdate) {
    console.log(`🔄 [BubbleMessage-Memo] Re-rendering ${nextProps.message.id} due to translation changes`);
  }
  
  return !shouldUpdate; // true = skip re-render, false = re-render
});
BubbleMessage.displayName = 'BubbleMessage';
