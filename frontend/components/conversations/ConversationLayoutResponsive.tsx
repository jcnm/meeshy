'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUser } from '@/context/AppContext';
import { useMessaging } from '@/hooks/use-messaging';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
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
    containerRef: useRef<HTMLDivElement>(null)
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
    if (isNewConversation) {
      await refreshMessages();
    }
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

  const handleTranslation = useCallback((messageId: string, translations: TranslationData[]) => {
    console.log('🌐 [ConversationLayout] Traductions reçues pour message:', messageId, translations);
    
    // Incrémenter le compteur de traduction pour les traductions pertinentes
    const userLanguages = [
      user?.systemLanguage,
      user?.regionalLanguage,
      user?.customDestinationLanguage
    ].filter(Boolean);

    translations.forEach(translation => {
      if (userLanguages.includes(translation.targetLanguage)) {
        incrementTranslationCount(translation.targetLanguage);
      }
    });
  }, [user?.systemLanguage, user?.regionalLanguage, user?.customDestinationLanguage, incrementTranslationCount]);

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
    onConversationOnlineStats: handleConversationOnlineStats,
    onConversationJoined: handleConversationJoined,
    onConversationLeft: handleConversationLeft,
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

      // Sélectionner une conversation seulement si spécifiée dans l'URL
      const conversationIdFromUrl = searchParams.get('id') || selectedConversationId;
      if (conversationIdFromUrl) {
        let conversation = conversationsWithAny.find(c => c.id === conversationIdFromUrl);
        
        if (conversation) {
          setSelectedConversation(conversation);
        } else {
          // ID non trouvé, désélectionner
          setSelectedConversation(null);
        }
      } else {
        // Aucun ID dans l'URL, s'assurer qu'aucune conversation n'est sélectionnée
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

  // Effet pour charger les données initiales et gérer les changements d'URL
  useEffect(() => {
    if (user) {
      // Ne pas recharger les conversations si on vient juste d'en créer une
      const conversationIdFromUrl = searchParams.get('id');
      if (justCreatedConversation && conversationIdFromUrl === justCreatedConversation) {
        console.log('[CONVERSATION] Éviter le rechargement après création de conversation:', justCreatedConversation);
        // Réinitialiser le flag après un délai pour permettre les futurs rechargements
        setTimeout(() => setJustCreatedConversation(null), 2000);
        return;
      }
      
      loadData();
    }
  }, [user, loadData, searchParams, justCreatedConversation]);

  // Effet séparé pour gérer les changements de paramètres d'URL
  useEffect(() => {
    if (user && conversations.length > 0) {
      const conversationIdFromUrl = searchParams.get('id') || selectedConversationId;
      if (conversationIdFromUrl) {
        let conversation = conversations.find(c => c.id === conversationIdFromUrl);
        
        if (conversation && conversation.id !== selectedConversation?.id) {
          setSelectedConversation(conversation);
        } else if (!conversation) {
          setSelectedConversation(null);
        }
      } else {
        setSelectedConversation(null);
      }
    }
  }, [searchParams, selectedConversationId, conversations, user?.id, selectedConversation?.id]);

  // Sélectionner une conversation
  const handleSelectConversation = (conversation: Conversation) => {
    // Si c'est la même conversation, ne rien faire
    if (selectedConversation?.id === conversation.id) {
      return;
    }

    // Sélectionner la conversation
    setSelectedConversation(conversation);

    // Sur mobile, masquer la liste pour afficher les messages
    if (isMobile) {
      setShowConversationList(false);
    }

    // Mettre à jour l'URL
    router.push(`/conversations?id=${conversation.id}`, { scroll: false });
  };

  // Retour à la liste (mobile uniquement)
  const handleBackToList = () => {
    if (isMobile) {
      setShowConversationList(true);
      setSelectedConversation(null);
      router.push('/conversations', { scroll: false });
    }
  };

  // Envoyer un message (simplifié grâce au hook réutilisable)
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }

    if (!selectedConversation || !user) {
      return;
    }

    // Utiliser le hook réutilisable pour envoyer le message
    const success = await sendMessageToService('', selectedLanguage);

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
    if (!selectedConversation?.id) {
      clearMessages();
      return;
    }

    const isDifferentConversation = messages[0]?.conversationId && messages[0]?.conversationId !== selectedConversation.id;
    if (isDifferentConversation) {
      // Nettoyage des messages de l'ancienne conversation
      clearMessages();
    }

    const hasNoMessages = messages.length === 0;
    if (hasNoMessages || isDifferentConversation) {
      // Chargement des messages pour la conversation
      loadMessages(selectedConversation.id, true);
    }
  }, [selectedConversation?.id, loadMessages, clearMessages]);

  // Effet 2: marquer les messages comme lus quand une conversation est ouverte
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

  // Effet 3: chargement des participants uniquement quand l'ID de conversation change
  useEffect(() => {
    if (selectedConversation?.id) {
      loadConversationParticipants(selectedConversation.id);
    } else {
      setConversationParticipants([]);
    }
  }, [selectedConversation?.id, loadConversationParticipants]);

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
            : "h-[calc(100vh-8rem)]"
        )}>
          {/* Liste des conversations */}
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
                    conversationType={selectedConversation?.type || 'direct'}
                    userRole={(user.role as UserRoleEnum) || UserRoleEnum.USER}
                    conversationId={selectedConversation?.id}
                    addTranslatingState={addTranslatingState}
                    isTranslating={isTranslating}
                  onEditMessage={handleEditMessage}
                  onDeleteMessage={handleDeleteMessage}
                  t={t}
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
            
            // Rediriger vers la nouvelle conversation
            router.push(`/conversations?id=${conversationData.id}`);
            
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
              router.push(`/conversations?id=${newConversation.id}`);
              
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