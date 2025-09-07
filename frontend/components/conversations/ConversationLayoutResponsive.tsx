
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUser } from '@/context/AppContext';
import { useMessageSender } from '@/hooks/use-message-sender';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useTranslations } from '@/hooks/useTranslations';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  MessageSquare,
  Users,
  Plus,
  Calendar,
  ArrowLeft,
  Link2,
  Info
} from 'lucide-react';
import { toast } from 'sonner';
import type {
  Conversation,
  Message,
  TranslationData,
  SocketIOUser as User,
  ThreadMember
} from '@shared/types';
import { conversationsService } from '@/services/conversations.service';
import { BubbleMessage } from '@/components/common/bubble-message';
import { MessageComposer, MessageComposerRef } from '@/components/common/message-composer';
import { CreateLinkButtonV2 } from './create-link-button-v2';
import { CreateConversationModal } from './create-conversation-modal';
import { ConversationDetailsSidebar } from './conversation-details-sidebar';
import { cn } from '@/lib/utils';
import { translationService } from '@/services/translation.service';
import { messageTranslationService } from '@/services/message-translation.service';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { detectAll } from 'tinyld'; // Importation de tinyld pour la détection de langue
import { cleanTranslationOutput } from '@/utils/translation-cleaner';
import { socketIOUserToUser, createDefaultUser } from '@/utils/user-adapter';
import type { BubbleTranslation } from '@shared/types';
import { UserRoleEnum } from '@shared/types';
import { ConversationParticipants } from '@/components/conversations/conversation-participants';
import { ConversationParticipantsPopover } from '@/components/conversations/conversation-participants-popover';
import { CreateLinkButton } from '@/components/conversations/create-link-button';
import { getUserLanguageChoices } from '@/utils/user-language-preferences';
import { useMessageLoader } from '@/hooks/use-message-loader';
import { useConversationMessages } from '@/hooks/use-conversation-messages';
import { MessagesDisplay } from '@/components/common/messages-display';
import { messageService } from '@/services/message.service';


// Alias pour la compatibilité avec le code existant
type TranslatedMessage = Message & {
  translation?: BubbleTranslation;
  originalContent?: string;
  translatedContent?: string;
  targetLanguage?: string;
  isTranslated?: boolean;
  isTranslating?: boolean;
  showingOriginal?: boolean;
  translationError?: string;
  translationFailed?: boolean;
  translations?: TranslationData[];
};

interface ConversationLayoutResponsiveProps {
  selectedConversationId?: string;
}

export function ConversationLayoutResponsive({ selectedConversationId }: ConversationLayoutResponsiveProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAuthChecking } = useUser(); // user est garanti d'exister grâce au wrapper
  const { t } = useTranslations('conversationLayout'); // Use conversationLayout namespace
  const { t: tSearch } = useTranslations('conversationSearch');

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
  const [newMessage, setNewMessage] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('fr'); // Langue pour l'envoi des messages
  const [isLoading, setIsLoading] = useState(true);

  // États UI responsive
  const [showConversationList, setShowConversationList] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  // États modaux
  const [isCreateConversationModalOpen, setIsCreateConversationModalOpen] = useState(false);
  const [isDetailsSidebarOpen, setIsDetailsSidebarOpen] = useState(false);

  // Flag pour éviter de recharger les conversations juste après en avoir créé une
  const [justCreatedConversation, setJustCreatedConversation] = useState<string | null>(null);

  // États de filtrage
  const [searchFilter, setSearchFilter] = useState<string>('');
  // États typing (centralisés)
  interface TypingUserState {
    userId: string;
    username: string;
    conversationId: string;
    timestamp: number;
  }
  const [typingUsers, setTypingUsers] = useState<TypingUserState[]>([]);

  // Helper pour obtenir le rôle de l'utilisateur dans la conversation actuelle
  const getCurrentUserRole = useCallback((): UserRoleEnum => {
    if (!selectedConversation || !user?.id || !conversationParticipants.length) {
      return user?.role as UserRoleEnum || UserRoleEnum.USER;
    }

    const currentUserParticipant = conversationParticipants.find(p => p.userId === user.id);
    return currentUserParticipant?.role as UserRoleEnum || user?.role as UserRoleEnum || UserRoleEnum.USER;
  }, [selectedConversation, user?.id, user?.role, conversationParticipants]);

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

  // Hook pour le chargement des messages avec le nouveau hook factorized
  const {
    messages,
    translatedMessages,
    isLoadingMessages,
    loadMessages,
    clearMessages,
    addMessage,
    updateMessageTranslations
  } = useConversationMessages({
    currentUser: user!, // user est garanti d'exister après les checks
    conversationId: selectedConversation?.id
  });

  // Ref pour le scroll automatique vers le dernier message
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messageComposerRef = useRef<MessageComposerRef>(null);

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
    addMessage(message);

    // Mettre à jour la conversation avec le dernier message (optimisé et idempotent)
    setConversationsIfChanged(prev => prev.map(
      (conv) => conv.id === message.conversationId
        ? { ...conv, lastMessage: message, updatedAt: new Date() }
        : conv
    ));

    // Scroller vers le bas pour voir le nouveau message (optimisé)
    setTimeout(() => {
      try {
        const container = messagesContainerRef.current;
        if (container) {
          // Vérifier si l'utilisateur est déjà en bas de la conversation
          const isAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 100;
          if (isAtBottom) {
            container.scrollTop = container.scrollHeight;
          }
        }
      } catch (error) {
        // Erreur silencieuse pour le scroll automatique
      }
    }, 50);
  }, [selectedConversation?.id, addMessage, setConversationsIfChanged]);

  const handleTranslation = useCallback((messageId: string, translations: TranslationData[]) => {
    // Appliquer les traductions au message concerné via le loader commun
    updateMessageTranslations(messageId, translations);
  }, [updateMessageTranslations]);

  const handleMessageSent = useCallback((content: string, language: string) => {
    // Scroller vers le bas après l'envoi
    setTimeout(scrollToBottom, 200);
  }, []);

  const handleMessageFailed = useCallback((content: string, error: Error) => {
    console.error('❌ Échec d\'envoi du message:', { content: content.substring(0, 50) + '...', error });
    // Restaurer le message en cas d'erreur
    setNewMessage(content);
  }, []);

  // Hook de messagerie réutilisable basé sur BubbleStreamPage
  const {
    isSending,
    sendMessage: sendMessageToService,
    startTyping,
    stopTyping,
  } = useMessageSender({
    conversationId: selectedConversation?.id,
    currentUser: user!, // user est garanti d'exister
    onUserTyping: handleUserTyping, // Ajouter le gestionnaire de frappe
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

  // Fonction utilitaire pour obtenir le nom d'affichage d'une conversation
  const getConversationDisplayName = useCallback((conversation: Conversation): string => {
    if (conversation.isGroup) {
      return conversation.name || conversation.title || 'Groupe sans nom';
    } else {
      // Pour les conversations privées, afficher le nom de l'autre participant
      const otherParticipant = conversation.participants?.find(p => p.userId !== user?.id);
      if (otherParticipant?.user) {
        return otherParticipant.user.displayName ||
               `${otherParticipant.user.firstName} ${otherParticipant.user.lastName}` ||
               otherParticipant.user.username;
      }
      return conversation.name || conversation.title || 'Conversation privée';
    }
  }, [user]);

  // Fonction utilitaire pour obtenir l'avatar d'une conversation
  const getConversationAvatar = useCallback((conversation: Conversation): string => {
    if (conversation.isGroup) {
      return (conversation.name || conversation.title || 'G').slice(0, 2).toUpperCase();
    } else {
      // Pour les conversations privées, utiliser l'initiale de l'autre participant
      const otherParticipant = conversation.participants?.find(p => p.userId !== user?.id);
      if (otherParticipant?.user) {
        const displayName = otherParticipant.user.displayName ||
                           `${otherParticipant.user.firstName} ${otherParticipant.user.lastName}` ||
                           otherParticipant.user.username;
        return displayName.slice(0, 2).toUpperCase();
      }
      return 'C';
    }
  }, [user]);

  // Fonction utilitaire pour obtenir l'icône d'une conversation par type
  const getConversationIcon = useCallback((conversation: Conversation): React.ReactNode | null => {
    // Pour les conversations publiques et globales, utiliser des icônes spécifiques
    if (conversation.type === 'public') {
      return <Users className="h-6 w-6" />;
    }
    if (conversation.type === 'global') {
      return <Calendar className="h-6 w-6" />;
    }
    if (conversation.isGroup) {
      return <Users className="h-6 w-6" />;
    }
    return null; // Pour les conversations privées, on utilisera l'avatar
  }, []);

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

  // Fonction pour scroller vers le bas
  const scrollToBottom = useCallback((force = false) => {
    // Détection Safari
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    
    setTimeout(() => {
      if (isSafari || force) {
        // Pour Safari, utilisation directe de scrollTop qui est plus fiable
        if (messagesContainerRef.current) {
          messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
        }
      } else {
        // Pour les autres navigateurs, essai de scrollIntoView avec fallback
        if (messagesEndRef.current) {
          try {
            messagesEndRef.current.scrollIntoView({ 
              behavior: force ? 'auto' : 'smooth', 
              block: 'end' 
            });
          } catch (e) {
            // Fallback en cas d'erreur
            if (messagesContainerRef.current) {
              messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
            }
          }
        } else if (messagesContainerRef.current) {
          // Fallback: scroller le conteneur directement
          messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
        }
      }
    }, isSafari ? 150 : (force ? 50 : 100)); // Délai plus long pour Safari
  }, []);

  // Scroll automatique quand les messages changent
  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      
      // Si c'est notre propre message, forcer le scroll immédiatement
      if (lastMessage && lastMessage.senderId === user?.id) {
        // Scroll automatique vers le bas
        scrollToBottom(true);
      } else {
        // Scroll normal pour les autres messages
        scrollToBottom();
      }
    }
  }, [messages, user?.id, scrollToBottom]);


  // Handlers pour MessageBubble
  const handleTranslate = async (
    messageId: string,
    targetLanguage: string,
    forceRetranslate: boolean = false,
    forcedSourceLanguage?: string
  ) => {
    const message = messages.find(m => m.id === messageId);
    if (!message) return;

    try {
      // Traduction avec modèle sélectionné

      // Afficher un indicateur de traduction en cours
      toast.loading(t('toasts.messages.translationInProgress'), { id: `translate-${messageId}` });

      // Détecter la langue source si non fournie ou 'unknown'
      let sourceLanguage = forcedSourceLanguage || message.originalLanguage;
      if (!sourceLanguage || sourceLanguage === 'unknown') {
        const detections = detectAll(message.content);
        sourceLanguage = detections.length > 0 ? detections[0].lang : 'en'; // Fallback à 'en'
      }

      // Ajouter un délai pour permettre à l'interface de se mettre à jour
      await new Promise(resolve => setTimeout(resolve, 100));

      // Si forceRetranslate est true, afficher un message spécifique
      if (forceRetranslate) {
        // Forcer la retraduction du message
        toast.loading(t('toasts.messages.retranslationInProgress'), { id: `retranslate-${messageId}` });
      }

      const translationResult = await translationService.translateText({
        text: message.content,
        sourceLanguage: sourceLanguage,
        targetLanguage: targetLanguage,
        model: 'basic' as const // Utiliser un modèle basique par défaut
      });

      // Créer le message traduit avec toutes les propriétés requises
      const translatedMsg: TranslatedMessage = {
        ...message,
        originalLanguage: sourceLanguage, // Mettre à jour avec la langue détectée si applicable
        originalContent: message.content,
        translatedContent: cleanTranslationOutput(translationResult.translatedText),
        targetLanguage,
        isTranslated: true,
        isTranslating: false,
        showingOriginal: false,
        translationError: undefined,
        translationFailed: false,
        translations: [{
          messageId: messageId,
          sourceLanguage: message.originalLanguage || 'fr',
          targetLanguage: targetLanguage,
          translatedContent: cleanTranslationOutput(translationResult.translatedText),
          translationModel: 'basic', // Utiliser le modèle basique par défaut
          cacheKey: `${messageId}-${targetLanguage}`,
          cached: false
        }],
        sender: message.sender || createDefaultUser(message.senderId)
      };



              // Message traduit avec succès - Toast silencieux pour éviter le spam
      // toast.success(t('toasts.messages.translationSuccess', { model: selectedTranslationModel }), { id: `translate-${messageId}` });

    } catch (error) {
      console.error('❌ Erreur lors de la traduction:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erreur lors de la traduction du message';
      toast.error(errorMessage, { id: `translate-${messageId}` });
    }
  };

  const handleEdit = async (messageId: string, newContent: string) => {
    // Édition de message - Toast silencieux
    // toast.info(t('toasts.messages.editSoon'));
  };

  // Utilitaires
  const convertToTranslatedMessage = useCallback((message: Message): TranslatedMessage => {
    return {
      ...message,
      translatedContent: message.content,
      targetLanguage: user?.systemLanguage || 'fr',
    };
  }, [user?.systemLanguage]);

  

  // Charger les données initiales
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);

      // Démarrer le chargement des conversations immédiatement
      const conversationsData = await conversationsService.getConversations();

      // Utiliser directement les conversations récupérées depuis l'API
      // Le service de conversations doit inclure automatiquement la conversation "meeshy"
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
      console.error('❌ Erreur lors du chargement des conversations:', error);
      
      // Si c'est une erreur d'authentification, on peut essayer de rediriger
      if (error instanceof Error && (error.message.includes('401') || error.message.includes('Token invalide'))) {
        console.log('🔄 Erreur d\'authentification, redirection vers login...');
        router.push('/login');
        return;
      }

      // Afficher l'erreur à l'utilisateur
      toast.error(t('toasts.conversations.loadError'));
      
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

  // Debug: vérifier l'état de l'utilisateur (optionnel)
  useEffect(() => {
    if (user) {
      console.log('🔍 ConversationLayoutResponsive: Utilisateur chargé:', user.username);
    }
  }, [user?.id]);

  // Sélectionner une conversation
  const handleSelectConversation = (conversation: Conversation) => {
    // Si c'est la même conversation, ne rien faire
    if (selectedConversation?.id === conversation.id) {
      return;
    }

    // NOTE: La gestion WebSocket se fait dans l'useEffect séparé
    // Simplement sélectionner la conversation, l'effet se chargera du reste
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

    if (!newMessage.trim() || !selectedConversation || !user) {
      return;
    }

    const messageContent = newMessage.trim();
    setNewMessage(''); // Vider immédiatement pour éviter les doubles envois

    // Envoi du message

    // Utiliser le hook réutilisable pour envoyer le message
    // La gestion d'erreurs, les toasts, et la restauration du message sont gérés par le hook
    const success = await sendMessageToService(messageContent, selectedLanguage);

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
    } else {
      // Messages déjà chargés pour cette conversation, pas de rechargement
    }
  }, [selectedConversation?.id, loadMessages, clearMessages]); // Supprimé messages.length qui change constamment

  // Effet 2: chargement des participants uniquement quand l'ID de conversation change
  useEffect(() => {
    if (selectedConversation?.id) {
      loadConversationParticipants(selectedConversation.id);
    } else {
      setConversationParticipants([]);
    }
  }, [selectedConversation?.id, loadConversationParticipants]);

  return (
    <DashboardLayout title={t('conversations.title')}>

      {isLoading ? (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">{t('loadingConversations')}</p>
          </div>
        </div>
      ) : (
        <div className="h-[calc(100vh-6rem)] flex bg-transparent">
          {/* Liste des conversations */}
          <div className={cn(
            "flex flex-col bg-white/80 backdrop-blur-sm rounded-l-2xl border border-border/50 shadow-lg",
            isMobile ? (showConversationList ? "w-full" : "hidden") : "w-96"
          )}>
            {/* Header fixe */}
            <div className="flex-shrink-0 p-4 border-b border-border/30">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold text-foreground">{t('conversations.title')}</h2>
                </div>
                <div className="relative">
                  <MessageSquare className="h-6 w-6 text-primary" />
                  {conversations.filter(c => (c.unreadCount || 0) > 0).length > 0 && (
                    <div className="absolute -top-2 -right-2 h-5 w-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                      {conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0)}
                    </div>
                  )}
                </div>
              </div>

              {/* Champ de filtrage des conversations */}
              <div className="mb-2">
                <label className="text-sm font-medium text-muted-foreground mb-2 block">
                  {t('filtreConversations')}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder={tSearch('placeholder')}
                    className="w-full h-8 text-sm px-3 py-2 border border-border/30 rounded-lg bg-background/50 
                             placeholder:text-muted-foreground/50 focus:ring-2 focus:ring-primary/20 focus:border-primary/30 
                             transition-all outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Liste scrollable */}
            <div className="flex-1 overflow-y-auto">
              {/* Debug info */}
              {process.env.NODE_ENV === 'development' && (
                <div className="p-2 bg-yellow-100 text-yellow-800 text-xs">
                  {t('debug', { 
                    count: conversations.length, 
                    loading: isLoading ? t('yes') : t('no'), 
                    user: user ? t('connected') : t('notConnected') 
                  })}
                </div>
              )}
              
              {conversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                  <MessageSquare className="h-16 w-16 text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    {isLoading ? t('loadingConversations') : t('noConversations')}
                  </h3>
                  <p className="text-muted-foreground mb-6">
                    {isLoading 
                      ? t('loadingConversationsDescription')
                      : t('noConversationsDescription')
                    }
                  </p>
                </div>
              ) : (
                <div className="p-2">
                  {/* Séparer les conversations en publiques et privées avec filtrage */}
                  {(() => {
                    // Appliquer d'abord le filtre de recherche
                    const filteredConversations = conversations.filter(conv => {
                      if (!searchFilter) return true;
                      const searchLower = searchFilter.toLowerCase();
                      const name = getConversationDisplayName(conv).toLowerCase();
                      const description = conv.description?.toLowerCase() || '';
                      return name.includes(searchLower) || description.includes(searchLower);
                    });
                    
                    const publicConversations = filteredConversations.filter(conv => 
                      conv.type === 'global' || conv.type === 'public'
                    );
                    const privateConversations = filteredConversations.filter(conv => 
                      conv.type !== 'global' && conv.type !== 'public'
                    );

                    return (
                      <>
                        {/* Section Conversations Publiques */}
                        {publicConversations.length > 0 && (
                          <div className="mb-6">
                            <div className="px-4 py-2 mb-3">
                              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                                {t('public')}
                              </h3>
                            </div>
                            <div className="space-y-2">
                              {publicConversations
                                .filter(conversation => conversation && conversation.id) // Filtrer les conversations invalides
                                .map((conversation) => (
                                <div
                                  key={`public-${conversation.id}`}
                                  onClick={() => handleSelectConversation(conversation)}
                                  className={cn(
                                    "flex items-center p-4 rounded-2xl cursor-pointer transition-all border-2",
                                    selectedConversation?.id === conversation.id
                                      ? "bg-primary/20 border-primary/40 shadow-md"
                                      : "hover:bg-accent/50 border-transparent hover:border-border/30"
                                  )}
                                >
                                  <div className="relative">
                                    <Avatar className="h-12 w-12 ring-2 ring-primary/20">
                                      <AvatarImage />
                                      <AvatarFallback className="bg-primary/20 text-primary font-bold">
                                        {getConversationIcon(conversation) || getConversationAvatar(conversation)}
                                      </AvatarFallback>
                                    </Avatar>
                                    <div className="absolute -bottom-0 -right-0 h-4 w-4 bg-green-500 rounded-full border-2 border-background"></div>
                                  </div>

                                  <div className="ml-4 flex-1 min-w-0">
                                    <div className="flex items-center justify-between">
                                      <h3 className="font-bold text-foreground truncate">
                                        {getConversationDisplayName(conversation)}
                                      </h3>
                                      {conversation.lastMessage && (
                                        <span className="text-xs text-muted-foreground ml-2 flex-shrink-0">
                                          {new Date(conversation.lastMessage.createdAt).toLocaleTimeString('fr-FR', {
                                            hour: '2-digit',
                                            minute: '2-digit'
                                          })}
                                        </span>
                                      )}
                                    </div>
                                    {conversation.lastMessage && (
                                      <p className="text-sm text-muted-foreground truncate">
                                        {conversation.lastMessage.content}
                                      </p>
                                    )}
                                  </div>

                                  {(conversation.unreadCount || 0) > 0 && (
                                    <div className="ml-3 bg-primary text-primary-foreground text-xs rounded-full h-6 w-6 flex items-center justify-center font-bold shadow-sm">
                                      {conversation.unreadCount}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Section Conversations Privées */}
                        {privateConversations.length > 0 && (
                          <div className="mb-6">
                            <div className="px-4 py-2 mb-3">
                              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                                {t('private')}
                              </h3>
                            </div>
                            <div className="space-y-2">
                              {privateConversations
                                .filter(conversation => conversation && conversation.id) // Filtrer les conversations invalides
                                .map((conversation) => (
                                <div
                                  key={`private-${conversation.id}`}
                                  onClick={() => handleSelectConversation(conversation)}
                                  className={cn(
                                    "flex items-center p-4 rounded-2xl cursor-pointer transition-all border-2",
                                    selectedConversation?.id === conversation.id
                                      ? "bg-primary/20 border-primary/40 shadow-md"
                                      : "hover:bg-accent/50 border-transparent hover:border-border/30"
                                  )}
                                >
                                  <div className="relative">
                                    <Avatar className="h-12 w-12 ring-2 ring-primary/20">
                                      <AvatarImage />
                                      <AvatarFallback className="bg-primary/20 text-primary font-bold">
                                        {getConversationIcon(conversation) || getConversationAvatar(conversation)}
                                      </AvatarFallback>
                                    </Avatar>
                                    <div className="absolute -bottom-0 -right-0 h-4 w-4 bg-green-500 rounded-full border-2 border-background"></div>
                                  </div>

                                  <div className="ml-4 flex-1 min-w-0">
                                    <div className="flex items-center justify-between">
                                      <h3 className="font-bold text-foreground truncate">
                                        {getConversationDisplayName(conversation)}
                                      </h3>
                                      {conversation.lastMessage && (
                                        <span className="text-xs text-muted-foreground ml-2 flex-shrink-0">
                                          {new Date(conversation.lastMessage.createdAt).toLocaleTimeString('fr-FR', {
                                            hour: '2-digit',
                                            minute: '2-digit'
                                          })}
                                        </span>
                                      )}
                                    </div>
                                    {conversation.lastMessage && (
                                      <p className="text-sm text-muted-foreground truncate">
                                        {conversation.lastMessage.content}
                                      </p>
                                    )}
                                  </div>

                                  {(conversation.unreadCount || 0) > 0 && (
                                    <div className="ml-3 bg-primary text-primary-foreground text-xs rounded-full h-6 w-6 flex items-center justify-center font-bold shadow-sm">
                                      {conversation.unreadCount}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Footer fixe avec boutons */}
            <div className="flex-shrink-0 p-4 border-t border-border/30 bg-background/50">
              <div className="flex flex-col sm:flex-row gap-3">
                <CreateLinkButtonV2
                  className="flex-1 rounded-2xl h-12 bg-primary/10 hover:bg-primary/20 border-0 text-primary font-semibold"
                  onLinkCreated={() => {
                    loadData();
                  }}
                >
                  <Link2 className="h-5 w-5 mr-2" />
                  {t('createLink')}
                </CreateLinkButtonV2>
                <Button
                  className="flex-1 rounded-2xl h-12 bg-primary/10 hover:bg-primary/20 border-0 text-primary font-semibold"
                  onClick={() => setIsCreateConversationModalOpen(true)}
                >
                  <MessageSquare className="h-5 w-5 mr-2" />
                  {t('createConversation')}
                </Button>
              </div>
            </div>
          </div>

          {/* Zone de messages */}
          <div className={cn(
            "flex flex-col",
            isMobile ? (showConversationList ? "hidden" : "w-full") : "flex-1"
          )}>
            {selectedConversation ? (
              <>
                {/* En-tête de la conversation */}
                <div className="flex-shrink-0 p-4 border-b border-border/30 bg-white/90 backdrop-blur-sm rounded-tr-2xl">
                  <div className="flex items-center gap-3">
                    {isMobile && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleBackToList}
                        className="rounded-full h-10 w-10 p-0 hover:bg-accent/50"
                      >
                        <ArrowLeft className="h-5 w-5" />
                      </Button>
                    )}
                    <div className="relative">
                      <Avatar className="h-10 w-10 ring-2 ring-primary/20">
                        <AvatarImage />
                        <AvatarFallback className="bg-primary/20 text-primary font-bold">
                          {getConversationIcon(selectedConversation) || getConversationAvatar(selectedConversation)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="absolute -bottom-0 -right-0 h-3 w-3 bg-green-500 rounded-full border-2 border-background"></div>
                    </div>
                    <div className="flex-1">
                      <h2 className="font-bold text-lg text-foreground">
                        {getConversationDisplayName(selectedConversation)}
                      </h2>
                      <div className="text-sm text-muted-foreground">
                        <ConversationParticipants
                          conversationId={selectedConversation.id}
                          participants={conversationParticipants}
                          currentUser={user}
                          isGroup={selectedConversation.isGroup || false}
                          conversationType={selectedConversation.type}
                          typingUsers={typingUsers.map(u => ({ userId: u.userId, conversationId: u.conversationId }))}
                          className="mt-1"
                        />
                      </div>
                    </div>
                    
                    {/* Bouton pour créer un lien */}
                    <CreateLinkButton
                      conversationId={selectedConversation.id}
                      conversationType={selectedConversation.type}
                      userRole={user?.role as UserRoleEnum}
                      userConversationRole={getCurrentUserRole()}
                      onLinkCreated={(link) => {
                        // Lien créé
                      }}
                    />

                    {/* Bouton pour afficher les participants */}
                    <ConversationParticipantsPopover
                      conversationId={selectedConversation.id}
                      participants={conversationParticipants}
                      currentUser={user}
                      isGroup={selectedConversation.isGroup || false}
                      conversationType={selectedConversation.type}
                      userConversationRole={getCurrentUserRole()}
                      onParticipantRemoved={(userId) => {
                        console.log(t('participantRemoved', { userId }));
                        // Recharger les participants
                        loadConversationParticipants(selectedConversation.id);
                      }}
                      onParticipantAdded={(userId) => {
                        console.log(t('participantAdded', { userId }));
                        // Recharger les participants
                        loadConversationParticipants(selectedConversation.id);
                      }}
                      onLinkCreated={(link) => {
                        // Lien créé depuis popover
                      }}
                    />

                    {/* Bouton pour ouvrir les détails */}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setIsDetailsSidebarOpen(true)}
                      className="rounded-full h-10 w-10 p-0 hover:bg-accent/50"
                      title={t('conversationDetails')}
                    >
                      <Info className="h-5 w-5" />
                    </Button>
                  </div>
                </div>

                {/* Messages scrollables */}
                <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 bg-white/50 backdrop-blur-sm messages-container scroll-optimized scrollbar-thin">
                  <MessagesDisplay
                    messages={messages}
                    translatedMessages={translatedMessages}
                    isLoadingMessages={isLoadingMessages}
                    currentUser={user}
                    userLanguage={user.systemLanguage}
                    usedLanguages={[
                      user.regionalLanguage,
                      user.customDestinationLanguage
                    ].filter((lang): lang is string => Boolean(lang)).filter(lang => lang !== user.systemLanguage)}
                    emptyStateMessage={t('noMessages')}
                    emptyStateDescription={t('noMessagesDescription')}
                    reverseOrder={false}
                    className="space-y-4"
                    onEditMessage={handleEditMessage}
                    onDeleteMessage={handleDeleteMessage}
                    conversationType={selectedConversation?.type || 'direct'}
                    userRole={(user.role as UserRoleEnum) || UserRoleEnum.USER}
                    conversationId={selectedConversation?.id}
                  />
                  {/* Élément invisible pour le scroll automatique */}
                  <div ref={messagesEndRef} />
                </div>

                {/* Zone de saisie fixe en bas */}
                <div className="flex-shrink-0 p-4 border-t border-border/30 bg-white/90 backdrop-blur-sm rounded-br-2xl">
                  <MessageComposer
                    ref={messageComposerRef}
                    value={newMessage}
                    onChange={(value) => {
                      setNewMessage(value);
                      
                      // Gérer l'indicateur de frappe
                      if (value.trim()) {
                        startTyping();
                      } else {
                        stopTyping();
                      }
                    }}
                    onSend={handleSendMessage}
                    selectedLanguage={selectedLanguage}
                    onLanguageChange={setSelectedLanguage}
                    isComposingEnabled={!isSending}
                    placeholder={t('writeMessage')}
                    choices={user ? getUserLanguageChoices(user) : undefined}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    className="w-full"
                  />
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-white/50 backdrop-blur-sm rounded-r-2xl">
                <div className="max-w-md">
                  <div className="w-24 h-24 mx-auto mb-6 bg-primary/10 rounded-full flex items-center justify-center">
                    <MessageSquare className="h-12 w-12 text-primary" />
                  </div>

                  {conversations.length > 0 ? (
                    <>
                      <h3 className="text-xl font-bold text-foreground mb-2 text-center">{t('chooseConversation')}</h3>
                      <p className="text-muted-foreground text-base mb-6 text-center">
                        {t('chooseConversationDescription')}
                      </p>
                    </>
                  ) : (
                    <>
                      <h3 className="text-xl font-bold text-foreground mb-2 text-center">{t('welcome')}</h3>
                      <p className="text-muted-foreground text-base mb-6 text-center">
                        {t('welcomeDescription')}
                      </p>
                    </>
                  )}
                </div>

                {/* Boutons d'action dans l'état vide */}
                <div className="flex gap-4 justify-center">
                  <Button
                    onClick={() => setIsCreateConversationModalOpen(true)}
                    className="rounded-2xl px-6 py-3 bg-primary hover:bg-primary/90 text-white font-semibold shadow-md hover:shadow-lg transition-all"
                  >
                    <MessageSquare className="h-5 w-5 mr-2" />
                    {t('createConversation')}
                  </Button>
                  <CreateLinkButtonV2
                    variant="outline"
                    className="rounded-2xl px-6 py-3 border-2 border-primary/20 hover:border-primary/40 font-semibold shadow-md hover:shadow-lg transition-all"
                    onLinkCreated={() => {
                      loadData();
                    }}
                  >
                    <Link2 className="h-5 w-5 mr-2" />
                    {t('createLink')}
                  </CreateLinkButtonV2>
                </div>
              </div>
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
            // Ajout immédiat de la nouvelle conversation
            
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
              // Nouvelle conversation récupérée (fallback)
              
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
              toast.error(t('errorLoadingConversation'));
              setTimeout(() => {
                loadData();
              }, 1000);
            });
          }
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


