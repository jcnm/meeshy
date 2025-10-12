'use client';

import { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUser } from '@/context/UnifiedProvider';
import { useMessaging } from '@/hooks/use-messaging';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useTranslations } from '@/hooks/useTranslations';
import { cn } from '@/lib/utils';
import type {
  Conversation,
  Message,
  MessageWithTranslations,
  TranslationData,
  SocketIOUser as User,
  ThreadMember
} from '@shared/types';
import { conversationsService } from '@/services/conversations.service';
import { CreateConversationModal } from './create-conversation-modal';
import { ConversationDetailsSidebar } from './conversation-details-sidebar';
import { CreateLinkModalV2 as CreateLinkModal } from './create-link-modal';
import { translationService } from '@/services/translation.service';
import { cleanTranslationOutput } from '@/utils/translation-cleaner';
import { createDefaultUser } from '@/utils/user-adapter';
import { detectAll } from 'tinyld';
import { useMessageLoader } from '@/hooks/use-message-loader';
import { useConversationMessages } from '@/hooks/use-conversation-messages';
import { useMessageTranslations } from '@/hooks/use-message-translations';
import { useTranslation } from '@/hooks/use-translation';
import { messageService } from '@/services/message.service';
import { UserRoleEnum } from '@shared/types';

// Import des nouveaux composants
import { ConversationList } from './ConversationList';
import { ConversationHeader } from './ConversationHeader';
import { ConversationMessages } from './ConversationMessages';
import { ConversationComposer } from './ConversationComposer';
import { ConversationEmptyState } from './ConversationEmptyState';

interface ConversationLayoutResponsiveProps {
  selectedConversationId?: string;
}

export function ConversationLayoutResponsive({ selectedConversationId }: ConversationLayoutResponsiveProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const conversationListRef = useRef<HTMLDivElement>(null);
  const scrollPositionRef = useRef<number>(0);
  const { user, isAuthChecking } = useUser();
  const { t } = useTranslations('conversationLayout');
  const { t: tSearch } = useTranslations('conversationSearch');

  // Calculer usedLanguages AVANT tout return conditionnel (OBLIGATOIRE pour les règles des hooks)
  const usedLanguages = useMemo(() => {
    if (!user) return [];
    return [
      user.regionalLanguage,
      user.customDestinationLanguage
    ].filter((lang): lang is string => Boolean(lang)).filter(lang => lang !== user.systemLanguage);
  }, [user?.regionalLanguage, user?.customDestinationLanguage, user?.systemLanguage]);

  // Si on est en train de vérifier l'authentification, afficher un loader
  if (isAuthChecking) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">{t('authChecking')}</p>
        </div>
      </div>
    );
  }

  // Si pas d'utilisateur après vérification, ne rien afficher
  if (!user) {
    return null;
  }

  // Fonction utilitaire pour éviter les doublons et filtrer les conversations invalides
  const sanitizeConversations = useCallback((conversations: Conversation[]): Conversation[] => {
    // Filtrer les conversations invalides et supprimer les doublons
    const validConversations = conversations.filter(conv => conv && conv.id);
    const uniqueConversations = validConversations.reduce((acc: Conversation[], current: Conversation) => {
      const existingIndex = acc.findIndex(conv => conv.id === current.id);
      if (existingIndex === -1) {
        acc.push(current);
      } else {
        // Garder la version la plus récente (basée sur updatedAt)
        if (!acc[existingIndex].updatedAt || 
            (current.updatedAt && new Date(current.updatedAt) > new Date(acc[existingIndex].updatedAt))) {
          acc[existingIndex] = current;
        }
      }
      return acc;
    }, []);
    
    return uniqueConversations;
  }, []);

  // États principaux
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [conversationParticipants, setConversationParticipants] = useState<ThreadMember[]>([]);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('fr');
  const [isLoading, setIsLoading] = useState(true);

  // États UI responsive
  const [showConversationList, setShowConversationList] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  // États modaux
  const [isCreateConversationModalOpen, setIsCreateConversationModalOpen] = useState(false);
  const [isCreateLinkModalOpen, setIsCreateLinkModalOpen] = useState(false);
  const [isDetailsSidebarOpen, setIsDetailsSidebarOpen] = useState(false);

  // Flag pour éviter de recharger les conversations juste après en avoir créé une
  const [justCreatedConversation, setJustCreatedConversation] = useState<string | null>(null);

  // États typing (centralisés)
  interface TypingUserState {
    userId: string;
    username: string;
    conversationId: string;
    timestamp: number;
  }
  const [typingUsers, setTypingUsers] = useState<TypingUserState[]>([]);

  // Helper: mise à jour idempotente des conversations pour éviter des re-renders inutiles
  const setConversationsIfChanged = useCallback((updater: Conversation[] | ((prev: Conversation[]) => Conversation[])) => {
    setConversations((prev) => {
      const next = typeof updater === 'function' ? (updater as (p: Conversation[]) => Conversation[])(prev) : updater;
      if (prev === next) return prev;
      if (prev.length !== next.length) return next;
      // Comparaison superficielle par id et updatedAt
      const same = prev.every((p, i) => p.id === next[i].id && String(p.updatedAt) === String(next[i].updatedAt));
      return same ? prev : next;
    });
  }, []);

  // Ref pour le conteneur des messages (créé une seule fois)
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Hook pour la pagination infinie des messages (scroll vers le bas pour charger plus récents)
  const {
    messages,
    isLoading: isLoadingMessages,
    isLoadingMore,
    hasMore,
    error: messagesError,
    loadMore,
    refresh: refreshMessages,
    clearMessages,
    addMessage,
    updateMessage: updateMessageTranslations,
    removeMessage
  } = useConversationMessages(selectedConversation?.id || null, user!, {
    limit: 20,
    enabled: !!selectedConversation?.id,
    threshold: 100,
    containerRef: messagesContainerRef
  });

  // Hook pour la gestion des traductions
  const {
    processMessageWithTranslations,
    getPreferredLanguageContent,
    getUserLanguagePreferences,
    resolveUserPreferredLanguage,
    shouldRequestTranslation,
    getRequiredTranslations
  } = useMessageTranslations({ currentUser: user! });

  // État pour les traductions en cours
  const [translatingMessages, setTranslatingMessages] = useState<Map<string, Set<string>>>(new Map());
  const [translatedMessages, setTranslatedMessages] = useState<MessageWithTranslations[]>([]);

  // Fonctions pour gérer l'état des traductions en cours
  const addTranslatingState = useCallback((messageId: string, targetLanguage: string) => {
    setTranslatingMessages(prev => {
      const newMap = new Map(prev);
      if (!newMap.has(messageId)) {
        newMap.set(messageId, new Set());
      }
      newMap.get(messageId)!.add(targetLanguage);
      return newMap;
    });
  }, []);

  const removeTranslatingState = useCallback((messageId: string, targetLanguage: string) => {
    setTranslatingMessages(prev => {
      const newMap = new Map(prev);
      if (newMap.has(messageId)) {
        newMap.get(messageId)!.delete(targetLanguage);
        if (newMap.get(messageId)!.size === 0) {
          newMap.delete(messageId);
        }
      }
      return newMap;
    });
  }, []);

  const isTranslating = useCallback((messageId: string, targetLanguage: string) => {
    return translatingMessages.get(messageId)?.has(targetLanguage) || false;
  }, [translatingMessages]);

  // Fonction pour charger les messages (compatibilité avec l'ancien hook)
  const loadMessages = useCallback(async (conversationId: string, isNewConversation = false) => {
    // Toujours rafraîchir les messages lors du changement de conversation
    await refreshMessages();
  }, [refreshMessages]);

  // Hook pour les statistiques de traduction (intégré dans useTranslation)
  const { stats: translationStats, incrementTranslationCount } = useTranslation();

  // Fonctions pour gérer l'édition et la suppression des messages
  const handleEditMessage = useCallback(async (messageId: string, newContent: string) => {
    if (!selectedConversation?.id) return;
    
    try {
      await messageService.editMessage(selectedConversation.id, messageId, {
        content: newContent,
        originalLanguage: selectedLanguage
      });
      
      // Recharger les messages pour afficher la modification
      await loadMessages(selectedConversation.id, true);
    } catch (error) {
      console.error('Erreur lors de la modification du message:', error);
      throw error;
    }
  }, [selectedConversation?.id, selectedLanguage, loadMessages]);

  const handleDeleteMessage = useCallback(async (messageId: string) => {
    if (!selectedConversation?.id) return;
    
    try {
      await messageService.deleteMessage(selectedConversation.id, messageId);
      
      // Recharger les messages pour afficher la suppression
      await loadMessages(selectedConversation.id, true);
    } catch (error) {
      console.error('Erreur lors de la suppression du message:', error);
      throw error;
    }
  }, [selectedConversation?.id, loadMessages]);

  // Initialiser la langue sélectionnée avec la langue système de l'utilisateur
  useEffect(() => {
    if (user?.systemLanguage) {
      setSelectedLanguage(user.systemLanguage);
    }
  }, [user?.systemLanguage]);

  // Fonction pour gérer les événements de frappe avec résolution de noms
  const handleUserTyping = useCallback((userId: string, username: string, isTyping: boolean) => {
    if (userId === user?.id) return; // Ignorer nos propres événements de frappe
    
    // Rechercher l'utilisateur dans la liste des participants pour obtenir son vrai nom
    const participant = conversationParticipants.find(p => p.userId === userId);
    let displayName: string;
    
    if (participant?.user) {
      const userInfo = participant.user;
      if (userInfo.displayName) {
        displayName = userInfo.displayName;
      } else if (userInfo.firstName || userInfo.lastName) {
        displayName = `${userInfo.firstName || ''} ${userInfo.lastName || ''}`.trim();
      } else {
        displayName = userInfo.username;
      }
    } else if (username && username !== userId) {
      // Si le username fourni est différent de l'userId, l'utiliser
      displayName = username;
    } else {
      // Fallback : essayer de récupérer le nom depuis le localStorage pour les participants anonymes
      try {
        const anonymousParticipant = localStorage.getItem('anonymous_participant');
        if (anonymousParticipant) {
          const participantData = JSON.parse(anonymousParticipant);
          if (participantData.id === userId) {
            displayName = participantData.username || participantData.firstName || `Utilisateur ${userId.slice(-6)}`;
          } else {
            displayName = `Utilisateur ${userId.slice(-6)}`;
          }
        } else {
          displayName = `Utilisateur ${userId.slice(-6)}`;
        }
      } catch (error) {
        displayName = `Utilisateur ${userId.slice(-6)}`;
      }
    }
    
    console.log('[TYPING] Utilisateur en train de taper:', { userId, username, displayName, isTyping });
    
    // Mettre à jour l'état local de frappe (3s timeout géré ci-dessous)
    setTypingUsers(prev => {
      const now = Date.now();
      const filtered = prev.filter(u => !(u.userId === userId && u.conversationId === selectedConversation?.id));
      if (isTyping && selectedConversation?.id) {
        return [...filtered, { userId, username: displayName, conversationId: selectedConversation.id, timestamp: now }];
      }
      return filtered;
    });
  }, [user?.id, conversationParticipants, selectedConversation?.id]);

  // Nettoyage périodique des indicateurs de frappe
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setTypingUsers(prev => prev.filter(u => now - u.timestamp < 3000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Callbacks stabilisés pour éviter les re-renders en boucle
  const handleUserStatus = useCallback((userId: string, _username: string, isOnline: boolean) => {
    setConversationParticipants(prev => prev.map(p =>
      p.user.id === userId ? { ...p, user: { ...p.user, isOnline } } : p
    ));
  }, []);

  const handleConversationStats = useCallback((data: { conversationId: string; stats: any }) => {
    // si stats contiennent des participants, on peut les utiliser; sinon ignoré
  }, []);

  const handleConversationOnlineStats = useCallback((data: { conversationId: string; onlineUsers: Array<{ id: string }>; updatedAt: Date }) => {
    if (!selectedConversation?.id || data.conversationId !== selectedConversation.id) return;
    const onlineSet = new Set((data.onlineUsers || []).map(u => u.id));
    setConversationParticipants(prev => prev.map(p => ({
      ...p,
      user: { ...p.user, isOnline: onlineSet.has(p.user.id) }
    })));
  }, [selectedConversation?.id]);

  const handleConversationJoined = useCallback((data: { conversationId: string; participant: ThreadMember }) => {
    if (!selectedConversation?.id || data.conversationId !== selectedConversation.id) return;
    setConversationParticipants(prev => {
      const exists = prev.some(p => p.user.id === data.participant.user.id);
      if (exists) return prev;
      return [...prev, data.participant];
    });
  }, [selectedConversation?.id]);

  const handleConversationLeft = useCallback((data: { conversationId: string; userId: string }) => {
    if (!selectedConversation?.id || data.conversationId !== selectedConversation.id) return;
    setConversationParticipants(prev => prev.filter(p => p.user.id !== data.userId));
  }, [selectedConversation?.id]);

  const handleNewMessage = useCallback((message: Message) => {
    // Vérifier que le message appartient à la conversation active
    if (selectedConversation?.id && message.conversationId !== selectedConversation.id) {
      return;
    }

    // Ajouter le message en temps réel à la liste affichée
    const isNewMessage = addMessage(message);

    // Mettre à jour la conversation avec le dernier message (optimisé et idempotent)
    setConversationsIfChanged(prev => prev.map(
      (conv) => conv.id === message.conversationId
        ? { ...conv, lastMessage: message, updatedAt: new Date() }
        : conv
    ));
  }, [selectedConversation?.id, addMessage, setConversationsIfChanged]);

    const handleTranslation = useCallback((messageId: string, translations: any[]) => {
    console.log(`🔤 Traduction reçue pour message ${messageId}`);
    console.log('  - Nombre de traductions:', translations.length);
    
    // Créer un objet data compatible avec l'ancien format
    const data = {
      messageId,
      translations: translations || [],
      originalText: '', // Sera récupéré du message existant
      sourceLanguage: 'fr' // Sera récupéré du message existant
    };
    
    console.log(`  - Nombre de traductions: ${translations.length}`);
    console.log('  - Langues traduites:', translations.map((t: any) => `${t.targetLanguage}(${t.translationModel})`));
    console.log('  - Contenu original sera récupéré du message existant');

    updateMessageTranslations(messageId, existingMessage => {
      if (!existingMessage) {
        console.warn('  ❌ Message non trouvé pour les traductions:', messageId);
        return existingMessage;
      }
      
      console.log('  🔍 Message trouvé pour mise à jour:', {
        messageId: existingMessage.id,
        currentTranslationsCount: existingMessage.translations?.length || 0,
        newTranslationsCount: translations.length
      });
      
      console.log('  - Message existant trouvé:', existingMessage.content.substring(0, 50) + '...');
      console.log('  - Langue originale du message:', existingMessage.originalLanguage);
      console.log('  - Traductions existantes:', existingMessage.translations?.length || 0);
      
      // Déboguer chaque traduction existante
      if (existingMessage.translations && existingMessage.translations.length > 0) {
        console.log('  - Détail traductions existantes:');
        existingMessage.translations.forEach((t, idx) => {
          console.log(`    ${idx}: ${t.targetLanguage} = "${t.translatedContent?.substring(0, 30)}..." (${t.translationModel})`);
        });
      }
      
      // Déboguer chaque nouvelle traduction
      console.log('  - Détail nouvelles traductions:');
      translations.forEach((t: any, idx: number) => {
        console.log(`    ${idx}: ${t.targetLanguage} = "${t.translatedContent?.substring(0, 30)}..." (${t.translationModel})`);
        
        // ⚠️ DÉBOGAGE CRITIQUE: Vérifier si la traduction est identique au contenu original
        if (t.translatedContent === existingMessage.content) {
          console.error(`    ❌ PROBLÈME: Traduction ${t.targetLanguage} identique au contenu original!`);
          console.error(`    - Original: "${existingMessage.content}"`);
          console.error(`    - Traduit: "${t.translatedContent}"`);
          console.error(`    - Langue source: ${t.sourceLanguage || 'undefined'}`);
          console.error(`    - Langue cible: ${t.targetLanguage}`);
        }
        
        // Vérifier si la traduction est vide ou invalide
        if (!t.translatedContent || t.translatedContent.trim() === '') {
          console.error(`    ❌ PROBLÈME: Traduction ${t.targetLanguage} vide!`);
        }
      });

      // Fonction pour obtenir la priorité du modèle
      const getModelPriority = (model: string): number => {
        switch (model) {
          case 'premium': return 3;
          case 'medium': return 2;
          case 'basic': return 1;
          default: return 0;
        }
      };

      // Créer une structure temporaire pour collecter toutes les traductions
      interface TranslationWithModel {
        language: string;
        content: string;
        confidence: number;
        model: string;
        modelPriority: number;
        timestamp: Date;
        source: 'existing' | 'new';
      }

      const allTranslationsWithModel: TranslationWithModel[] = [];

      // Ajouter les traductions existantes avec leurs modèles
      if (existingMessage.translations) {
        existingMessage.translations.forEach(t => {
          if (t.targetLanguage && t.translatedContent) {
            allTranslationsWithModel.push({
              language: t.targetLanguage,
              content: t.translatedContent,
              confidence: t.confidenceScore || 0.9,
              model: t.translationModel || 'basic',
              modelPriority: getModelPriority(t.translationModel || 'basic'),
              timestamp: new Date(t.createdAt || Date.now()),
              source: 'existing'
            });
          }
        });
      }

      // Ajouter les nouvelles traductions avec leurs modèles
      translations.forEach((t: any) => {
        if (t.targetLanguage && t.translatedContent) {
          allTranslationsWithModel.push({
            language: t.targetLanguage,
            content: t.translatedContent,
            confidence: t.confidenceScore || 0.9,
            model: t.translationModel || 'basic',
            modelPriority: getModelPriority(t.translationModel || 'basic'),
            timestamp: new Date(t.createdAt || Date.now()),
            source: 'new'
          });
        }
      });

      console.log('  - Toutes les traductions collectées:');
      allTranslationsWithModel.forEach((t, idx) => {
        console.log(`    ${idx}: ${t.language} = "${t.content?.substring(0, 30)}..." (${t.model}, priorité:${t.modelPriority}, ${t.source})`);
        
        // ⚠️ DÉBOGAGE: Vérifier les contenus identiques au niveau de la collecte
        if (t.content === existingMessage.content) {
          console.error(`    ❌ ALERTE: Traduction collectée ${t.language} identique au message original!`);
        }
      });

      // Garder seulement la meilleure traduction par langue
      const bestTranslationsMap = new Map<string, TranslationWithModel>();
      
      allTranslationsWithModel.forEach(translation => {
        console.log(`  🔍 Traitement ${translation.language}: "${translation.content?.substring(0, 20)}..."`);
        
        const existing = bestTranslationsMap.get(translation.language);
        
        if (!existing) {
          // Première traduction pour cette langue
          bestTranslationsMap.set(translation.language, translation);
          console.log(`  ➕ Première traduction pour ${translation.language}: ${translation.model}`);
        } else if (translation.modelPriority > existing.modelPriority) {
          // Meilleur modèle trouvé
          bestTranslationsMap.set(translation.language, translation);
          console.log(`  ✅ Amélioration ${translation.language}: ${existing.model}(${existing.modelPriority}) → ${translation.model}(${translation.modelPriority})`);
        } else if (translation.modelPriority === existing.modelPriority && translation.source === 'new') {
          // Même modèle mais plus récent
          bestTranslationsMap.set(translation.language, translation);
          console.log(`  🔄 Mise à jour ${translation.language}: même modèle ${translation.model} mais plus récent`);
        } else {
          console.log(`  ⏭️ Ignoré ${translation.language}: modèle ${translation.model}(${translation.modelPriority}) <= ${existing.model}(${existing.modelPriority})`);
        }
      });

      // Créer les traductions finales au format MessageTranslation avec support des deux formats
      const finalTranslations = Array.from(bestTranslationsMap.values()).map(t => {
        // Chercher la traduction originale pour récupérer tous les champs
        const originalExistingTranslation = existingMessage.translations?.find(orig => 
          (orig.targetLanguage || (orig as any).language) === t.language
        );
        const originalNewTranslation = translations.find((orig: any) => 
          (orig.targetLanguage || orig.language) === t.language
        );
        
        const finalTranslation = {
          id: originalExistingTranslation?.id || `${messageId}_${t.language}_${Date.now()}`,
          messageId: messageId,
          sourceLanguage: originalExistingTranslation?.sourceLanguage || originalNewTranslation?.sourceLanguage || existingMessage.originalLanguage || 'fr',
          targetLanguage: t.language,
          translatedContent: t.content,
          translationModel: t.model as 'basic' | 'medium' | 'premium',
          cacheKey: originalExistingTranslation?.cacheKey || originalNewTranslation?.cacheKey || `${messageId}_${existingMessage.originalLanguage || 'fr'}_${t.language}`,
          confidenceScore: t.confidence,
          createdAt: t.timestamp,
          cached: originalExistingTranslation?.cached || originalNewTranslation?.cached || false,
          // Support du format frontend
          language: t.language,
          content: t.content,
          confidence: t.confidence,
          model: t.model
        };
        
        console.log(`  📄 Traduction finale ${t.language}:`, finalTranslation);
        
        // ⚠️ DÉBOGAGE FINAL: Vérifier la traduction finale
        if (finalTranslation.translatedContent === existingMessage.content) {
          console.error(`  ❌ ERREUR FINALE: Traduction ${t.language} toujours identique au contenu original!`);
        }
        
        return finalTranslation;
      });
      
      console.log('  - Traductions finales optimisées:', finalTranslations.length);
      console.log('  - Langues et modèles retenus:', Array.from(bestTranslationsMap.values()).map(t => `${t.language}:${t.model}(${t.confidence.toFixed(2)})`));
      
      const updatedMessage = {
        ...existingMessage,
        translations: finalTranslations
      };
      
      console.log('  ✅ Message mis à jour avec nouvelles traductions:', {
        messageId: updatedMessage.id,
        oldTranslationCount: existingMessage.translations?.length || 0,
        newTranslationCount: finalTranslations.length,
        hasNewTranslations: finalTranslations.length > (existingMessage.translations?.length || 0),
        finalTranslations: finalTranslations.map(t => ({
          id: t.id,
          targetLanguage: t.targetLanguage,
          translatedContent: t.translatedContent?.substring(0, 30) + '...',
          translationModel: t.translationModel
        }))
      });
      
      console.groupEnd();
      
      return updatedMessage;
    });
    
    // Incrémenter le compteur de traduction pour les traductions pertinentes
    const userLanguages = [
      user?.systemLanguage,
      user?.regionalLanguage,
      user?.customDestinationLanguage
    ].filter(Boolean);

    translations.forEach((translation: any) => {
      if (userLanguages.includes(translation.targetLanguage)) {
        incrementTranslationCount(translation.sourceLanguage || 'fr', translation.targetLanguage);
      }
      
      // Retirer l'état de traduction en cours
      removeTranslatingState(messageId, translation.targetLanguage);
    });
  }, [user?.systemLanguage, user?.regionalLanguage, user?.customDestinationLanguage, incrementTranslationCount, updateMessageTranslations, removeTranslatingState]);

  const handleMessageSent = useCallback((content: string, language: string) => {
    // Message sent successfully
  }, []);

  const handleMessageFailed = useCallback((content: string, error: Error) => {
    console.error('Échec d\'envoi du message:', { content: content.substring(0, 50) + '...', error });
  }, []);

  // Hook de messagerie réutilisable basé sur BubbleStreamPage
  const {
    isSending,
    sendMessage: sendMessageToService,
    startTyping,
    stopTyping,
  } = useMessaging({
    conversationId: selectedConversation?.id,
    currentUser: user!,
    onUserTyping: handleUserTyping,
    onUserStatus: handleUserStatus,
    onConversationStats: handleConversationStats,
    onNewMessage: handleNewMessage,
    onTranslation: handleTranslation,
    onMessageSent: handleMessageSent,
    onMessageFailed: handleMessageFailed
  });

  // Détecter si on est sur mobile
  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);
    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

  // Gérer l'affichage responsive
  useEffect(() => {
    if (isMobile) {
      // Sur mobile, montrer la liste si aucune conversation sélectionnée
      setShowConversationList(!selectedConversation);
    } else {
      // Sur desktop, toujours montrer la liste
      setShowConversationList(true);
    }
  }, [isMobile, selectedConversation]);

  // Charger les données initiales
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);

      // Démarrer le chargement des conversations immédiatement
      const conversationsData = await conversationsService.getConversations();

      // Utiliser directement les conversations récupérées depuis l'API
      let conversationsWithAny = [...conversationsData];

      setConversationsIfChanged(sanitizeConversations(conversationsWithAny));

      // Sélectionner une conversation seulement si spécifiée dans l'URL ou via props
      const conversationIdFromUrl = selectedConversationId || searchParams.get('id');
      console.log('[DEBUG] Conversation ID from URL/props:', conversationIdFromUrl);
      console.log('[DEBUG] Available conversations:', conversationsWithAny.map(c => ({ id: c.id, title: c.title })));
      
      if (conversationIdFromUrl) {
        let conversation = conversationsWithAny.find(c => c.id === conversationIdFromUrl);
        console.log('[DEBUG] Found conversation:', conversation ? { id: conversation.id, title: conversation.title } : null);
        
        if (conversation) {
          setSelectedConversation(conversation);
          console.log('[DEBUG] ✅ Conversation sélectionnée:', conversation.title);
        } else {
          // ID non trouvé, désélectionner
          console.log('[DEBUG] ❌ Conversation non trouvée, désélection');
          setSelectedConversation(null);
        }
      } else {
        // Aucun ID dans l'URL, s'assurer qu'aucune conversation n'est sélectionnée
        console.log('[DEBUG] ⚠️ Aucun ID de conversation fourni');
        setSelectedConversation(null);
      }

      // Mettre fin au loading principal immédiatement après les conversations
      setIsLoading(false);

    } catch (error) {
      console.error('Erreur lors du chargement des conversations:', error);
      
      // Si c'est une erreur d'authentification, on peut essayer de rediriger
      if (error instanceof Error && (error.message.includes('401') || error.message.includes('Token invalide'))) {
        console.log('Erreur d\'authentification, redirection vers login...');
        router.push('/login');
        return;
      }

      // Afficher l'erreur à l'utilisateur
      console.error(t('toasts.conversations.loadError'));
      
      // Laisser la liste de conversations vide pour utiliser les seeds de la DB
      setConversations([]);
      setIsLoading(false);
    }
  }, [user?.id, router, sanitizeConversations, setConversationsIfChanged, searchParams, selectedConversationId]);

  // Effet pour charger les données initiales une seule fois
  useEffect(() => {
    if (user && conversations.length === 0) {
      console.log('[NAVIGATION] Chargement initial des conversations');
      loadData();
    }
  }, [user]); // Dépendance minimale pour éviter les rechargements multiples

  // Gérer la navigation avec les boutons du navigateur (retour/avancer)
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      console.log('[NAVIGATION] PopState event:', event.state);
      
      const conversationId = event.state?.conversationId || null;
      
      if (conversationId) {
        const conversation = conversations.find(c => c.id === conversationId);
        if (conversation) {
          setSelectedConversation(conversation);
          if (isMobile) {
            setShowConversationList(false);
          }
        }
      } else {
        // Retour à la liste
        setSelectedConversation(null);
        if (isMobile) {
          setShowConversationList(true);
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [conversations, isMobile]);

  // Effet séparé pour gérer les changements de paramètres d'URL
  useEffect(() => {
    if (user && conversations.length > 0) {
      const conversationIdFromUrl = selectedConversationId || searchParams.get('id');
      if (conversationIdFromUrl) {
        let conversation = conversations.find(c => c.id === conversationIdFromUrl);
        
        if (conversation && conversation.id !== selectedConversation?.id) {
          console.log('[NAVIGATION] Sélection de conversation depuis URL:', conversationIdFromUrl);
          setSelectedConversation(conversation);
          if (isMobile) {
            setShowConversationList(false);
          }
        } else if (!conversation) {
          console.log('[NAVIGATION] Conversation non trouvée dans URL:', conversationIdFromUrl);
          setSelectedConversation(null);
          if (isMobile) {
            setShowConversationList(true);
          }
        }
      } else {
        setSelectedConversation(null);
        if (isMobile) {
          setShowConversationList(true);
        }
      }
    }
  }, [searchParams, selectedConversationId, conversations, user?.id, selectedConversation?.id, isMobile]);

  // Effet pour gérer spécifiquement le retour à la liste (quand selectedConversationId devient undefined)
  useEffect(() => {
    if (!selectedConversationId && !searchParams.get('id')) {
      // Si on n'a plus d'ID de conversation dans l'URL, réinitialiser l'état
      setSelectedConversation(null);
      if (isMobile) {
        setShowConversationList(true);
      }
    }
  }, [selectedConversationId, searchParams, isMobile]);

  // Sauvegarder la position de scroll avant de sélectionner une conversation
  const saveScrollPosition = useCallback(() => {
    if (conversationListRef.current) {
      const scrollContainer = conversationListRef.current.querySelector('.overflow-y-auto');
      if (scrollContainer) {
        scrollPositionRef.current = scrollContainer.scrollTop;
        console.log('[SCROLL] Position sauvegardée:', scrollPositionRef.current);
      }
    }
  }, []);

  // Restaurer la position de scroll
  const restoreScrollPosition = useCallback(() => {
    if (conversationListRef.current) {
      const scrollContainer = conversationListRef.current.querySelector('.overflow-y-auto');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollPositionRef.current;
        console.log('[SCROLL] Position restaurée:', scrollPositionRef.current);
      }
    }
  }, []);

  // Sélectionner une conversation
  const handleSelectConversation = useCallback((conversation: Conversation) => {
    // Si c'est la même conversation, ne rien faire
    if (selectedConversation?.id === conversation.id) {
      return;
    }

    console.log('[NAVIGATION] Sélection de la conversation:', {
      id: conversation.id,
      title: conversation.title,
      name: conversation.name,
      type: conversation.type,
      participantsCount: conversation.participants?.length
    });

    // Sauvegarder la position de scroll avant de changer
    saveScrollPosition();

    // Sélectionner la conversation
    setSelectedConversation(conversation);

    // Sur mobile, masquer la liste pour afficher les messages
    if (isMobile) {
      setShowConversationList(false);
    }

    // Mettre à jour l'URL sans navigation (pour maintenir l'URL à jour)
    // Utiliser replaceState pour éviter d'ajouter une entrée dans l'historique
    const newUrl = `/conversations/${conversation.id}`;
    window.history.replaceState({ conversationId: conversation.id }, '', newUrl);

    // Restaurer le scroll après un court délai pour laisser le DOM se mettre à jour
    setTimeout(restoreScrollPosition, 100);
  }, [selectedConversation?.id, isMobile, saveScrollPosition, restoreScrollPosition]);

  // Retour à la liste (mobile et desktop)
  const handleBackToList = useCallback(() => {
    console.log('[NAVIGATION] Retour à la liste, isMobile:', isMobile);
    
    // Sauvegarder la position de scroll actuelle
    saveScrollPosition();
    
    // Désélectionner la conversation
    setSelectedConversation(null);
    
    if (isMobile) {
      // Sur mobile : afficher la liste des conversations
      setShowConversationList(true);
    }
    
    // Mettre à jour l'URL sans navigation
    window.history.replaceState({ conversationId: null }, '', '/conversations');
    
    // Restaurer la position de scroll
    setTimeout(restoreScrollPosition, 100);
  }, [isMobile, saveScrollPosition, restoreScrollPosition]);

  // Envoyer un message (simplifié grâce au hook réutilisable)
  const handleSendMessage = async (content: string, e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }

    if (!selectedConversation || !user || !content.trim()) {
      return;
    }

    // Utiliser le hook réutilisable pour envoyer le message
    const success = await sendMessageToService(content.trim(), selectedLanguage);

    if (success) {
      // Déclencher l'arrêt de l'indicateur de frappe
      stopTyping();
    }
  };

  // Fonction pour charger les participants d'une conversation
  const loadConversationParticipants = useCallback(async (conversationId: string) => {
    try {
      console.log('[CONVERSATION_LAYOUT] Chargement des participants pour:', conversationId);
      
      // Charger tous les participants (authentifiés et anonymes)
      const allParticipantsData = await conversationsService.getAllParticipants(conversationId);
      
      // Transformer les participants authentifiés en ThreadMember
      const authenticatedThreadMembers: ThreadMember[] = allParticipantsData.authenticatedParticipants.map((user) => ({
        id: user.id,
        conversationId: conversationId,
        userId: user.id,
        user: user,
        role: (user.role as UserRoleEnum) || UserRoleEnum.MEMBER,
        joinedAt: new Date(),
        isActive: true,
        isAnonymous: false
      }));

      // Transformer les participants anonymes en ThreadMember
      const anonymousThreadMembers: ThreadMember[] = allParticipantsData.anonymousParticipants.map((participant) => ({
        id: participant.id,
        conversationId: conversationId,
        userId: participant.id,
        user: {
          id: participant.id,
          username: participant.username,
          firstName: participant.firstName,
          lastName: participant.lastName,
          displayName: participant.username, // Utiliser username comme displayName pour les anonymes
          email: '',
          phoneNumber: '',
          role: 'MEMBER',
          permissions: {
            canAccessAdmin: false,
            canManageUsers: false,
            canManageGroups: false,
            canManageConversations: false,
            canViewAnalytics: false,
            canModerateContent: false,
            canViewAuditLogs: false,
            canManageNotifications: false,
            canManageTranslations: false,
          },
          systemLanguage: participant.language || 'fr',
          regionalLanguage: participant.language || 'fr',
          autoTranslateEnabled: true,
          translateToSystemLanguage: true,
          translateToRegionalLanguage: false,
          useCustomDestination: false,
          isOnline: participant.isOnline,
          lastSeen: new Date(participant.joinedAt),
          lastActiveAt: new Date(participant.joinedAt),
          isActive: true,
          createdAt: new Date(participant.joinedAt),
          updatedAt: new Date(participant.joinedAt),
          isAnonymous: true,
          isMeeshyer: false
        },
        role: UserRoleEnum.MEMBER,
        joinedAt: new Date(participant.joinedAt),
        isActive: true,
        isAnonymous: true
      }));

      // Combiner tous les participants
      const allThreadMembers = [...authenticatedThreadMembers, ...anonymousThreadMembers];
      
      console.log('[CONVERSATION_LAYOUT] Participants chargés:', {
        authenticated: authenticatedThreadMembers.length,
        anonymous: anonymousThreadMembers.length,
        total: allThreadMembers.length
      });

      setConversationParticipants(allThreadMembers);
    } catch (error) {
      console.error('Erreur lors du chargement des participants:', error);
      setConversationParticipants([]);
    }
  }, []);

  // Effet 1: gestion du chargement/vidage des messages lorsque la conversation change
  useEffect(() => {
    console.log('[DEBUG] Effect for loading messages triggered', {
      conversationId: selectedConversation?.id,
      messagesLength: messages.length,
      firstMessageConvId: messages[0]?.conversationId
    });

    if (!selectedConversation?.id) {
      clearMessages();
      return;
    }

    const isDifferentConversation = messages[0]?.conversationId && messages[0]?.conversationId !== selectedConversation.id;
    if (isDifferentConversation) {
      console.log('[DEBUG] Different conversation detected, clearing messages');
      // Nettoyage des messages de l'ancienne conversation
      clearMessages();
    }

    const hasNoMessages = messages.length === 0;
    if (hasNoMessages || isDifferentConversation) {
      console.log('[DEBUG] Loading messages for conversation', selectedConversation.id);
      // Chargement des messages pour la conversation
      loadMessages(selectedConversation.id, true);
    }
  }, [selectedConversation?.id, loadMessages, clearMessages]);

  // Effet 2: transformer les messages en MessageWithTranslations
  useEffect(() => {
    console.log('[DEBUG] Messages effect - messages.length:', messages.length);
    console.log('[DEBUG] Selected conversation:', selectedConversation ? { id: selectedConversation.id, title: selectedConversation.title } : null);
    
    if (messages.length > 0) {
      const processedMessages = messages.map(message => {
        const processed = processMessageWithTranslations(message);
        
        // Debug: Vérifier les traductions de chaque message
        if (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_DEBUG_MESSAGES === 'true') {
          console.log(`🔍 [ConversationLayout] Message ${message.id} - traductions:`, {
            messageId: message.id,
            rawTranslationsCount: message.translations?.length || 0,
            processedTranslationsCount: processed.translations?.length || 0,
            rawTranslations: message.translations,
            processedTranslations: processed.translations
          });
        }
        
        return processed;
      });
      setTranslatedMessages(processedMessages as any);
      console.log('[DEBUG] ✅ Messages transformés en MessageWithTranslations:', processedMessages.length);
    } else {
      console.log('[DEBUG] ⚠️ Aucun message à transformer');
      setTranslatedMessages([]);
    }
  }, [messages, processMessageWithTranslations]);

  // Effet 3: marquer les messages comme lus quand une conversation est ouverte
  useEffect(() => {
    if (selectedConversation?.id && user?.id) {
      // Marquer tous les messages de cette conversation comme lus
      conversationsService.markConversationAsRead(selectedConversation.id)
        .then((response) => {
          if (response.success && response.markedCount > 0) {
            console.log(`✅ ${response.markedCount} message(s) marqué(s) comme lu(s) pour la conversation ${selectedConversation.id}`);
            // Rafraîchir la liste des conversations pour mettre à jour le compteur unreadCount
            loadData();
          }
        })
        .catch((error) => {
          console.error('Erreur lors du marquage des messages comme lus:', error);
        });
    }
  }, [selectedConversation?.id, user?.id, loadData]);

  // Effet 4: chargement des participants uniquement quand l'ID de conversation change
  useEffect(() => {
    if (selectedConversation?.id) {
      loadConversationParticipants(selectedConversation.id);
    } else {
      setConversationParticipants([]);
    }
  }, [selectedConversation?.id, loadConversationParticipants]);

  // Sur mobile avec une conversation sélectionnée, ne pas utiliser DashboardLayout
  if (isMobile && selectedConversation) {
    return (
      <div className="h-screen w-full bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        {/* Zone de messages en plein écran sur mobile */}
        <div className="flex flex-col w-full h-full">
          {selectedConversation ? (
            <>
              {/* En-tête de la conversation */}
              <ConversationHeader
                conversation={selectedConversation}
                currentUser={user}
                conversationParticipants={conversationParticipants}
                typingUsers={typingUsers}
                isMobile={isMobile}
                onBackToList={handleBackToList}
                onOpenDetails={() => setIsDetailsSidebarOpen(true)}
                onParticipantRemoved={() => {}}
                onParticipantAdded={() => {}}
                onLinkCreated={loadData}
                t={t}
              />

              {/* Messages */}
              <ConversationMessages
                messages={translatedMessages}
                translatedMessages={translatedMessages}
                currentUser={user}
                userLanguage={user?.systemLanguage || 'fr'}
                usedLanguages={usedLanguages}
                isLoadingMessages={isLoadingMessages}
                isLoadingMore={isLoadingMore}
                hasMore={hasMore}
                isMobile={isMobile}
                onEditMessage={handleEditMessage}
                onDeleteMessage={handleDeleteMessage}
                onLoadMore={loadMore}
                conversationType={selectedConversation.type === 'anonymous' ? 'direct' : selectedConversation.type === 'broadcast' ? 'public' : selectedConversation.type}
                userRole={user?.role as UserRoleEnum || UserRoleEnum.USER}
                conversationId={selectedConversation.id}
                addTranslatingState={addTranslatingState}
                isTranslating={isTranslating}
                t={t}
              />

              {/* Zone de composition */}
              <ConversationComposer
                onSendMessage={handleSendMessage}
                onStartTyping={startTyping}
                onStopTyping={stopTyping}
                isSending={isSending}
                currentUser={user}
                selectedLanguage={selectedLanguage}
                onLanguageChange={setSelectedLanguage}
                isMobile={isMobile}
                t={t}
              />
            </>
          ) : (
            <ConversationEmptyState
              onCreateConversation={() => setIsCreateConversationModalOpen(true)}
              conversationsCount={conversations.length}
              onLinkCreated={() => {}}
              t={t}
            />
          )}
        </div>

        {/* Modales */}
        {isCreateConversationModalOpen && (
          <CreateConversationModal
            isOpen={isCreateConversationModalOpen}
            onClose={() => setIsCreateConversationModalOpen(false)}
            onConversationCreated={() => {}}
            currentUser={user}
          />
        )}

        {isCreateLinkModalOpen && selectedConversation && (
          <CreateLinkModal
            isOpen={isCreateLinkModalOpen}
            onClose={() => setIsCreateLinkModalOpen(false)}
            onLinkCreated={() => {}}
          />
        )}

        {isDetailsSidebarOpen && selectedConversation && (
          <ConversationDetailsSidebar
            conversation={selectedConversation}
            currentUser={user}
            messages={translatedMessages}
            isOpen={isDetailsSidebarOpen}
            onClose={() => setIsDetailsSidebarOpen(false)}
          />
        )}
      </div>
    );
  }

  return (
    <DashboardLayout 
      title={t('conversations.title')}
      className={cn(
        isMobile && selectedConversation && "conversation-open-mobile"
      )}
    >
      {isLoading ? (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">{t('loadingConversations')}</p>
          </div>
        </div>
      ) : (
        <div className={cn(
          "flex bg-transparent",
          isMobile 
            ? "conversation-listing-mobile" 
            : "h-full"
        )}>
          {/* Liste des conversations */}
          <div ref={conversationListRef}>
            <ConversationList
              conversations={conversations}
              selectedConversation={selectedConversation}
              currentUser={user}
              isLoading={isLoading}
              isMobile={isMobile}
              showConversationList={showConversationList}
              onSelectConversation={handleSelectConversation}
              onCreateConversation={() => setIsCreateConversationModalOpen(true)}
              onLinkCreated={loadData}
              t={t}
              tSearch={tSearch}
            />
          </div>

          {/* Zone de messages */}
          <div className={cn(
            "flex flex-col",
            // Structure mobile : prendre toute la hauteur disponible
            isMobile 
              ? (showConversationList ? "hidden" : "w-full h-full") 
              : "flex-1 h-full"
          )}>
            {selectedConversation ? (
              <>
                {/* En-tête de la conversation */}
                <ConversationHeader
                  conversation={selectedConversation}
                          currentUser={user}
                  conversationParticipants={conversationParticipants}
                  typingUsers={typingUsers}
                  isMobile={isMobile}
                  onBackToList={handleBackToList}
                  onOpenDetails={() => setIsDetailsSidebarOpen(true)}
                      onParticipantRemoved={(userId) => {
                        console.log(t('participantRemoved', { userId }));
                        loadConversationParticipants(selectedConversation.id);
                      }}
                      onParticipantAdded={(userId) => {
                        console.log(t('participantAdded', { userId }));
                        loadConversationParticipants(selectedConversation.id);
                      }}
                      onLinkCreated={(link) => {
                    // Lien créé depuis header
                  }}
                  t={t}
                />

                {/* Messages scrollables */}
                <ConversationMessages
                    messages={messages}
                    translatedMessages={translatedMessages}
                    isLoadingMessages={isLoadingMessages}
                  isLoadingMore={isLoadingMore}
                  hasMore={hasMore}
                    currentUser={user}
                    userLanguage={user.systemLanguage}
                    usedLanguages={usedLanguages}
                  isMobile={isMobile}
                    conversationType={selectedConversation?.type === 'anonymous' ? 'direct' : selectedConversation?.type === 'broadcast' ? 'public' : selectedConversation?.type || 'direct'}
                    userRole={(user.role as UserRoleEnum) || UserRoleEnum.USER}
                    conversationId={selectedConversation?.id}
                    addTranslatingState={addTranslatingState}
                    isTranslating={isTranslating}
                  onEditMessage={handleEditMessage}
                  onDeleteMessage={handleDeleteMessage}
                  onLoadMore={loadMore}
                  t={t}
                  containerRef={messagesContainerRef as any}
                  />

                {/* Zone de saisie fixe en bas - toujours visible */}
                <ConversationComposer
                  currentUser={user}
                    selectedLanguage={selectedLanguage}
                    onLanguageChange={setSelectedLanguage}
                  onSendMessage={handleSendMessage}
                  onStartTyping={startTyping}
                  onStopTyping={stopTyping}
                  isSending={isSending}
                  isMobile={isMobile}
                  t={t}
                />
              </>
            ) : (
              <ConversationEmptyState
                conversationsCount={conversations.length}
                onCreateConversation={() => setIsCreateConversationModalOpen(true)}
                onLinkCreated={loadData}
                t={t}
              />
            )}
          </div>
        </div>
      )}

      {/* Modales */}
      <CreateConversationModal
        isOpen={isCreateConversationModalOpen}
        onClose={() => setIsCreateConversationModalOpen(false)}
        currentUser={user}
        onConversationCreated={(conversationId, conversationData) => {
          // Conversation créée
          
          // Marquer qu'on vient de créer cette conversation pour éviter le rechargement
          setJustCreatedConversation(conversationId);
          
          // Fermer le modal immédiatement
          setIsCreateConversationModalOpen(false);
          
          // Vider les messages de l'ancienne conversation immédiatement
          clearMessages();
          
          // Si on a les données de la conversation, l'ajouter immédiatement
          if (conversationData) {
            // Ajouter la nouvelle conversation à la liste locale immédiatement
            setConversations(prev => {
              const updatedList = [conversationData, ...prev];
              return sanitizeConversations(updatedList);
            });
            
            // Sélectionner automatiquement la nouvelle conversation
            setSelectedConversation(conversationData);
            
            // Mettre à jour l'URL sans navigation
            window.history.replaceState(null, '', `/conversations/${conversationData.id}`);
            
            // Affichage mobile : masquer la liste des conversations
            if (isMobile) {
              setShowConversationList(false);
            }
          } else {
            // Fallback : charger la nouvelle conversation depuis le serveur
            conversationsService.getConversation(conversationId).then((newConversation) => {
              // Ajouter la nouvelle conversation à la liste locale
              setConversations(prev => {
                const updatedList = [newConversation, ...prev];
                return sanitizeConversations(updatedList);
              });
              
              setSelectedConversation(newConversation);
              // Mettre à jour l'URL sans navigation
              window.history.replaceState(null, '', `/conversations/${newConversation.id}`);
              
              if (isMobile) {
                setShowConversationList(false);
              }
            }).catch((error) => {
              console.error(t('errorLoadingNewConversation'), error);
              console.error(t('errorLoadingConversation'));
              setTimeout(() => {
                loadData();
              }, 1000);
            });
          }
        }}
      />

      {/* Modal de création de lien */}
      <CreateLinkModal
        isOpen={isCreateLinkModalOpen}
        onClose={() => setIsCreateLinkModalOpen(false)}
        onLinkCreated={() => {
          setIsCreateLinkModalOpen(false);
          loadData();
        }}
      />

      {/* Sidebar des détails de conversation */}
      {selectedConversation && (
        <ConversationDetailsSidebar
          conversation={selectedConversation}
          currentUser={user}
          messages={translatedMessages}
          isOpen={isDetailsSidebarOpen}
          onClose={() => setIsDetailsSidebarOpen(false)}
        />
      )}
    </DashboardLayout>
  );
}