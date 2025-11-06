'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUser, useIsAuthChecking } from '@/stores';
import { useI18n } from '@/hooks/useI18n';
import { useConversationMessages } from '@/hooks/use-conversation-messages';
import { useSocketIOMessaging } from '@/hooks/use-socketio-messaging';
import { useConversationsPagination } from '@/hooks/use-conversations-pagination';
import { conversationsService } from '@/services/conversations.service';
import { messageService } from '@/services/message.service';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { ConversationList } from './ConversationList';
import { ConversationHeader } from './ConversationHeader';
import { ConversationMessages } from './ConversationMessages';
import { ConversationEmptyState } from './ConversationEmptyState';
import { MessageComposer } from '@/components/common/message-composer';
import { getUserLanguageChoices } from '@/utils/user-language-preferences';
import { CreateConversationModal } from './create-conversation-modal';
import { ConversationDetailsSidebar } from './conversation-details-sidebar';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ArrowLeft, MessageSquare } from 'lucide-react';
import type { Conversation, ThreadMember, UserRoleEnum, Attachment } from '@shared/types';
import { useReplyStore } from '@/stores/reply-store';
import { toast } from 'sonner';
import { getAuthToken } from '@/utils/token-utils';
import { AttachmentGallery } from '@/components/attachments/AttachmentGallery';
import { FailedMessageBanner } from '@/components/messages/failed-message-banner';
import { useFailedMessagesStore, type FailedMessage } from '@/stores/failed-messages-store';
import { ConnectionStatusIndicator } from './connection-status-indicator';
import { meeshySocketIOService } from '@/services/meeshy-socketio.service';
import { logger } from '@/utils/logger';

interface ConversationLayoutProps {
  selectedConversationId?: string;
}

export function ConversationLayout({ selectedConversationId }: ConversationLayoutProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useUser(); const isAuthChecking = useIsAuthChecking();
  const { t } = useI18n('conversations');
  const { t: tCommon } = useI18n('common');
  
  // ID unique pour cette instance du composant
  const instanceId = useMemo(() => `layout-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, []);

  // CRITIQUE: Mémoiser les choix de langues pour éviter re-renders de MessageComposer
  const languageChoices = useMemo(() => {
    return user ? getUserLanguageChoices(user) : [];
  }, [user?.systemLanguage, user?.regionalLanguage, user?.customDestinationLanguage]);

  // Hook de pagination pour les conversations
  const {
    conversations: paginatedConversations,
    isLoading: isLoadingConversations,
    isLoadingMore: isLoadingMoreConversations,
    hasMore: hasMoreConversations,
    loadMore: loadMoreConversations,
    refresh: refreshConversations,
    setConversations
  } = useConversationsPagination({
    limit: 50,
    enabled: !!user
  });
  
  // Utiliser les conversations paginées
  const conversations = paginatedConversations;
  
  // État local pour la sélection dynamique (sans changement d'URL)
  const [localSelectedConversationId, setLocalSelectedConversationId] = useState<string | null>(null);
  
  // Utiliser l'ID depuis l'URL ou l'état local
  const effectiveSelectedId = selectedConversationId || localSelectedConversationId;
  
  const selectedConversation = useMemo(() => {
    if (!effectiveSelectedId || !conversations.length) return null;
    const found = conversations.find(c => c.id === effectiveSelectedId);
    console.log(`[ConversationLayout-${instanceId}] Conversation sélectionnée:`, {
      fromUrl: !!selectedConversationId,
      fromLocal: !!localSelectedConversationId,
      effectiveId: effectiveSelectedId,
      found: !!found,
      foundId: found?.id,
      foundTitle: found?.title
    });
    return found || null;
  }, [effectiveSelectedId, conversations]);
  const [participants, setParticipants] = useState<ThreadMember[]>([]);

  // Ref pour les participants (évite les re-créations de callbacks)
  const participantsRef = useRef<ThreadMember[]>([]);
  // Utiliser l'état de chargement du hook de pagination
  const isLoading = isLoadingConversations;
  const [selectedLanguage, setSelectedLanguage] = useState('fr');

  // États modaux et UI
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showConversationList, setShowConversationList] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  
  // État pour les attachments
  const [attachmentIds, setAttachmentIds] = useState<string[]>([]);
  const [attachmentMimeTypes, setAttachmentMimeTypes] = useState<string[]>([]);

  // Ref pour stocker les valeurs précédentes d'attachments
  const prevAttachmentIdsRef = useRef<string>('[]');
  const prevMimeTypesRef = useRef<string>('[]');

  // Callback mémorisé pour les changements d'attachments
  // FIX: Mémoiser ce callback pour éviter les boucles infinies dans MessageComposer
  const handleAttachmentsChange = useCallback((ids: string[], mimeTypes: string[]) => {
    // Comparer par valeur sérialisée pour éviter les updates inutiles
    const idsString = JSON.stringify(ids);
    const mimeTypesString = JSON.stringify(mimeTypes);

    // CRITIQUE: Ne mettre à jour QUE si les valeurs ont vraiment changé
    if (idsString !== prevAttachmentIdsRef.current) {
      console.log('🔄 [ConversationLayout] Mise à jour attachmentIds:', ids);
      setAttachmentIds(ids);
      prevAttachmentIdsRef.current = idsString;
    }

    if (mimeTypesString !== prevMimeTypesRef.current) {
      console.log('🔄 [ConversationLayout] Mise à jour mimeTypes:', mimeTypes);
      setAttachmentMimeTypes(mimeTypes);
      prevMimeTypesRef.current = mimeTypesString;
    }
  }, []); // Pas de dépendances - les setState et refs sont stables

  // Référence pour le textarea du MessageComposer
  const messageComposerRef = useRef<{ focus: () => void; blur: () => void; clearAttachments?: () => void }>(null);

  // Référence pour le timeout de frappe
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Référence pour la zone de scroll des messages
  const messagesScrollRef = useRef<HTMLDivElement | null>(null);

  // Référence pour l'ID de conversation (évite les re-créations de callbacks)
  const selectedConversationIdRef = useRef<string | null>(null);

  // Mettre à jour les refs quand les valeurs changent
  useEffect(() => {
    selectedConversationIdRef.current = selectedConversation?.id || null;
  }, [selectedConversation?.id]);

  useEffect(() => {
    participantsRef.current = participants;
  }, [participants]);

  // Constante pour le délai d'arrêt de frappe (3 secondes après la dernière frappe)
  const TYPING_STOP_DELAY = 3000;
  
  // États pour la galerie d'images
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [selectedAttachmentId, setSelectedAttachmentId] = useState<string | null>(null);

  // État pour les traductions
  const [translatingMessages, setTranslatingMessages] = useState<Map<string, Set<string>>>(new Map());
  const [usedLanguages, setUsedLanguages] = useState<string[]>([]);
  
  // État de connexion WebSocket
  const [connectionStatus, setConnectionStatus] = useState<{
    isConnected: boolean;
    hasSocket: boolean;
  }>({ isConnected: false, hasSocket: false });
  
  // Ref pour éviter les reconnexions multiples
  const hasAttemptedReconnect = useRef(false);

  // Fonctions pour gérer l'état des traductions en cours
  const addTranslatingState = useCallback((messageId: string, targetLanguage: string) => {
    setTranslatingMessages(prev => {
      const newMap = new Map(prev);
      const currentLanguages = newMap.get(messageId) || new Set();
      currentLanguages.add(targetLanguage);
      newMap.set(messageId, currentLanguages);
      return newMap;
    });
  }, []);

  const removeTranslatingState = useCallback((messageId: string, targetLanguage: string) => {
    setTranslatingMessages(prev => {
      const newMap = new Map(prev);
      const currentLanguages = newMap.get(messageId);
      if (currentLanguages) {
        currentLanguages.delete(targetLanguage);
        if (currentLanguages.size === 0) {
          newMap.delete(messageId);
        } else {
          newMap.set(messageId, currentLanguages);
        }
      }
      return newMap;
    });
  }, []);

  const isTranslating = useCallback((messageId: string, targetLanguage: string): boolean => {
    const currentLanguages = translatingMessages.get(messageId);
    return currentLanguages ? currentLanguages.has(targetLanguage) : false;
  }, [translatingMessages]);

  // État pour les utilisateurs en train de taper
  const [typingUsers, setTypingUsers] = useState<{id: string, displayName: string}[]>([]);
  const [isTyping, setIsTyping] = useState(false);

  // Hook pour les messages (doit être déclaré avant useSocketIOMessaging)
  const {
    messages,
    isLoading: isLoadingMessages,
    isLoadingMore,
    hasMore,
    loadMore,
    refresh: refreshMessages,
    clearMessages,
    addMessage,
    updateMessage,
    removeMessage
  } = useConversationMessages(selectedConversation?.id || null, user!, {
    limit: 20,
    enabled: !!selectedConversation?.id,
    containerRef: messagesScrollRef // Pass container ref to hook to avoid warnings
  });

    // Callback pour gérer les événements de frappe
  const handleUserTyping = useCallback((userId: string, username: string, isTyping: boolean, typingConversationId: string) => {
    console.log('[ConversationLayout] 👤 Événement de frappe REÇU:', {
      userId,
      username,
      isTyping,
      typingConversationId,
      selectedConversationId: selectedConversationIdRef.current,
      currentUserId: user?.id,
      willIgnore: !user || userId === user.id || typingConversationId !== selectedConversationIdRef.current
    });

    if (!user || userId === user.id) return; // Ignorer nos propres événements

    // FIX: Filtrer les événements typing par conversation
    if (typingConversationId !== selectedConversationIdRef.current) {
      console.log('[ConversationLayout] 🚫 Événement de frappe ignoré (autre conversation)');
      return;
    }

    console.log('[ConversationLayout] ✅ Traitement événement de frappe (pas ignoré)');

    setTypingUsers(prev => {
      if (isTyping) {
        // Ajouter l'utilisateur s'il n'est pas déjà dans la liste
        if (prev.some(u => u.id === userId)) {
          console.log('[ConversationLayout] 📝 Utilisateur déjà dans la liste, pas d\'ajout');
          return prev;
        }

        // Utiliser la ref pour éviter la re-création du callback
        const currentParticipants = participantsRef.current;
        const participant = currentParticipants.find(p => p.userId === userId);
        let displayName: string;

        if (participant?.user) {
          const u = participant.user;
          if (u.displayName) {
            displayName = u.displayName;
          } else if (u.firstName || u.lastName) {
            displayName = `${u.firstName || ''} ${u.lastName || ''}`.trim();
          } else {
            displayName = u.username || username;
          }
        } else if (username && username !== userId) {
          displayName = username;
        } else {
          displayName = `Utilisateur ${userId.slice(-6)}`;
        }

        console.log('[ConversationLayout] ➕ Ajout utilisateur tapant:', { userId, displayName });
        return [...prev, { id: userId, displayName }];
      } else {
        // Retirer l'utilisateur de la liste
        console.log('[ConversationLayout] ➖ Retrait utilisateur tapant:', { userId });
        return prev.filter(u => u.id !== userId);
      }
    });
  }, [user]);

  // Hook Socket.IO messaging pour la communication temps réel
  const {
    sendMessage: sendMessageViaSocket,
    sendMessageWithAttachments: sendMessageWithAttachmentsViaSocket,
    connectionStatus: socketConnectionStatus,
    startTyping,
    stopTyping
  } = useSocketIOMessaging({
    conversationId: selectedConversation?.id,
    currentUser: user || undefined,
    onUserTyping: handleUserTyping,
    onMessageEdited: useCallback((message: any) => {
      console.log('✏️ [ConversationLayout] Message édité reçu via Socket.IO:', message.id);
      // Utiliser la ref au lieu de selectedConversation?.id
      if (message.conversationId === selectedConversationIdRef.current) {
        updateMessage(message.id, message);
        toast.info(tCommon('messages.messageEditedByOther'));
      }
    }, [updateMessage, tCommon]),
    onMessageDeleted: useCallback((messageId: string) => {
      console.log('🗑️ [ConversationLayout] Message supprimé reçu via Socket.IO:', messageId);
      removeMessage(messageId);
      toast.info(tCommon('messages.messageDeletedByOther'));
    }, [removeMessage, tCommon]),
    onNewMessage: useCallback(async (message: any) => {
      // Utiliser la ref au lieu de selectedConversation?.id
      const currentConvId = selectedConversationIdRef.current;

      // FILTRAGE SIMPLIFIÉ: Le backend envoie maintenant TOUJOURS l'ObjectId normalisé
      // Plus besoin de triple comparaison ni de getCurrentConversationIdentifier()
      const normalizedConvId = meeshySocketIOService.getCurrentConversationId();

      // Comparer avec l'ObjectId normalisé reçu lors du CONVERSATION_JOINED
      const isForCurrentConversation = message.conversationId === normalizedConvId;

      console.log(`[ConversationLayout-${instanceId}] 🔥 NOUVEAU MESSAGE VIA WEBSOCKET:`, {
        messageId: message.id,
        content: message.content?.substring(0, 50),
        senderId: message.senderId,
        messageConvId: message.conversationId,
        selectedConversationId: currentConvId,
        normalizedConvId: normalizedConvId,
        shouldAdd: isForCurrentConversation
      });

      // Mettre à jour la liste des conversations pour refléter le nouveau message
      // CORRECTION: Faire AVANT le filtrage pour que TOUS les messages mettent à jour la liste
      setConversations(prevConversations => {
        const conversationIndex = prevConversations.findIndex(c => c.id === message.conversationId);

        if (conversationIndex === -1) {
          // Conversation non trouvée dans la liste
          console.log(`[ConversationLayout-${instanceId}] ⚠️ Conversation ${message.conversationId} non trouvée dans la liste - refresh nécessaire`);

          // Déclencher un refresh asynchrone de la liste pour inclure cette conversation
          // Utiliser setTimeout pour ne pas bloquer le traitement du message
          setTimeout(() => {
            console.log(`[ConversationLayout-${instanceId}] 🔄 Rafraîchissement de la liste des conversations...`);
            refreshConversations();
          }, 100);

          return prevConversations;
        }

        // Créer une copie de la conversation avec les informations mises à jour
        const updatedConversation = {
          ...prevConversations[conversationIndex],
          lastMessage: message,
          lastMessageAt: message.createdAt || new Date(),
          lastActivityAt: message.createdAt || new Date()
        };

        // Retirer la conversation de sa position actuelle
        const updatedConversations = prevConversations.filter((_, index) => index !== conversationIndex);

        // Ajouter la conversation mise à jour en première position
        const newConversations = [updatedConversation, ...updatedConversations];

        console.log(`[ConversationLayout-${instanceId}] 📋 Liste des conversations mise à jour:`, {
          conversationId: message.conversationId,
          previousPosition: conversationIndex,
          newPosition: 0,
          lastMessagePreview: message.content?.substring(0, 30)
        });

        return newConversations;
      });

      // Ajouter le message à la vue seulement si c'est pour la conversation actuelle
      if (isForCurrentConversation) {
        const wasAdded = addMessage(message);
        console.log(`[ConversationLayout-${instanceId}] Message ajouté à la vue:`, wasAdded);
      } else {
        console.log(`[ConversationLayout-${instanceId}] Message ignoré pour la vue (autre conversation)`);
      }
    }, [addMessage, instanceId, setConversations, refreshConversations]),
    onTranslation: useCallback((messageId: string, translations: any[]) => {
      console.log('🌐 [ConversationLayoutV2] Traductions reçues pour message:', messageId, translations);
      
      // Mettre à jour le message avec les nouvelles traductions en utilisant une fonction de transformation
      updateMessage(messageId, (prevMessage) => {
        console.log('🔄 [ConversationLayoutV2] Mise à jour des traductions pour message:', messageId, {
          currentTranslations: prevMessage.translations?.length || 0,
          newTranslations: translations.length,
          translationsReceived: translations.map(t => ({ 
            lang: t.targetLanguage || t.language, 
            content: (t.translatedContent || t.content)?.substring(0, 30) + '...' 
          }))
        });

        // Fusionner les nouvelles traductions avec les existantes
        const existingTranslations = prevMessage.translations || [];
        const updatedTranslations = [...existingTranslations];

        translations.forEach(newTranslation => {
          const targetLang = newTranslation.targetLanguage || newTranslation.language;
          const content = newTranslation.translatedContent || newTranslation.content;
          
          if (!targetLang || !content) {
            console.warn('🚫 [ConversationLayoutV2] Traduction invalide ignorée:', newTranslation);
            return;
          }

          // Chercher si une traduction existe déjà pour cette langue
          const existingIndex = updatedTranslations.findIndex(
            t => t.targetLanguage === targetLang
          );

          const translationObject = {
            id: newTranslation.id || `${messageId}_${targetLang}`,
            messageId: messageId,
            sourceLanguage: newTranslation.sourceLanguage || prevMessage.originalLanguage || 'fr',
            targetLanguage: targetLang,
            translatedContent: content,
            translationModel: newTranslation.translationModel || newTranslation.model || 'basic',
            cacheKey: newTranslation.cacheKey || `${messageId}_${targetLang}`,
            cached: newTranslation.cached || newTranslation.fromCache || false,
            confidenceScore: newTranslation.confidenceScore || newTranslation.confidence || 0.9,
            createdAt: newTranslation.createdAt ? new Date(newTranslation.createdAt) : new Date(),
          };

          if (existingIndex >= 0) {
            // Remplacer la traduction existante
            console.log('🔄 [ConversationLayoutV2] Remplacement traduction existante:', targetLang);
            updatedTranslations[existingIndex] = translationObject;
          } else {
            // Ajouter la nouvelle traduction
            console.log('➕ [ConversationLayoutV2] Ajout nouvelle traduction:', targetLang);
            updatedTranslations.push(translationObject);
          }
        });

        console.log('✅ [ConversationLayoutV2] Traductions mises à jour:', {
          messageId,
          before: existingTranslations.length,
          after: updatedTranslations.length,
          languages: updatedTranslations.map(t => t.targetLanguage)
        });

        return {
          ...prevMessage,
          translations: updatedTranslations
        };
      });
      
      // Ajouter les nouvelles langues à la liste des langues utilisées
      // Utiliser une fonction de mise à jour pour éviter la dépendance à usedLanguages
      setUsedLanguages(prev => {
        const newLanguages = translations
          .map(t => t.targetLanguage || t.language)
          .filter((lang): lang is string => Boolean(lang) && !prev.includes(lang));

        if (newLanguages.length > 0) {
          console.log('📝 [ConversationLayoutV2] Ajout nouvelles langues utilisées:', newLanguages);
          return [...prev, ...newLanguages];
        }
        return prev;
      });

      // Supprimer l'état de traduction en cours pour toutes les langues reçues
      translations.forEach(translation => {
        const targetLang = translation.targetLanguage || translation.language;
        if (targetLang) {
          removeTranslatingState(messageId, targetLang);
        }
      });
    }, [updateMessage, removeTranslatingState])
  });

  // Détection du mobile
  useEffect(() => {
    const checkMobile = () => {
      const isMobileView = window.innerWidth < 768;
      setIsMobile(isMobileView);
      
      console.log(`[ConversationLayout-${instanceId}] Détection mobile:`, {
        isMobileView,
        hasSelectedConversation: !!selectedConversation,
        selectedConversationId: selectedConversation?.id,
        urlId: selectedConversationId
      });
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []); // Supprimer selectedConversation des dépendances

  // Gestion de l'affichage mobile selon la conversation sélectionnée
  useEffect(() => {
    if (isMobile) {
      if (selectedConversation?.id) {
        // Il y a une conversation sélectionnée → masquer la liste
        console.log(`[ConversationLayout-${instanceId}] Mobile: conversation sélectionnée, masquer liste`);
        setShowConversationList(false);
      } else {
        // Pas de conversation sélectionnée → afficher la liste
        console.log(`[ConversationLayout-${instanceId}] Mobile: pas de conversation, afficher liste`);
        setShowConversationList(true);
      }
    } else {
      // Desktop → toujours afficher la liste
      setShowConversationList(true);
    }
  }, [isMobile, selectedConversation?.id, instanceId]);
  
  // Si on arrive avec une URL /conversations/:id, initialiser la sélection locale
  useEffect(() => {
    if (selectedConversationId && !localSelectedConversationId) {
      console.log(`[ConversationLayout-${instanceId}] URL avec ID détecté, initialisation sélection locale:`, selectedConversationId);
      setLocalSelectedConversationId(selectedConversationId);
    }
  }, [selectedConversationId, instanceId]);
  

  // Le chargement des conversations est maintenant géré par le hook useConversationsPagination
  // Cette fonction n'est plus nécessaire mais gardée pour compatibilité
  const loadConversations = useCallback(async () => {
    console.log('[ConversationLayout] Rafraîchissement des conversations via hook de pagination');
    refreshConversations();
  }, [refreshConversations]);

  // Chargement des participants
  const loadParticipants = useCallback(async (conversationId: string) => {
    try {
      const participantsData = await conversationsService.getAllParticipants(conversationId);
      
      const allParticipants: ThreadMember[] = [
        ...participantsData.authenticatedParticipants.map(user => ({
          id: user.id,
          conversationId,
          userId: user.id,
          user: user,
          role: user.role as UserRoleEnum,
          joinedAt: new Date(),
          isActive: true,
          isAnonymous: false
        })),
        ...participantsData.anonymousParticipants.map(participant => ({
          id: participant.id,
          conversationId,
          userId: participant.id,
          user: {
            ...participant,
            displayName: participant.username,
            email: '',
            phoneNumber: '',
            isOnline: false,
            lastSeen: new Date(),
            lastActiveAt: new Date(),
            systemLanguage: 'fr',
            regionalLanguage: 'fr',
            role: 'USER' as const,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
            autoTranslateEnabled: true,
            translateToSystemLanguage: true,
            translateToRegionalLanguage: false,
            useCustomDestination: false,
            keepOriginalMessages: true,
            translationQuality: 'medium'
          },
          role: 'MEMBER' as UserRoleEnum,
          joinedAt: new Date(),
          isActive: true,
          isAnonymous: true
        }))
      ];
      
      // Déduplication des participants basée sur userId
      // Priorité aux participants authentifiés en cas de doublon
      const participantsMap = new Map<string, ThreadMember>();
      
      // D'abord ajouter les participants anonymes
      allParticipants
        .filter(p => p.isAnonymous)
        .forEach(p => participantsMap.set(p.userId, p));
      
      // Puis ajouter/écraser avec les participants authentifiés (prioritaires)
      allParticipants
        .filter(p => !p.isAnonymous)
        .forEach(p => participantsMap.set(p.userId, p));
      
      const uniqueParticipants = Array.from(participantsMap.values());
      
      setParticipants(uniqueParticipants);
    } catch (error) {
      console.error('Erreur lors du chargement des participants:', error);
      setParticipants([]);
    }
  }, []);

  // Fonction pour charger une conversation directement
  const loadDirectConversation = useCallback(async (conversationId: string) => {
    try {
      console.log(`[ConversationLayout-${instanceId}] Chargement direct de la conversation:`, conversationId);
      const directConversation = await conversationsService.getConversation(conversationId);
      console.log(`[ConversationLayout-${instanceId}] Conversation chargée directement:`, directConversation);
      
      // Ajouter à la liste - useMemo se chargera de la sélectionner automatiquement
      setConversations(prev => {
        const exists = prev.find(c => c.id === directConversation.id);
        if (exists) {
          console.log(`[ConversationLayout-${instanceId}] Conversation déjà dans la liste`);
          return prev;
        }
        console.log(`[ConversationLayout-${instanceId}] Ajout conversation à la liste`);
        return [directConversation, ...prev];
      });
    } catch (error) {
      console.error(`[ConversationLayout-${instanceId}] Erreur chargement direct:`, error);
    }
  }, [instanceId]);

  // Charger la conversation directement si elle n'est pas dans la liste
  useEffect(() => {
    if (effectiveSelectedId && !isLoading && conversations.length > 0) {
      const found = conversations.find(c => c.id === effectiveSelectedId);
      if (!found) {
        console.log(`[ConversationLayout-${instanceId}] Conversation ${effectiveSelectedId} non trouvée, chargement direct`);
        loadDirectConversation(effectiveSelectedId);
      }
    }
  }, [effectiveSelectedId, conversations, isLoading, loadDirectConversation, instanceId]);

  // Nettoyer le timeout de frappe quand le composant se démonte ou quand la conversation change
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      // Arrêter la frappe si elle est active
      if (isTyping) {
        stopTyping();
        setIsTyping(false);
      }
    };
  }, [selectedConversation?.id, isTyping, stopTyping]);

  // Sélection d'une conversation (dynamique ou par URL)
  const handleSelectConversation = useCallback((conversation: Conversation) => {
    console.log(`[ConversationLayout-${instanceId}] Sélection conversation:`, {
      id: conversation.id,
      title: conversation.title,
      type: conversation.type,
      currentEffectiveId: effectiveSelectedId,
      mode: selectedConversationId ? 'url' : 'dynamic'
    });
    
    if (effectiveSelectedId === conversation.id) {
      console.log(`[ConversationLayout-${instanceId}] Conversation déjà sélectionnée, ignore`);
      return;
    }

    // Mode dynamique : mise à jour de l'état local SANS changer l'URL
    if (!selectedConversationId) {
      console.log(`[ConversationLayout-${instanceId}] Mode dynamique: sélection locale sans changement URL`);
      setLocalSelectedConversationId(conversation.id);
      
      // Mise à jour de l'URL dans l'historique sans recharger
      window.history.replaceState(null, '', '/conversations');
    } else {
      // Mode URL : navigation classique (pour compatibilité)
      console.log(`[ConversationLayout-${instanceId}] Mode URL: navigation vers:`, `/conversations/${conversation.id}`);
      router.push(`/conversations/${conversation.id}`);
    }
    
    // Note: L'affichage mobile est maintenant géré automatiquement par l'effet useEffect
  }, [effectiveSelectedId, selectedConversationId, router, instanceId]);

  // Retour à la liste (mobile et desktop)
  const handleBackToList = useCallback(() => {
    // Si on est en mode dynamique, juste effacer la sélection locale
    if (!selectedConversationId && localSelectedConversationId) {
      console.log(`[ConversationLayout-${instanceId}] Mode dynamique: effacer sélection locale`);
      setLocalSelectedConversationId(null);
      if (isMobile) {
        setShowConversationList(true);
      }
    } else if (selectedConversationId) {
      // Mode URL : navigation vers la liste sans ID
      console.log(`[ConversationLayout-${instanceId}] Mode URL: retour à /conversations`);
      router.push('/conversations');
    } else if (isMobile) {
      // Mobile sans sélection : afficher la liste
      setShowConversationList(true);
    }
  }, [isMobile, selectedConversationId, localSelectedConversationId, router, instanceId]);

  // Start video call
  const handleStartCall = useCallback(async () => {
    console.log('🎥🎥🎥 [ConversationLayout] handleStartCall CLICKED 🎥🎥🎥');
    logger.debug('[ConversationLayout]', '🎥 handleStartCall called', {
      hasConversation: !!selectedConversation,
      conversationId: selectedConversation?.id,
      conversationType: selectedConversation?.type
    });

    if (!selectedConversation) {
      console.error('❌ [ConversationLayout] No conversation selected');
      logger.warn('[ConversationLayout]', 'Cannot start call: no conversation selected');
      toast.error('Please select a conversation first');
      return;
    }

    if (selectedConversation.type !== 'direct') {
      console.error('❌ [ConversationLayout] Not a direct conversation');
      toast.error('Video calls are only available for direct conversations');
      logger.warn('[ConversationLayout]', 'Cannot start call: not a direct conversation');
      return;
    }

    console.log('✅ [ConversationLayout] Starting video call for conversation:', selectedConversation.id);
    logger.info('[ConversationLayout]', 'Starting video call - conversationId: ' + selectedConversation.id);

    // SAFARI FIX: Request media permissions IMMEDIATELY in user gesture context
    // Safari blocks getUserMedia() if not called synchronously from user interaction
    console.log('🎤📹 [ConversationLayout] Requesting media permissions (Safari-compatible)...');
    logger.debug('[ConversationLayout]', 'Requesting media permissions in click handler for Safari compatibility');

    let stream: MediaStream | null = null;

    try {
      // Request permissions synchronously in the click handler
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: {
          width: { ideal: 640, max: 1280 },
          height: { ideal: 480, max: 720 },
          frameRate: { ideal: 24, max: 30 },
          facingMode: 'user',
        },
      });

      console.log('✅ [ConversationLayout] Media permissions granted!', {
        audioTracks: stream.getAudioTracks().length,
        videoTracks: stream.getVideoTracks().length,
      });
      logger.info('[ConversationLayout]', 'Media permissions granted', {
        audioTracks: stream.getAudioTracks().length,
        videoTracks: stream.getVideoTracks().length,
      });

      // Store the stream temporarily - it will be used by CallInterface
      (window as any).__preauthorizedMediaStream = stream;

      // Continue with call initiation
      const socket = meeshySocketIOService.getSocket();
      console.log('🔌 [ConversationLayout] Socket status:', {
        hasSocket: !!socket,
        isConnected: socket?.connected,
        socketId: socket?.id
      });
      logger.debug('[ConversationLayout]', '🔌 Socket status', {
        hasSocket: !!socket,
        isConnected: socket?.connected,
        socketId: socket?.id
      });

      if (!socket) {
        console.error('❌ [ConversationLayout] No socket connection available');
        toast.error('Connection error. Please try again.');
        logger.error('[ConversationLayout]', 'Cannot start call: no socket connection');

        // Clean up stream
        stream.getTracks().forEach(track => track.stop());
        delete (window as any).__preauthorizedMediaStream;
        return;
      }

      if (!socket.connected) {
        console.error('❌ [ConversationLayout] Socket not connected');
        toast.error('Socket not connected. Please wait...');
        logger.error('[ConversationLayout]', 'Cannot start call: socket not connected');

        // Clean up stream
        stream.getTracks().forEach(track => track.stop());
        delete (window as any).__preauthorizedMediaStream;
        return;
      }

      const callData = {
        conversationId: selectedConversation.id,
        type: 'video',
        settings: {
          audioEnabled: true,
          videoEnabled: true,
        },
      };

      console.log('📤 [ConversationLayout] Emitting call:initiate event:', callData);
      logger.info('[ConversationLayout]', '📤 Emitting call:initiate', callData);

      // Emit call:initiate event
      (socket as any).emit('call:initiate', callData);

      console.log('✅ [ConversationLayout] call:initiate event sent successfully');
      toast.success('Starting call...');

      // Set up cleanup listener for errors
      // If call:error arrives within 2 seconds, cleanup the stream
      const errorCleanupTimeout = setTimeout(() => {
        // Remove error listener after 2 seconds (call should start by then)
        (socket as any).off('call:error', errorCleanupHandler);
      }, 2000);

      const errorCleanupHandler = (error: any) => {
        console.error('❌ [ConversationLayout] Call error received, cleaning up stream');
        logger.error('[ConversationLayout]', 'Call error, cleaning up pre-authorized stream', { error });

        // Clean up the pre-authorized stream
        const preauthorizedStream = (window as any).__preauthorizedMediaStream;
        if (preauthorizedStream) {
          preauthorizedStream.getTracks().forEach((track: MediaStreamTrack) => {
            track.stop();
            console.log('🛑 [ConversationLayout] Stopped track:', track.kind);
          });
          delete (window as any).__preauthorizedMediaStream;
        }

        // Clear timeout
        clearTimeout(errorCleanupTimeout);
      };

      // Listen for call:error for cleanup
      (socket as any).once('call:error', errorCleanupHandler);

    } catch (error: any) {
      console.error('❌ [ConversationLayout] Media permission denied or error:', error);
      logger.error('[ConversationLayout]', 'Failed to get media permissions', { error });

      // Clean up stream if it was created
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        delete (window as any).__preauthorizedMediaStream;
      }

      // Provide user-friendly error messages
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        toast.error('Camera/microphone permission denied. Please allow access in your browser settings.');
      } else if (error.name === 'NotFoundError') {
        toast.error('No camera or microphone found. Please connect a device.');
      } else if (error.name === 'NotReadableError') {
        toast.error('Camera/microphone is already in use by another application.');
      } else {
        toast.error('Failed to access camera/microphone: ' + error.message);
      }

      return; // Don't proceed with call if permissions failed
    }
  }, [selectedConversation]);

  // Gérer la réponse à un message
  const handleReplyMessage = useCallback((message: any) => {
    const { setReplyingTo } = useReplyStore.getState();
    setReplyingTo({
      id: message.id,
      content: message.content,
      originalLanguage: message.originalLanguage,
      sender: message.sender,
      createdAt: message.createdAt,
      translations: message.translations
    });

    // Focus sur MessageComposer
    if (messageComposerRef.current) {
      messageComposerRef.current.focus();
    }
  }, []);

  // Naviguer vers un message spécifique
  const handleNavigateToMessage = useCallback((messageId: string) => {
    console.log('🔍 Navigation vers le message:', messageId);

    const messageElement = document.getElementById(`message-${messageId}`);

    if (messageElement) {
      messageElement.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });

      messageElement.classList.add('ring-2', 'ring-blue-500', 'ring-offset-2');
      setTimeout(() => {
        messageElement.classList.remove('ring-2', 'ring-blue-500', 'ring-offset-2');
      }, 2000);

      toast.success(tCommon('messages.messageFound'));
    } else {
      toast.info(tCommon('messages.messageNotVisible'));
    }
  }, [tCommon]);

  // Éditer un message
  const handleEditMessage = useCallback(async (messageId: string, newContent: string) => {
    if (!selectedConversation) return;
    
    try {
      // Mettre à jour immédiatement l'état local pour une UI réactive
      updateMessage(messageId, (prev) => ({
        ...prev,
        content: newContent,
        isEdited: true,
        editedAt: new Date()
      }));
      
      // Appeler l'API pour mettre à jour sur le serveur
      await messageService.editMessage(selectedConversation.id, messageId, {
        content: newContent,
        originalLanguage: selectedLanguage
      });
      
      toast.success(tCommon('messages.messageEdited'));
    } catch (error) {
      console.error('Erreur lors de l\'édition du message:', error);
      toast.error(tCommon('messages.editError'));
      // En cas d'erreur, recharger les messages pour restaurer l'état correct
      await refreshMessages();
      throw error;
    }
  }, [selectedConversation, selectedLanguage, updateMessage, refreshMessages, tCommon]);

  // Supprimer un message
  const handleDeleteMessage = useCallback(async (messageId: string) => {
    if (!selectedConversation) return;
    
    try {
      // Supprimer immédiatement de l'état local pour une UI réactive
      removeMessage(messageId);
      
      // Appeler l'API pour supprimer sur le serveur
      await messageService.deleteMessage(selectedConversation.id, messageId);
      
      toast.success(tCommon('messages.messageDeleted'));
    } catch (error) {
      console.error('Erreur lors de la suppression du message:', error);
      toast.error(tCommon('messages.deleteError'));
      // En cas d'erreur, recharger les messages pour restaurer l'état correct
      await refreshMessages();
      throw error;
    }
  }, [selectedConversation, removeMessage, refreshMessages, tCommon]);
  
  // Extraire tous les attachments images des messages pour la galerie
  const imageAttachments = useMemo(() => {
    const allAttachments: Attachment[] = [];
    
    messages.forEach(message => {
      if (message.attachments && message.attachments.length > 0) {
        message.attachments.forEach(attachment => {
          if (attachment.mimeType?.startsWith('image/')) {
            allAttachments.push(attachment);
          }
        });
      }
    });
    
    return allAttachments;
  }, [messages]);

  // Handler pour ouvrir la galerie d'images
  const handleImageClick = useCallback((attachmentId: string) => {
    console.log('🖼️ [ConversationLayout] Clic sur image:', attachmentId);
    setSelectedAttachmentId(attachmentId);
    setGalleryOpen(true);
  }, []);

  // Handler pour naviguer vers un message depuis la galerie
  const handleNavigateToMessageFromGallery = useCallback((messageId: string) => {
    console.log('🖼️ [ConversationLayout] Navigation vers le message depuis la galerie:', messageId);
    
    // Fermer la galerie
    setGalleryOpen(false);
    
    // Attendre que la galerie se ferme avant de scroller
    setTimeout(() => {
      handleNavigateToMessage(messageId);
    }, 300);
  }, [handleNavigateToMessage]);

  // Envoi de message - attendre le retour serveur
  const handleSendMessage = useCallback(async () => {
    if ((!newMessage.trim() && attachmentIds.length === 0) || !selectedConversation || !user) {
      return;
    }

    const content = newMessage.trim();
    const replyToId = useReplyStore.getState().replyingTo?.id;
    
    const hasAttachments = attachmentIds.length > 0;
    
    console.log('[ConversationLayout] handleSendMessage appelé:', {
      content,
      selectedConversationId: selectedConversation?.id,
      hasSocketMessaging: !!sendMessageViaSocket,
      hasUser: !!user,
      selectedLanguage,
      replyToId,
      attachmentCount: attachmentIds.length,
      hasAttachments
    });
    
    if (!selectedConversation?.id || !user) {
      console.error('[ConversationLayout] Pas de conversation sélectionnée ou pas d\'utilisateur');
      return;
    }
    
    // Sauvegarder les attachments avant de les effacer
    const currentAttachmentIds = [...attachmentIds];
    const currentAttachmentMimeTypes = [...attachmentMimeTypes];

    try {
      // Arrêter immédiatement l'indicateur de frappe lors de l'envoi
      if (isTyping) {
        stopTyping();
        setIsTyping(false);
      }

      // Nettoyer le timeout de frappe
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }

      // Envoyer avec ou sans attachments
      if (hasAttachments && sendMessageWithAttachmentsViaSocket) {
        console.log('[ConversationLayout] 📎 Envoi avec attachments:', currentAttachmentIds);
        await sendMessageWithAttachmentsViaSocket(content, currentAttachmentIds, currentAttachmentMimeTypes, selectedLanguage, replyToId);
      } else {
        await sendMessageViaSocket(content, selectedLanguage, replyToId);
      }

      console.log('[ConversationLayout] Message envoyé avec succès - en attente du retour serveur');
      setNewMessage('');
      setAttachmentIds([]); // Réinitialiser les attachments
      setAttachmentMimeTypes([]); // Réinitialiser les MIME types

      // Clear les attachments du composer
      if (messageComposerRef.current && messageComposerRef.current.clearAttachments) {
        messageComposerRef.current.clearAttachments();
      }

      // Effacer l'état de réponse
      if (replyToId) {
        useReplyStore.getState().clearReply();
      }

      // Scroller vers le bas immédiatement après l'envoi
      setTimeout(() => {
        if (messagesScrollRef.current) {
          messagesScrollRef.current.scrollTo({
            top: messagesScrollRef.current.scrollHeight,
            behavior: 'smooth'
          });
        }
      }, 100);
    } catch (error) {
      console.error('[ConversationLayout] Erreur envoi message:', error);
      // Restaurer les attachments en cas d'erreur
      setAttachmentIds(currentAttachmentIds);
    }
  }, [newMessage, selectedConversation?.id, sendMessageViaSocket, sendMessageWithAttachmentsViaSocket, selectedLanguage, user, attachmentIds, attachmentMimeTypes, isTyping, stopTyping]);

  // Gestion de la saisie avec indicateurs de frappe
  const handleTyping = useCallback((value: string) => {
    setNewMessage(value);
    
    // Gérer l'indicateur de frappe avec timeout
    if (value.trim()) {
      // Si l'utilisateur tape et qu'il n'était pas déjà en train de taper
      if (!isTyping) {
        setIsTyping(true);
        startTyping();
      }
      
      // Réinitialiser le timeout à chaque caractère tapé
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      // Arrêter la frappe après 3 secondes d'inactivité
      typingTimeoutRef.current = setTimeout(() => {
        setIsTyping(false);
        stopTyping();
      }, TYPING_STOP_DELAY);
      
    } else {
      // Si le champ est vide, arrêter immédiatement la frappe
      if (isTyping) {
        setIsTyping(false);
        stopTyping();
      }
      
      // Nettoyer le timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
    }
  }, [isTyping, startTyping, stopTyping, TYPING_STOP_DELAY]);

  // Gestion des touches clavier pour l'envoi de message
  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    // Sur mobile, permettre les sauts de ligne avec Enter
    // L'utilisateur doit utiliser le bouton d'envoi pour envoyer
    if (isMobile) {
      // Ne rien faire, laisser le comportement par défaut (nouvelle ligne)
      return;
    }
    
    // Sur desktop, Enter envoie le message (sauf avec Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage, isMobile]);

  // ===== GESTION DES MESSAGES EN ÉCHEC =====
  
  // Handler pour restaurer un message en échec dans le compositeur
  const handleRestoreFailedMessage = useCallback((failedMsg: FailedMessage) => {
    console.log('🔄 Restauration du message en échec:', failedMsg.id);
    
    // Restaurer le contenu
    setNewMessage(failedMsg.content);
    
    // Restaurer la langue
    setSelectedLanguage(failedMsg.originalLanguage);
    
    // Restaurer les attachments
    if (failedMsg.attachmentIds.length > 0) {
      setAttachmentIds(failedMsg.attachmentIds);
    }
    
    // Restaurer le replyTo si présent
    if (failedMsg.replyTo) {
      useReplyStore.getState().setReplyingTo(failedMsg.replyTo as any);
    }
    
    // Focus sur le compositeur
    setTimeout(() => {
      if (messageComposerRef.current) {
        messageComposerRef.current.focus();
      }
    }, 100);
    
    toast.info(t('messageRestored') || 'Message restauré. Vous pouvez modifier et renvoyer.');
  }, [t]);

  // Handler pour renvoyer automatiquement un message en échec
  const handleRetryFailedMessage = useCallback(async (failedMsg: FailedMessage): Promise<boolean> => {
    console.log('🔄 Renvoi automatique du message:', failedMsg.id);
    
    if (!selectedConversation?.id || !user) {
      toast.error('Impossible de renvoyer: conversation ou utilisateur manquant');
      return false;
    }
    
    // Forcer la reconnexion WebSocket avant de renvoyer
    console.log('🔌 Vérification connexion WebSocket...');
    const diagnostics = meeshySocketIOService.getConnectionDiagnostics();
    if (!diagnostics.isConnected) {
      console.log('🔌 Reconnexion WebSocket nécessaire...');
      meeshySocketIOService.reconnect();
      // Attendre un peu que la reconnexion s'établisse
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    try {
      let success = false;
      
      // Envoyer avec ou sans attachments
      if (failedMsg.attachmentIds.length > 0 && sendMessageWithAttachmentsViaSocket) {
        // TODO: Ajouter mimeTypes dans FailedMessage store
        const mimeTypes: string[] = []; // Pour l'instant, tableau vide (sera déterminé côté serveur)
        success = await sendMessageWithAttachmentsViaSocket(
          failedMsg.content,
          failedMsg.attachmentIds,
          mimeTypes,
          failedMsg.originalLanguage,
          failedMsg.replyToId
        );
      } else {
        success = await sendMessageViaSocket(
          failedMsg.content,
          failedMsg.originalLanguage,
          failedMsg.replyToId
        );
      }
      
      if (success) {
        console.log('✅ Message renvoyé avec succès');
        return true;
      } else {
        console.error('❌ Échec du renvoi du message');
        return false;
      }
    } catch (error) {
      console.error('❌ Erreur lors du renvoi:', error);
      return false;
    }
  }, [selectedConversation?.id, user, sendMessageViaSocket, sendMessageWithAttachmentsViaSocket]);

  // Surveillance de l'état de connexion WebSocket
  useEffect(() => {
    const checkConnection = () => {
      const diagnostics = meeshySocketIOService.getConnectionDiagnostics();
      setConnectionStatus({
        isConnected: diagnostics.isConnected,
        hasSocket: diagnostics.hasSocket
      });
    };

    // Vérification initiale
    checkConnection();

    // Vérifier toutes les 2 secondes
    const interval = setInterval(checkConnection, 2000);

    return () => clearInterval(interval);
  }, []);

  // Reconnexion automatique si la connexion est perdue (AVEC PROTECTION CONTRE BOUCLE)
  useEffect(() => {
    // CORRECTION CRITIQUE: Empêcher les reconnexions répétées
    if (!connectionStatus.isConnected && connectionStatus.hasSocket && user) {
      // Ne tenter UNE SEULE reconnexion
      if (hasAttemptedReconnect.current) {
        return;
      }
      
      console.log('[ConversationLayout] Connexion perdue, tentative de reconnexion...');
      hasAttemptedReconnect.current = true;
      
      // Attendre un peu avant de reconnecter pour éviter les boucles
      const reconnectTimer = setTimeout(() => {
        if (!connectionStatus.isConnected) {
          meeshySocketIOService.reconnect();
          
          // Réinitialiser après 10 secondes pour permettre une nouvelle tentative si nécessaire
          setTimeout(() => {
            hasAttemptedReconnect.current = false;
          }, 10000);
        }
      }, 3000);

      return () => clearTimeout(reconnectTimer);
    }
    
    // Si la connexion est rétablie, réinitialiser le flag
    if (connectionStatus.isConnected) {
      hasAttemptedReconnect.current = false;
    }
  }, [connectionStatus.isConnected, connectionStatus.hasSocket, user]);

  // Effets - Charger les conversations seulement au montage initial
  const hasLoadedInitialConversations = useRef(false);

  useEffect(() => {
    if (user && !hasLoadedInitialConversations.current) {
      hasLoadedInitialConversations.current = true;
      refreshConversations();
      setSelectedLanguage(user.systemLanguage || 'fr');
    } else if (user && hasLoadedInitialConversations.current) {
      // Juste mettre à jour la langue si user change
      setSelectedLanguage(user.systemLanguage || 'fr');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]); // Dépendre SEULEMENT de l'ID du user, pas de l'objet complet


  // Charger une conversation directement si elle n'est pas dans la liste
  useEffect(() => {
    if (selectedConversationId && user && conversations.length > 0 && !selectedConversation?.id) {
      console.log(`[ConversationLayout-${instanceId}] Conversation non trouvée dans la liste, chargement direct:`, selectedConversationId);
      loadDirectConversation(selectedConversationId);
    }
  }, [selectedConversationId, user, conversations.length, selectedConversation?.id, loadDirectConversation, instanceId]);

  // Charger les participants quand la conversation change via URL
  // Utiliser une ref pour tracker l'ID précédent et éviter de clear les messages
  // quand c'est juste une mise à jour de l'objet conversation
  const previousConversationIdRef = useRef<string | null>(null);

  useEffect(() => {
    const currentId = selectedConversation?.id;
    const previousId = previousConversationIdRef.current;

    // Charger les participants seulement si l'ID a vraiment changé
    if (currentId && currentId !== previousId) {
      console.log(`[ConversationLayout-${instanceId}] Changement de conversation: ${previousId} → ${currentId}`);
      loadParticipants(currentId);
      // Vider les anciens messages SEULEMENT quand on change réellement de conversation
      clearMessages();
      previousConversationIdRef.current = currentId;

      // Marquer la conversation comme lue
      conversationsService.markAsRead(currentId).catch(error => {
        console.error(`[ConversationLayout-${instanceId}] Erreur lors du marquage comme lu:`, error);
      });
    } else if (currentId === previousId && currentId) {
      // Même conversation, pas de rechargement
      console.log(`[ConversationLayout-${instanceId}] Même conversation, pas de rechargement: ${currentId}`);
    } else if (!currentId && previousId) {
      // Pas de conversation sélectionnée (retour à la liste)
      console.log(`[ConversationLayout-${instanceId}] Retour à la liste, reset previousId`);
      previousConversationIdRef.current = null;
    }
  }, [selectedConversation?.id, loadParticipants, clearMessages, instanceId]);


  // Loader d'authentification
  if (isAuthChecking) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">{t('conversationLayout.authChecking')}</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <>
      {/* Mode mobile avec conversation ouverte - Layout plein écran */}
      {isMobile && selectedConversation ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-gray-950 overflow-hidden">
          {/* Header de conversation */}
          <header className="flex-shrink-0 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 shadow-md border-b-2 border-gray-200 dark:border-gray-700">
            <ConversationHeader
              conversation={selectedConversation}
              currentUser={user}
              conversationParticipants={participants}
              typingUsers={typingUsers.map(u => ({ userId: u.id, username: u.displayName, conversationId: selectedConversation.id, timestamp: Date.now() }))}
              isMobile={isMobile}
              onBackToList={handleBackToList}
              onOpenDetails={() => setIsDetailsOpen(true)}
              onParticipantRemoved={() => {}}
              onParticipantAdded={() => {}}
              onLinkCreated={() => {}}
              onStartCall={handleStartCall}
              onOpenGallery={() => setGalleryOpen(true)}
              t={t}
              showBackButton={!!selectedConversationId}
            />
            {/* Indicateur de connexion en mobile */}
            {!connectionStatus.isConnected && (
              <div className="px-4 py-2">
                <ConnectionStatusIndicator />
              </div>
            )}
          </header>

          {/* Zone des messages scrollable avec padding pour le composer */}
          <div ref={messagesScrollRef} className="flex-1 overflow-y-auto overflow-x-hidden bg-transparent pb-4 min-h-0">
            <ConversationMessages
              messages={messages}
              translatedMessages={messages as any}
              currentUser={user}
              userLanguage={user.systemLanguage}
              usedLanguages={usedLanguages}
              isLoadingMessages={isLoadingMessages}
              isLoadingMore={isLoadingMore}
              hasMore={hasMore}
              isMobile={isMobile}
              conversationType={(selectedConversation.type as any) === 'anonymous' ? 'direct' : (selectedConversation.type as any) === 'broadcast' ? 'public' : selectedConversation.type as any}
              scrollContainerRef={messagesScrollRef}
              userRole={user.role as UserRoleEnum}
              conversationId={selectedConversation.id}
              addTranslatingState={addTranslatingState}
              isTranslating={isTranslating}
              onEditMessage={handleEditMessage}
              onDeleteMessage={handleDeleteMessage}
              onReplyMessage={handleReplyMessage}
              onNavigateToMessage={handleNavigateToMessage}
              onImageClick={handleImageClick}
              onLoadMore={loadMore}
              t={t}
              tCommon={tCommon}
              reverseOrder={true}
            />
          </div>

          {/* Zone de saisie dans le flux au lieu de fixed */}
          <div
            className="flex-shrink-0 bg-white/98 dark:bg-gray-950/98 backdrop-blur-xl border-t-2 border-gray-200 dark:border-gray-700 shadow-2xl p-4"
            style={{
              paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
            }}
          >
            {/* Bannière des messages en échec */}
            {selectedConversation?.id && (
              <FailedMessageBanner
                conversationId={selectedConversation.id}
                onRetry={handleRetryFailedMessage}
                onRestore={handleRestoreFailedMessage}
              />
            )}

            <MessageComposer
              ref={messageComposerRef}
              value={newMessage}
              onChange={handleTyping}
              onSend={handleSendMessage}
              selectedLanguage={selectedLanguage}
              onLanguageChange={setSelectedLanguage}
              placeholder={t('conversationLayout.writeMessage')}
              onKeyPress={handleKeyPress}
              choices={languageChoices}
              onAttachmentsChange={handleAttachmentsChange}
              token={typeof window !== 'undefined' ? getAuthToken()?.value : undefined}
              userRole={user.role}
            />
          </div>

          {/* Sidebar des détails - Mobile en modal */}
          {isDetailsOpen && (
            <ConversationDetailsSidebar
              conversation={selectedConversation}
              currentUser={user}
              messages={messages}
              isOpen={isDetailsOpen}
              onClose={() => setIsDetailsOpen(false)}
            />
          )}
        </div>
      ) : (
        /* Mode desktop ou mobile sans conversation */
        <div className="flex flex-col bg-gradient-to-br from-blue-50 to-indigo-100 overflow-hidden h-screen">
          <DashboardLayout
            title={t('conversationLayout.conversations.title')}
            hideHeaderOnMobile={false}
            className="!bg-none !bg-transparent !h-full !min-h-0 !max-w-none !px-0 !overflow-hidden flex-1"
          >
            <div
              className={cn(
                "flex bg-transparent conversation-layout relative z-10 w-full h-full overflow-hidden",
                isMobile ? 'h-[calc(100vh-4rem)]' : 'h-full'
              )}
              role="application"
              aria-label={t('conversationLayout.conversations.title')}
            >
        {/* Liste des conversations - Sidebar gauche - Toujours visible en desktop, masquée en mobile si conversation sélectionnée */}
        {(!isMobile || !selectedConversationId) && (
          <aside 
            className={cn(
              "flex-shrink-0 bg-white dark:bg-gray-950 border-r-2 border-gray-200 dark:border-gray-800 transition-all duration-300 shadow-lg",
              isMobile ? (
                showConversationList 
                  ? "fixed top-16 left-0 right-0 bottom-0 z-40 w-full" 
                  : "hidden"
              ) : "relative w-80 lg:w-96 h-full"
            )}
            role="complementary"
            aria-label={t('conversationLayout.conversationsList')}
          >
          <ConversationList
            conversations={conversations}
            selectedConversation={selectedConversation}
            currentUser={user}
            isLoading={isLoading}
            isMobile={isMobile}
            showConversationList={showConversationList}
            onSelectConversation={handleSelectConversation}
            onCreateConversation={() => setIsCreateModalOpen(true)}
            onLinkCreated={loadConversations}
            t={t}
            hasMore={hasMoreConversations}
            isLoadingMore={isLoadingMoreConversations}
            onLoadMore={loadMoreConversations}
            tSearch={(key: string) => t(`search.${key}`)}
          />
          </aside>
        )}

        {/* Zone de conversation principale - Desktop uniquement */}
        <main 
          className={cn(
            "flex flex-col min-w-0",
            selectedConversationId ? "w-full h-full" : "flex-1 h-full"
          )}
          role="main"
          aria-label={selectedConversation ? t('conversationLayout.conversationWith', { name: selectedConversation.title }) : t('conversationLayout.selectConversation')}
        >
          
          {selectedConversation ? (
            <div className="flex flex-col w-full h-full bg-white dark:bg-gray-950 shadow-xl overflow-hidden">
              {/* Header de conversation */}
              <header className="flex-shrink-0 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 shadow-md border-b-2 border-gray-200 dark:border-gray-700 relative z-10" role="banner">
                <ConversationHeader
                  conversation={selectedConversation}
                  currentUser={user}
                  conversationParticipants={participants}
                  typingUsers={typingUsers.map(u => ({ userId: u.id, username: u.displayName, conversationId: selectedConversation.id, timestamp: Date.now() }))}
                  isMobile={false}
                  onBackToList={handleBackToList}
                  onOpenDetails={() => setIsDetailsOpen(true)}
                  onParticipantRemoved={() => {}}
                  onParticipantAdded={() => {}}
                  onLinkCreated={() => {}}
                  onStartCall={handleStartCall}
                  onOpenGallery={() => setGalleryOpen(true)}
                  t={t}
                  showBackButton={!!selectedConversationId}
                />
                {/* Indicateur de connexion en desktop */}
                {!connectionStatus.isConnected && (
                  <div className="px-6 py-2">
                    <ConnectionStatusIndicator />
                  </div>
                )}
              </header>

              {/* Zone des messages avec min-h-0 pour éviter débordement */}
              <div
                ref={messagesScrollRef}
                className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 bg-gradient-to-b from-gray-50/50 to-white dark:from-gray-900/50 dark:to-gray-950"
                role="region"
                aria-live="polite"
                aria-label={t('conversationLayout.messagesList')}
              >
                <ConversationMessages
                  messages={messages}
                  translatedMessages={messages as any}
                  currentUser={user}
                  userLanguage={user.systemLanguage}
                  usedLanguages={usedLanguages}
                  isLoadingMessages={isLoadingMessages}
                  isLoadingMore={isLoadingMore}
                  hasMore={hasMore}
                  isMobile={false}
                  conversationType={(selectedConversation.type as any) === 'anonymous' ? 'direct' : (selectedConversation.type as any) === 'broadcast' ? 'public' : selectedConversation.type as any}
                  scrollContainerRef={messagesScrollRef}
                  userRole={user.role as UserRoleEnum}
                  conversationId={selectedConversation.id}
                  addTranslatingState={addTranslatingState}
                  isTranslating={isTranslating}
                  onEditMessage={handleEditMessage}
                  onDeleteMessage={handleDeleteMessage}
                  onReplyMessage={handleReplyMessage}
                  onNavigateToMessage={handleNavigateToMessage}
                  onImageClick={handleImageClick}
                  onLoadMore={loadMore}
                  t={t}
                  tCommon={tCommon}
                  reverseOrder={true}
                />
              </div>

              {/* Zone de composition - Desktop - flex-shrink-0 pour hauteur fixe */}
              <div className="flex-shrink-0 bg-white/98 dark:bg-gray-950/98 backdrop-blur-xl border-t-2 border-gray-200 dark:border-gray-700 shadow-2xl p-6">
                {/* Bannière des messages en échec */}
                {selectedConversation?.id && (
                  <FailedMessageBanner
                    conversationId={selectedConversation.id}
                    onRetry={handleRetryFailedMessage}
                    onRestore={handleRestoreFailedMessage}
                  />
                )}

                  <MessageComposer
                    ref={messageComposerRef}
                    value={newMessage}
                    onChange={handleTyping}
                    onSend={handleSendMessage}
                    selectedLanguage={selectedLanguage}
                    onLanguageChange={setSelectedLanguage}
                    placeholder={t('conversationLayout.writeMessage')}
                    onKeyPress={handleKeyPress}
                    choices={languageChoices}
                    onAttachmentsChange={handleAttachmentsChange}
                    token={typeof window !== 'undefined' ? getAuthToken()?.value : undefined}
                    userRole={user.role}
                  />
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center p-4 bg-white dark:bg-gray-950 overflow-hidden">
              <ConversationEmptyState
                conversationsCount={conversations.length}
                onCreateConversation={() => setIsCreateModalOpen(true)}
                onLinkCreated={loadConversations}
                t={t}
              />
            </div>
          )}
        </main>

        {/* Sidebar des détails - Desktop seulement */}
        {selectedConversation && isDetailsOpen && (
          <ConversationDetailsSidebar
            conversation={selectedConversation}
            currentUser={user}
            messages={messages}
            isOpen={isDetailsOpen}
            onClose={() => setIsDetailsOpen(false)}
          />
        )}
      </div>

            {/* Modales */}
            <CreateConversationModal
              isOpen={isCreateModalOpen}
              onClose={() => setIsCreateModalOpen(false)}
              currentUser={user}
              onConversationCreated={(id, conv) => {
                setIsCreateModalOpen(false);
                if (conv) {
                  setConversations(prev => [conv, ...prev]);
                  handleSelectConversation(conv);
                }
              }}
            />
            </DashboardLayout>
        </div>
      )}
      
      {/* Galerie d'images - Disponible sur mobile et desktop */}
      {selectedConversation && (
        <AttachmentGallery
          conversationId={selectedConversation.id}
          initialAttachmentId={selectedAttachmentId || undefined}
          open={galleryOpen}
          onClose={() => setGalleryOpen(false)}
          onNavigateToMessage={handleNavigateToMessageFromGallery}
          token={typeof window !== 'undefined' ? getAuthToken()?.value : undefined}
          attachments={imageAttachments}
        />
      )}
    </>
  );
}
