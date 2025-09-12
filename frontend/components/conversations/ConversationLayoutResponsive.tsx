
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUser } from '@/context/AppContext';
import { useMessageSender } from '@/hooks/use-message-sender';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useTranslations } from '@/hooks/useTranslations';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import {
  MessageSquare,
  Users,
  Plus,
  Calendar,
  ArrowLeft,
  Link2,
  Info,
  UserPlus
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
import { CreateLinkButton } from './create-link-button';
import { CreateLinkModalV2 as CreateLinkModal } from './create-link-modal';
import { CreateConversationModal } from './create-conversation-modal';
import { ConversationDetailsSidebar } from './conversation-details-sidebar';
import { translationService } from '@/services/translation.service';
import { messageTranslationService } from '@/services/message-translation.service';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { detectAll } from 'tinyld'; // Importation de tinyld pour la détection de langue
import { cleanTranslationOutput } from '@/utils/translation-cleaner';
import { socketIOUserToUser, createDefaultUser } from '@/utils/user-adapter';
import type { BubbleTranslation } from '@shared/types';
import { UserRoleEnum } from '@shared/types';
import { ConversationParticipants } from '@/components/conversations/conversation-participants';
import { ConversationParticipantsPopover } from '@/components/conversations/conversation-participants-popover';
import { getUserLanguageChoices } from '@/utils/user-language-preferences';
import { useMessageLoader } from '@/hooks/use-message-loader';
import { useConversationMessages } from '@/hooks/use-conversation-messages';
import { useTranslationStats } from '@/hooks/use-translation-stats';
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
  
  // États pour les onglets et filtres
  const [activeTab, setActiveTab] = useState<'public' | 'private'>('public');
  const [publicSearchFilter, setPublicSearchFilter] = useState('');
  const [privateSearchFilter, setPrivateSearchFilter] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('fr'); // Langue pour l'envoi des messages
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

  // États de filtrage (maintenant gérés par onglet)
  
  // Fonctions helper pour filtrer les conversations
  const getFilteredPublicConversations = useCallback(() => {
    const publicConversations = conversations.filter(conv => 
      conv.type === 'global' || conv.type === 'public'
    );
    
    if (!publicSearchFilter) return publicConversations;
    
    const searchLower = publicSearchFilter.toLowerCase();
    return publicConversations.filter(conv => {
      const name = getConversationDisplayName(conv).toLowerCase();
      const description = conv.description?.toLowerCase() || '';
      return name.includes(searchLower) || description.includes(searchLower);
    });
  }, [conversations, publicSearchFilter]);

  const getFilteredPrivateConversations = useCallback(() => {
    const privateConversations = conversations.filter(conv => 
      conv.type !== 'global' && conv.type !== 'public'
    );
    
    if (!privateSearchFilter) return privateConversations;
    
    const searchLower = privateSearchFilter.toLowerCase();
    return privateConversations.filter(conv => {
      const name = getConversationDisplayName(conv).toLowerCase();
      const description = conv.description?.toLowerCase() || '';
      return name.includes(searchLower) || description.includes(searchLower);
    });
  }, [conversations, privateSearchFilter]);

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
    return currentUserParticipant?.conversationRole as UserRoleEnum || user?.role as UserRoleEnum || UserRoleEnum.USER;
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
    updateMessageTranslations,
    addTranslatingState,
    removeTranslatingState,
    isTranslating
  } = useConversationMessages({
    currentUser: user!, // user est garanti d'exister après les checks
    conversationId: selectedConversation?.id
  });

  // Hook pour les statistiques de traduction
  const { stats: translationStats, incrementTranslationCount } = useTranslationStats();

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
  }, [updateMessageTranslations, user?.systemLanguage, user?.regionalLanguage, user?.customDestinationLanguage, incrementTranslationCount]);

  const handleMessageSent = useCallback((content: string, language: string) => {
    // Scroller vers le bas après l'envoi
    setTimeout(scrollToBottom, 200);
  }, []);

  const handleMessageFailed = useCallback((content: string, error: Error) => {
    console.error('Échec d\'envoi du message:', { content: content.substring(0, 50) + '...', error });
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
    // Déterminer si c'est une conversation directe
    const isDirectConversation = conversation.type === 'direct' || 
                                 (!conversation.isGroup && conversation.participants?.length === 2) ||
                                 (!conversation.isGroup && !conversation.name && !conversation.title);

    if (!isDirectConversation) {
      // Pour les groupes, utiliser le nom ou titre
      return conversation.name || conversation.title || 'Groupe sans nom';
    } else {
      // Pour les conversations directes, d'abord essayer les participants
      const otherParticipant = conversation.participants?.find(p => p.userId !== user?.id);
      if (otherParticipant?.user) {
        const displayName = otherParticipant.user.displayName ||
               `${otherParticipant.user.firstName || ''} ${otherParticipant.user.lastName || ''}`.trim() ||
               otherParticipant.user.username;
        
        if (displayName) {
          return displayName;
        }
      }
      
      // Fallback : nettoyer le nom de la conversation
      const conversationName = conversation.name || conversation.title;
      if (conversationName && conversationName !== 'Conversation privée') {
        // Nettoyer les noms formatés par l'API
        let cleanName = conversationName;
        
        // Supprimer "Conversation avec" au début
        if (cleanName.startsWith('Conversation avec ')) {
          cleanName = cleanName.replace('Conversation avec ', '');
        }
        
        // Pour les noms avec "&", prendre seulement la première partie (l'interlocuteur)
        if (cleanName.includes(' & ')) {
          const parts = cleanName.split(' & ');
          // Prendre la partie qui n'est pas l'utilisateur actuel
          const currentUserName = user?.displayName || `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || user?.username;
          cleanName = parts.find(part => part.trim() !== currentUserName) || parts[0];
        }
        
        // Pour les noms séparés par des virgules, filtrer l'utilisateur actuel
        if (cleanName.includes(', ')) {
          const names = cleanName.split(', ');
          const currentUserName = user?.displayName || `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || user?.username;
          
          // Filtrer les noms pour exclure l'utilisateur actuel
          const otherNames = names.filter(name => name.trim() !== currentUserName);
          
          // Prendre le premier nom qui n'est pas l'utilisateur actuel
          cleanName = otherNames.length > 0 ? otherNames[0] : names[0];
        }
        
        // Vérification finale : si le nom nettoyé correspond à l'utilisateur actuel, essayer de trouver un autre nom
        const currentUserName = user?.displayName || `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || user?.username;
        if (cleanName.trim() === currentUserName) {
          // Si c'est l'utilisateur actuel, retourner "Conversation privée" 
          return 'Conversation privée';
        }
        
        return cleanName.trim();
      }
      
      return 'Conversation privée';
    }
  }, [user]);

  // Fonction spécifique pour obtenir le nom d'affichage dans l'en-tête (utilise les participants chargés)
  const getConversationHeaderName = useCallback((conversation: Conversation): string => {
    if (conversation.type !== 'direct') {
      return conversation.name || conversation.title || 'Groupe sans nom';
    } else {
      // Pour les conversations directes, utiliser les participants chargés
      const otherParticipant = conversationParticipants.find(p => p.userId !== user?.id);
      if (otherParticipant?.user) {
        // Prioriser le displayName, sinon prénom/nom, sinon username
        return otherParticipant.user.displayName ||
               `${otherParticipant.user.firstName || ''} ${otherParticipant.user.lastName || ''}`.trim() ||
               otherParticipant.user.username;
      }
      return conversation.name || conversation.title || 'Conversation privée';
    }
  }, [user, conversationParticipants]);

  // Fonction pour tronquer le nom d'affichage avec plus de caractères
  // Fonction utilitaire pour obtenir l'avatar d'une conversation
  const getConversationAvatar = useCallback((conversation: Conversation): string => {
    // Déterminer si c'est une conversation directe
    const isDirectConversation = conversation.type === 'direct' || 
                                 (!conversation.isGroup && conversation.participants?.length === 2) ||
                                 (!conversation.isGroup && !conversation.name && !conversation.title);

    if (!isDirectConversation) {
      // Pour les groupes, utiliser le nom ou titre
      const groupName = conversation.name || conversation.title || 'Groupe';
      return groupName.slice(0, 2).toUpperCase();
    } else {
      // Pour les conversations directes, d'abord essayer les participants
      const otherParticipant = conversation.participants?.find(p => p.userId !== user?.id);
      if (otherParticipant?.user) {
        const displayName = otherParticipant.user.displayName ||
               `${otherParticipant.user.firstName || ''} ${otherParticipant.user.lastName || ''}`.trim() ||
               otherParticipant.user.username;
        
        if (displayName) {
          return displayName.slice(0, 2).toUpperCase();
        }
      }
      
      // Fallback : utiliser le nom nettoyé de la conversation (même logique que getConversationDisplayName)
      const conversationName = conversation.name || conversation.title;
      if (conversationName && conversationName !== 'Conversation privée') {
        let cleanName = conversationName;
        
        // Supprimer "Conversation avec" au début
        if (cleanName.startsWith('Conversation avec ')) {
          cleanName = cleanName.replace('Conversation avec ', '');
        }
        
        // Pour les noms avec "&", prendre seulement la première partie (l'interlocuteur)
        if (cleanName.includes(' & ')) {
          const parts = cleanName.split(' & ');
          // Prendre la partie qui n'est pas l'utilisateur actuel
          const currentUserName = user?.displayName || `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || user?.username;
          cleanName = parts.find(part => part.trim() !== currentUserName) || parts[0];
        }
        
        // Pour les noms séparés par des virgules, filtrer l'utilisateur actuel
        if (cleanName.includes(', ')) {
          const names = cleanName.split(', ');
          const currentUserName = user?.displayName || `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || user?.username;
          
          // Filtrer les noms pour exclure l'utilisateur actuel
          const otherNames = names.filter(name => name.trim() !== currentUserName);
          
          // Prendre le premier nom qui n'est pas l'utilisateur actuel
          cleanName = otherNames.length > 0 ? otherNames[0] : names[0];
        }
        
        // Vérification finale : si le nom nettoyé correspond à l'utilisateur actuel, utiliser initiales par défaut
        const currentUserName = user?.displayName || `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || user?.username;
        if (cleanName.trim() === currentUserName) {
          return 'CP'; // Conversation Privée
        }
        
        return cleanName.trim().slice(0, 2).toUpperCase();
      }
      
      return 'CP'; // Conversation Privée
    }
  }, [user]);

  // Fonction pour obtenir l'URL de l'avatar d'une conversation
  const getConversationAvatarUrl = useCallback((conversation: Conversation): string | undefined => {
    // Déterminer si c'est une conversation directe
    const isDirectConversation = conversation.type === 'direct' || 
                                 (!conversation.isGroup && conversation.participants?.length === 2) ||
                                 (!conversation.isGroup && !conversation.name && !conversation.title);

    if (isDirectConversation) {
      // Pour les conversations privées, utiliser l'avatar de l'autre participant
      const otherParticipant = conversation.participants?.find(p => p.userId !== user?.id);
      if (otherParticipant?.user?.avatar) {
        return otherParticipant.user.avatar;
      }
    }
    // Pour les groupes, on pourrait avoir un avatar de groupe dans le futur
    return undefined;
  }, [user]);

  // Fonction de debug pour comprendre comment je récupère les destinataires
  const debugConversationData = useCallback((conversation: Conversation) => {
    console.log('=== DEBUG CONVERSATION ===');
    console.log('Conversation ID:', conversation.id);
    console.log('Conversation type:', conversation.type);
    console.log('Conversation isGroup:', conversation.isGroup);
    console.log('Conversation name:', conversation.name);
    console.log('Conversation title:', conversation.title);
    console.log('Participants:', conversation.participants);
    console.log('Current user:', user);
    console.log('Other participant:', conversation.participants?.find(p => p.userId !== user?.id));
    console.log('Display name from getConversationDisplayName:', getConversationDisplayName(conversation));
    console.log('Avatar initials from getConversationAvatar:', getConversationAvatar(conversation));
    console.log('=========================');
  }, [user, getConversationDisplayName, getConversationAvatar]);

  // Fonction utilitaire pour obtenir l'icône d'une conversation par type
  const getConversationIcon = useCallback((conversation: Conversation): React.ReactNode | null => {
    // Pour les conversations publiques et globales, utiliser des icônes spécifiques
    if (conversation.type === 'public') {
      return <Users className="h-6 w-6" />;
    }
    if (conversation.type === 'global') {
      return <Calendar className="h-6 w-6" />;
    }
    if (conversation.type !== 'direct') {
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
      console.log(t('toasts.messages.translationInProgress'));

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
        console.log(t('toasts.messages.retranslationInProgress'));
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
      console.error('Erreur lors de la traduction:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erreur lors de la traduction du message';
      console.error(errorMessage);
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

  // Debug: vérifier l'état de l'utilisateur (optionnel)
  useEffect(() => {
    if (user) {
      console.log('ConversationLayoutResponsive: Utilisateur chargé:', user.username);
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
          "h-[calc(100vh-6rem)] flex bg-transparent",
          isMobile && "conversation-listing-mobile"
        )}>
          {/* Liste des conversations */}
          <div className={cn(
            "flex flex-col bg-white/80 backdrop-blur-sm rounded-l-2xl border border-border/50 shadow-lg",
            isMobile ? (showConversationList ? "w-full conversation-list-mobile" : "hidden") : "w-96"
          )}>
            {/* Header fixe */}
            <div className="flex-shrink-0 p-4 border-b border-border/30">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold text-foreground">{t('conversations.title')}</h2>
                </div>
                <div className="flex items-center gap-2">
                  {/* Bouton pour créer une nouvelle conversation */}
                  <div className="relative">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsCreateConversationModalOpen(true)}
                      className="h-8 w-8 p-0 rounded-full hover:bg-accent/50 border border-border/30 hover:border-primary/50 transition-colors"
                      title={t('createNewConversation')}
                    >
                      <MessageSquare className="h-5 w-5 text-primary" />
                    </Button>
                    {/* Pastille pour les messages non lus */}
                    {(() => {
                      const totalUnread = conversations.reduce((sum, conv) => sum + (conv.unreadCount || 0), 0);
                      return totalUnread > 0 ? (
                        <Badge 
                          variant="destructive" 
                          className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0 flex items-center justify-center text-xs font-bold shadow-lg"
                        >
                          {totalUnread > 99 ? '99+' : totalUnread}
                        </Badge>
                      ) : null;
                    })()}
                  </div>
                  
                  {/* Bouton pour créer un nouveau lien - toujours disponible pour les administrateurs */}
                  <CreateLinkButton
                    onLinkCreated={() => {
                      // Lien créé depuis l'en-tête
                      loadData();
                    }}
                    forceModal={true}
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 rounded-full hover:bg-accent/50 border border-border/30 hover:border-primary/50 transition-colors"
                  >
                    <Link2 className="h-5 w-5 text-primary" />
                  </CreateLinkButton>
                </div>
              </div>

            </div>

            {/* Section fixe avec onglets et champs de recherche */}
            {conversations.length > 0 && (
              <div className="flex-shrink-0 mx-2">
                <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'public' | 'private')} className="w-full">
                  <TabsList className="grid w-full grid-cols-2 mt-2">
                    <TabsTrigger value="public" className="flex items-center gap-1 text-xs px-2">
                      <span>{t('public')}</span>
                      <span className="text-xs">({getFilteredPublicConversations().length})</span>
                    </TabsTrigger>
                    <TabsTrigger value="private" className="flex items-center gap-1 text-xs px-2">
                      <span>{t('private')}</span>
                      <span className="text-xs">({getFilteredPrivateConversations().length})</span>
                    </TabsTrigger>
                  </TabsList>
                  
                  {/* Champ de recherche fixe pour l'onglet actif */}
                  <div className="mt-2">
                    {activeTab === 'public' ? (
                      <input
                        type="text"
                        value={publicSearchFilter}
                        onChange={(e) => setPublicSearchFilter(e.target.value)}
                        placeholder={tSearch('placeholder')}
                        className="w-full h-8 text-sm px-3 py-2 border border-border/30 rounded-lg bg-background/50 
                                 placeholder:text-muted-foreground/50 focus:ring-2 focus:ring-primary/20 focus:border-primary/30 
                                 transition-all outline-none"
                      />
                    ) : (
                      <input
                        type="text"
                        value={privateSearchFilter}
                        onChange={(e) => setPrivateSearchFilter(e.target.value)}
                        placeholder={tSearch('placeholder')}
                        className="w-full h-8 text-sm px-3 py-2 border border-border/30 rounded-lg bg-background/50 
                                 placeholder:text-muted-foreground/50 focus:ring-2 focus:ring-primary/20 focus:border-primary/30 
                                 transition-all outline-none"
                      />
                    )}
                  </div>
                </Tabs>
              </div>
            )}

            {/* Liste scrollable */}
            <div className="flex-1 overflow-y-auto mx-2 pb-20">
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
                  {/* Liste des conversations publiques */}
                  {activeTab === 'public' && (
                    <>
                      {getFilteredPublicConversations().length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-8 text-center">
                          <MessageSquare className="h-12 w-12 text-muted-foreground/50 mb-3" />
                          <p className="text-muted-foreground text-sm">
                            {publicSearchFilter ? t('noPublicConversationsFound') : t('noPublicConversations')}
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {getFilteredPublicConversations()
                            .filter(conversation => conversation && conversation.id)
                            .map((conversation) => (
                            <div
                              key={`public-${conversation.id}`}
                              onClick={() => {
                                debugConversationData(conversation);
                                handleSelectConversation(conversation);
                              }}
                              className={cn(
                                "flex items-center p-4 rounded-2xl cursor-pointer transition-all border-2 conversation-list-item mobile-compact",
                                selectedConversation?.id === conversation.id
                                  ? "bg-primary/20 border-primary/40 shadow-md"
                                  : "hover:bg-accent/50 border-transparent hover:border-border/30"
                              )}
                            >
                              <div className="relative">
                                <Avatar className={cn("ring-2 ring-primary/20", isMobile ? "mobile-avatar conversation-list-avatar" : "h-12 w-12 conversation-list-avatar")}>
                                  <AvatarImage src={getConversationAvatarUrl(conversation)} />
                                  <AvatarFallback className="bg-primary/20 text-primary font-bold flex items-center justify-center text-center">
                                    {getConversationIcon(conversation) || getConversationAvatar(conversation)}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="absolute -bottom-0 -right-0 h-4 w-4 bg-green-500 rounded-full border-2 border-background"></div>
                              </div>

                              <div className={cn("ml-2 flex-1 relative", isMobile ? "conversation-content-mobile min-w-0" : "min-w-0")}>
                                {/* Date positionnée absolument en haut à droite */}
                                <div className="absolute top-0 right-0 flex flex-col items-end gap-1 z-10">
                                  {conversation.lastMessage && (
                                    <span className={cn("text-muted-foreground timestamp bg-background/80 px-1 rounded", isMobile ? "mobile-text-xs" : "text-xs")}>
                                      {new Date(conversation.lastMessage.createdAt).toLocaleTimeString('fr-FR', {
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      })}
                                    </span>
                                  )}
                                </div>
                                
                                {/* Contenu principal prenant toute la largeur */}
                                <div className="w-full pr-16"> {/* pr-16 pour laisser de l'espace à la date */}
                                  <h3 className={cn(
                                    "font-bold text-foreground text-left leading-tight", 
                                    isMobile 
                                      ? "mobile-text-base conversation-title-mobile" 
                                      : "conversation-title-desktop"
                                  )}>
                                    {getConversationDisplayName(conversation)}
                                  </h3>
                                  {conversation.lastMessage && (
                                    <p className={cn("text-muted-foreground mt-1", isMobile ? "mobile-text-sm" : "text-sm")} 
                                       style={{
                                         display: '-webkit-box',
                                         WebkitLineClamp: 2,
                                         WebkitBoxOrient: 'vertical',
                                         overflow: 'hidden'
                                       }}>
                                      {conversation.lastMessage.content}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}

                  {/* Liste des conversations privées */}
                  {activeTab === 'private' && (
                    <>
                      {getFilteredPrivateConversations().length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-8 text-center">
                          <MessageSquare className="h-12 w-12 text-muted-foreground/50 mb-3" />
                          <p className="text-muted-foreground text-sm">
                            {privateSearchFilter ? t('noPrivateConversationsFound') : t('noPrivateConversations')}
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {getFilteredPrivateConversations()
                            .filter(conversation => conversation && conversation.id)
                            .map((conversation) => (
                            <div
                              key={`private-${conversation.id}`}
                              onClick={() => {
                                debugConversationData(conversation);
                                handleSelectConversation(conversation);
                              }}
                              className={cn(
                                "flex items-center p-4 rounded-2xl cursor-pointer transition-all border-2 conversation-list-item mobile-compact",
                                selectedConversation?.id === conversation.id
                                  ? "bg-primary/20 border-primary/40 shadow-md"
                                  : "hover:bg-accent/50 border-transparent hover:border-border/30"
                              )}
                            >
                              <div className="relative">
                                <Avatar className={cn("ring-2 ring-primary/20", isMobile ? "mobile-avatar conversation-list-avatar" : "h-12 w-12 conversation-list-avatar")}>
                                  <AvatarImage src={getConversationAvatarUrl(conversation)} />
                                  <AvatarFallback className="bg-primary/20 text-primary font-bold flex items-center justify-center text-center">
                                    {getConversationIcon(conversation) || getConversationAvatar(conversation)}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="absolute -bottom-0 -right-0 h-4 w-4 bg-green-500 rounded-full border-2 border-background"></div>
                              </div>

                              <div className={cn("ml-2 flex-1 relative", isMobile ? "conversation-content-mobile min-w-0" : "min-w-0")}>
                                {/* Date positionnée absolument en haut à droite */}
                                <div className="absolute top-0 right-0 flex flex-col items-end gap-1 z-10">
                                  {conversation.lastMessage && (
                                    <span className={cn("text-muted-foreground timestamp bg-background/80 px-1 rounded", isMobile ? "mobile-text-xs" : "text-xs")}>
                                      {new Date(conversation.lastMessage.createdAt).toLocaleTimeString('fr-FR', {
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      })}
                                    </span>
                                  )}
                                </div>
                                
                                {/* Contenu principal prenant toute la largeur */}
                                <div className="w-full pr-16"> {/* pr-16 pour laisser de l'espace à la date */}
                                  <h3 className={cn(
                                    "font-bold text-foreground text-left leading-tight", 
                                    isMobile 
                                      ? "mobile-text-base conversation-title-mobile" 
                                      : "conversation-title-desktop"
                                  )}>
                                    {getConversationDisplayName(conversation)}
                                  </h3>
                                  {conversation.lastMessage && (
                                    <p className={cn("text-muted-foreground mt-1", isMobile ? "mobile-text-sm" : "text-sm")} 
                                       style={{
                                         display: '-webkit-box',
                                         WebkitLineClamp: 2,
                                         WebkitBoxOrient: 'vertical',
                                         overflow: 'hidden'
                                       }}>
                                      {conversation.lastMessage.content}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Bouton pour créer une nouvelle conversation après le contenu */}
            {conversations.length > 0 && (
              <div className="flex-shrink-0 p-4">
                <Button
                  onClick={() => setIsCreateConversationModalOpen(true)}
                  className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center gap-2"
                >
                  <MessageSquare className="h-5 w-5" />
                  {t('createNewConversation')}
                </Button>
              </div>
            )}

          </div>

          {/* Zone de messages */}
          <div className={cn(
            "flex flex-col",
            isMobile ? (showConversationList ? "hidden" : "w-full") : "flex-1"
          )}>
            {selectedConversation ? (
              <>
                {/* En-tête de la conversation */}
                <div className="flex-shrink-0 p-4 border-b border-border/30 bg-white/90 backdrop-blur-sm rounded-tr-2xl conversation-header-mobile">
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
                      <Avatar className={cn("ring-2 ring-primary/20", isMobile ? "mobile-avatar-large" : "h-10 w-10")}>
                        <AvatarImage src={getConversationAvatarUrl(selectedConversation)} />
                        <AvatarFallback className="bg-primary/20 text-primary font-bold flex items-center justify-center">
                          {getConversationIcon(selectedConversation) || getConversationAvatar(selectedConversation)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="absolute -bottom-0 -right-0 h-3 w-3 bg-green-500 rounded-full border-2 border-background"></div>
                    </div>
                    
                    <div className="flex-1">
                      <h2 className={cn(
                        "font-bold text-foreground",
                        isMobile ? "direct-conversation-title" : "text-lg",
                        selectedConversation.type !== 'direct' && "conversation-title"
                      )}>
                        {getConversationHeaderName(selectedConversation)}
                      </h2>
                      <div className={cn("text-muted-foreground", isMobile ? "mobile-text-sm" : "text-sm")}>
                        <ConversationParticipants
                          conversationId={selectedConversation.id}
                          participants={conversationParticipants}
                          currentUser={user}
                          isGroup={selectedConversation.type !== 'direct'}
                          conversationType={selectedConversation.type}
                          typingUsers={typingUsers.map(u => ({ userId: u.userId, conversationId: u.conversationId }))}
                          className="mt-1"
                        />
                      </div>
                    </div>
                    
                    {/* Boutons d'action rapides - masqués sur mobile */}
                    <div className="hidden md:flex items-center gap-1">
                      
                      {/* Bouton pour ajouter un participant */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 rounded-full hover:bg-accent/50 border border-border/30 hover:border-primary/50 transition-colors"
                        title={t('addParticipant')}
                        onClick={() => {
                          // Ouvrir le modal d'invitation
                          // TODO: Implémenter l'ouverture du modal d'invitation
                        }}
                      >
                        <UserPlus className="h-4 w-4 text-primary" />
                      </Button>
                    </div>
                    
                    {/* Bouton pour afficher les participants */}
                    <ConversationParticipantsPopover
                      conversationId={selectedConversation.id}
                      participants={conversationParticipants}
                      currentUser={user}
                      isGroup={selectedConversation.type !== 'direct'}
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
                <div ref={messagesContainerRef} className={cn(
                  "flex-1 overflow-y-auto p-4 bg-white/50 backdrop-blur-sm messages-container scroll-optimized scrollbar-thin",
                  isMobile && "conversation-container-mobile conversation-messages-mobile"
                )}>
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
                    addTranslatingState={addTranslatingState}
                    isTranslating={isTranslating}
                  />
                  {/* Élément invisible pour le scroll automatique */}
                  <div ref={messagesEndRef} />
                </div>

                {/* Zone de saisie fixe en bas */}
                <div className={cn(
                  "flex-shrink-0 p-4 border-t border-border/30 bg-white/90 backdrop-blur-sm rounded-br-2xl",
                  isMobile && "conversation-input-mobile"
                )}>
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
                  <CreateLinkButton
                    variant="outline"
                    className="rounded-2xl px-6 py-3 border-2 border-primary/20 hover:border-primary/40 font-semibold shadow-md hover:shadow-lg transition-all text-primary hover:text-primary-foreground hover:bg-primary"
                    onLinkCreated={() => {
                      loadData();
                    }}
                  >
                    <Link2 className="h-5 w-5 mr-2" />
                    {t('createLink')}
                  </CreateLinkButton>
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


