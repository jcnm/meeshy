'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { 
  MessageSquare, 
  Bell, 
  Search,
  LogOut,
  Settings,
  User as UserIcon,
  Home,
  Users,
  UserPlus,
  Link as LinkIcon,
  ChevronDown,
  Shield,
  Brain,
  Globe2,
  Globe,
  Send,
  Languages,
  TrendingUp, 
  ChevronUp,
  Loader2,
  Share
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MessageComposer } from '@/components/common/message-composer';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

// Import des composants modulaires

// Import des constantes centralisées
import {
  SUPPORTED_LANGUAGES,
  getLanguageInfo,
  getLanguageName,
  getLanguageFlag,
  type SupportedLanguageInfo
} from '@shared/types';

// Constantes locales (non disponibles dans shared)
const MAX_MESSAGE_LENGTH = 300;
const TOAST_SHORT_DURATION = 2000;
const TOAST_LONG_DURATION = 3000;
const TOAST_ERROR_DURATION = 5000;
const TYPING_CANCELATION_DELAY = 2000;

// Interface pour les statistiques de langues (compatibilité)
interface LanguageStats {
  language: string;
  flag: string;
  count: number;
  color: string;
}

// Import des modules réutilisables extraits
import {
  FoldableSection,
  LanguageIndicators,
  SidebarLanguageHeader,
  getUserLanguageChoices,
  type BubbleStreamMessage,
  type BubbleStreamPageProps,
  type LanguageChoice
} from '@/lib/bubble-stream-modules';

import { BubbleMessage } from '@/components/common/bubble-message';
import { TrendingSection } from '@/components/common/trending-section';
import { LoadingState } from '@/components/common/LoadingStates';
import { useReplyStore } from '@/stores/reply-store';
import { AttachmentGallery } from '@/components/attachments/AttachmentGallery';

import { useSocketIOMessaging } from '@/hooks/use-socketio-messaging';
import { useNotifications } from '@/hooks/use-notifications';
import { useMessageTranslations } from '@/hooks/use-message-translations';
import { useMessageTranslation } from '@/hooks/useMessageTranslation';
import { useFixRadixZIndex } from '@/hooks/use-fix-z-index';
import { detectLanguage } from '@/utils/language-detection';
import { useI18n } from '@/hooks/useI18n';
import type { User, Message, BubbleTranslation } from '@shared/types';
import { buildApiUrl, API_ENDPOINTS } from '@/lib/config';
import { messageTranslationService } from '@/services/message-translation.service';
import { conversationsService } from '@/services';
import { messageService } from '@/services/message.service';
import { TypingIndicator } from '@/components/conversations/typing-indicator';
import { useConversationMessages } from '@/hooks/use-conversation-messages';
import { MessagesDisplay } from '@/components/common/messages-display';
import { printWebSocketDiagnostics } from '@/utils/websocket-diagnostics';

export function BubbleStreamPage({ user, conversationId = 'meeshy', isAnonymousMode = false, linkId, initialParticipants }: BubbleStreamPageProps) {
  const { t, isLoading: isLoadingTranslations } = useI18n('conversations');
  const { t: tCommon } = useI18n('common');
  const router = useRouter();
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Hook pour fixer les z-index des composants Radix UI
  useFixRadixZIndex();

  // Hook pour la pagination infinie des messages (scroll vers le haut pour charger plus anciens)
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
  } = useConversationMessages(conversationId, user, {
    limit: 20,
    enabled: true,
    threshold: 200, // Scroll infini activé: charge automatiquement à 200px du bas
    linkId: isAnonymousMode ? linkId : undefined, // Passer le linkId pour les utilisateurs anonymes
    containerRef: messagesContainerRef,
    scrollDirection: 'down' // Scroll vers le bas pour charger plus (page publique)
  });

  // Hook pour la gestion des traductions
  const {
    processMessageWithTranslations,
    getPreferredLanguageContent,
    getUserLanguagePreferences,
    resolveUserPreferredLanguage,
    shouldRequestTranslation,
    getRequiredTranslations
  } = useMessageTranslations({ currentUser: user });

  // État pour les traductions en cours
  const [translatingMessages, setTranslatingMessages] = useState<Map<string, Set<string>>>(new Map());
  const [translatedMessages, setTranslatedMessages] = useState<BubbleStreamMessage[]>([]);

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

  // États de base
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [detectedLanguage, setDetectedLanguage] = useState<string>('fr');
  const [userLanguage, setUserLanguage] = useState<string>(resolveUserPreferredLanguage());
  const [selectedInputLanguage, setSelectedInputLanguage] = useState<string>(user.systemLanguage || 'fr');
  const [messageLanguageStats, setMessageLanguageStats] = useState<LanguageStats[]>([]);
  const [activeLanguageStats, setActiveLanguageStats] = useState<LanguageStats[]>([]);
  const [isComposingEnabled, setIsComposingEnabled] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [location, setLocation] = useState<string>('');
  const [trendingHashtags, setTrendingHashtags] = useState<string[]>([]);
  const [activeUsers, setActiveUsers] = useState<User[]>(initialParticipants || []);
  // État pour les attachments
  const [attachmentIds, setAttachmentIds] = useState<string[]>([]);
  
  // Debug: log quand attachmentIds change
  useEffect(() => {
    console.log('📎 [BubbleStreamPage] attachmentIds mis à jour:', attachmentIds);
  }, [attachmentIds]);
  // État pour la galerie d'images
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [selectedAttachmentId, setSelectedAttachmentId] = useState<string | null>(null);

  // Handler pour ouvrir la galerie d'images
  const handleImageClick = useCallback((attachmentId: string) => {
    setSelectedAttachmentId(attachmentId);
    setGalleryOpen(true);
  }, []);

  // Handler pour naviguer vers un message depuis la galerie
  const handleNavigateToMessageFromGallery = useCallback((messageId: string) => {
    setGalleryOpen(false);
    // TODO: Implémenter le scroll vers le message et le highlight
    console.log('Navigate to message from gallery:', messageId);
  }, []);

  // Handlers pour la modération des messages
  const handleEditMessage = useCallback(async (messageId: string, newContent: string) => {
    try {
      await messageService.editMessage(conversationId, messageId, {
        content: newContent,
        originalLanguage: selectedInputLanguage
      });
      
      // Recharger les messages pour afficher la modification
      await refreshMessages();
      toast.success(tCommon('messages.messageModified'));
    } catch (error) {
      console.error('Erreur lors de la modification du message:', error);
      toast.error(tCommon('messages.modifyError'));
      throw error;
    }
  }, [conversationId, selectedInputLanguage, refreshMessages, tCommon]);

  const handleDeleteMessage = useCallback(async (messageId: string) => {
    try {
      await messageService.deleteMessage(conversationId, messageId);
      
      // Recharger les messages pour afficher la suppression
      await refreshMessages();
      toast.success(tCommon('messages.messageDeleted'));
    } catch (error) {
      console.error('Erreur lors de la suppression du message:', error);
      toast.error(tCommon('messages.deleteError'));
      throw error;
    }
  }, [conversationId, refreshMessages, tCommon]);

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
    
    // Focus sur la zone de saisie
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
    
    toast.success(tCommon('messages.replyTo'));
  }, []);

  const handleNavigateToMessage = useCallback((messageId: string) => {
    console.log('🔍 Navigation vers le message:', messageId);
    
    // Chercher l'élément du message dans le DOM
    const messageElement = document.getElementById(`message-${messageId}`);
    
    if (messageElement) {
      // Scroll vers le message avec animation
      messageElement.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center' 
      });
      
      // Highlight temporaire du message
      messageElement.classList.add('ring-2', 'ring-blue-500', 'ring-offset-2');
      setTimeout(() => {
        messageElement.classList.remove('ring-2', 'ring-blue-500', 'ring-offset-2');
      }, 2000);
      
      toast.success(tCommon('messages.messageFound'));
    } else {
      // Le message n'est pas visible, peut-être trop loin
      toast.info(tCommon('messages.messageNotVisible'));
      // TODO: Implémenter le chargement des messages précédents si nécessaire
    }
  }, [tCommon]);

  // Logique de permissions pour la modération
  const getUserModerationRole = useCallback(() => {
    // Pour BubbleStreamPage, nous considérons que c'est une conversation publique
    // Les utilisateurs avec des rôles élevés peuvent modérer
    if (user.role === 'ADMIN' || user.role === 'BIGBOSS' || user.role === 'MODERATOR') {
      return user.role;
    }
    
    // Pour les conversations publiques, les créateurs peuvent aussi modérer
    // Nous devrions vérifier si l'utilisateur est le créateur de la conversation
    // Pour l'instant, nous utilisons le rôle utilisateur par défaut
    return user.role || 'USER';
  }, [user.role]);

  // Fonction pour dédoublonner les utilisateurs actifs
  const deduplicateUsers = useCallback((users: User[]): User[] => {
    const uniqueUsers = users.reduce((acc: User[], current: User) => {
      const existingUser = acc.find(user => user.id === current.id);
      if (!existingUser) {
        acc.push(current);
      } else {
        console.warn(`⚠️  Utilisateur dupliqué détecté et filtré: ${current.id} (${current.username})`);
      }
      return acc;
    }, []);
    
    if (uniqueUsers.length !== users.length) {
      console.log(`🔧 Déduplication: ${users.length} → ${uniqueUsers.length} utilisateurs`);
    }
    
    return uniqueUsers;
  }, []);

  // Fonction pour mettre à jour les utilisateurs actifs avec déduplication
  const setActiveUsersDeduped = useCallback((users: User[]) => {
    setActiveUsers(deduplicateUsers(users));
  }, [deduplicateUsers]);

  // Fonction pour charger les utilisateurs en ligne
  const loadActiveUsers = useCallback(async () => {
    try {
      // Pour les sessions anonymes, ne pas charger les participants via l'API
      // car les participants sont déjà inclus dans les données de la conversation partagée
      if (isAnonymousMode) {
        console.log('[BubbleStreamPage] Session anonyme - pas de chargement des participants via API');
        return;
      }
      
      const onlineUsers = await conversationsService.getParticipants(conversationId, { onlineOnly: true });
      setActiveUsersDeduped(onlineUsers);
    } catch (error) {
      console.error('Erreur lors du chargement des utilisateurs actifs:', error);
      // En cas d'erreur, on garde les données WebSocket si disponibles
      // Ne pas afficher d'erreur à l'utilisateur car ce n'est pas critique
    }
  }, [conversationId, isAnonymousMode, setActiveUsersDeduped]);

  // Fonction pour charger tous les participants (pour les statistiques)
  const loadAllParticipants = useCallback(async () => {
    try {
      // Pour les sessions anonymes, ne pas charger les participants via l'API
      // car les participants sont déjà inclus dans les données de la conversation partagée
      if (isAnonymousMode) {
        console.log('[BubbleStreamPage] Session anonyme - pas de chargement des participants via API');
        return [];
      }
      
      const allParticipants = await conversationsService.getParticipants(conversationId);
      return allParticipants;
    } catch (error) {
      console.error('Erreur lors du chargement des participants:', error);
      return [];
    }
  }, [conversationId, isAnonymousMode]);

  // États de chargement
  const [isInitializing, setIsInitializing] = useState(true);
  const [hasLoadedMessages, setHasLoadedMessages] = useState(false);
  const [hasEstablishedConnection, setHasEstablishedConnection] = useState(false);

  // Langues utilisées par l'utilisateur (basées sur ses préférences)
  const usedLanguages: string[] = getUserLanguagePreferences();

  // Obtenir les choix de langues pour l'utilisateur via la fonction centralisée
  const languageChoices = getUserLanguageChoices(user);

  // État pour les utilisateurs en train de taper avec leurs noms
  const [typingUsers, setTypingUsers] = useState<{id: string, displayName: string}[]>([]);

  // Fonctions de gestion des événements utilisateur
  const handleUserTyping = useCallback((userId: string, username: string, isTyping: boolean) => {
    if (userId === user.id) return; // Ignorer nos propres événements de frappe
    
    setTypingUsers(prev => {
      if (isTyping) {
        // Ajouter l'utilisateur s'il n'est pas déjà dans la liste
        if (prev.some(u => u.id === userId)) return prev;
        
        // Rechercher l'utilisateur dans la liste des utilisateurs connectés pour obtenir son vrai nom
        const connectedUser = activeUsers.find(u => u.id === userId);
        let displayName: string;
        
        if (connectedUser) {
          // Utiliser le nom complet de l'utilisateur connecté
          if (connectedUser.displayName) {
            displayName = connectedUser.displayName;
          } else if (connectedUser.firstName || connectedUser.lastName) {
            displayName = `${connectedUser.firstName || ''} ${connectedUser.lastName || ''}`.trim();
          } else {
            displayName = connectedUser.username;
          }
        } else if (username && username !== userId) {
          // Fallback sur le username fourni par l'événement
          displayName = username;
        } else {
          // Fallback final avec un ID formaté
          displayName = `Utilisateur ${userId.slice(-6)}`;
        }
        
        // Utilisateur en train de taper
        
        return [...prev, { id: userId, displayName }];
      } else {
        // Retirer l'utilisateur de la liste
        return prev.filter(u => u.id !== userId);
      }
    });
  }, [user.id, activeUsers]); // Ajouter activeUsers aux dépendances

  const handleUserStatus = useCallback((userId: string, username: string, isOnline: boolean) => {
    // Statut utilisateur changé - géré par les événements socket
  }, []);

  const handleTranslation = useCallback((messageId: string, translations: any[]) => {
    console.log('🌐 [BubbleStreamPage] Traductions reçues pour message:', messageId, translations);
    
    // Mettre à jour le message avec les nouvelles traductions
    updateMessageTranslations(messageId, (prevMessage) => {
      console.log('🔄 [BubbleStreamPage] Mise à jour des traductions pour message:', messageId, {
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
          console.warn('🚫 [BubbleStreamPage] Traduction invalide ignorée:', newTranslation);
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
          updatedTranslations[existingIndex] = translationObject;
        } else {
          // Ajouter la nouvelle traduction
          updatedTranslations.push(translationObject);
        }
      });

      return {
        ...prevMessage,
        translations: updatedTranslations
      };
    });
    
    // Vérifier si on a des nouvelles traductions pour cet utilisateur
    const userLanguages = [
      user.systemLanguage,
      user.regionalLanguage,
      user.customDestinationLanguage
    ].filter(Boolean); // Enlever les valeurs undefined/null

    const relevantTranslation = translations.find(t => 
      userLanguages.includes(t.targetLanguage)
    );
    
    if (relevantTranslation) {
      const langInfo = getLanguageInfo(relevantTranslation.targetLanguage);
      
      // Toast pour traduction pertinente
      
      // Statistiques de traduction de messages
      incrementTranslationCount(relevantTranslation.sourceLanguage || 'fr', relevantTranslation.targetLanguage);
      
      // Toast de traduction réduit pour éviter le spam
    }
  }, [updateMessageTranslations, user.systemLanguage, user.regionalLanguage, user.customDestinationLanguage]);

  // Handler pour les nouveaux messages reçus via WebSocket avec traductions optimisées
  const handleNewMessage = useCallback((message: Message) => {
    // Message reçu via WebSocket
    
    // Enrichir le message avec les informations du sender si nécessaire
    let enrichedMessage = { ...message };
    
    // Si c'est notre propre message et que sender/anonymousSender manque, l'enrichir
    if ((message.senderId === user.id || message.anonymousSenderId === user.id) && 
        !message.sender && !message.anonymousSender) {
      if (isAnonymousMode) {
        enrichedMessage.anonymousSender = {
          id: user.id,
          username: user.username,
          firstName: user.firstName || '',
          lastName: user.lastName || '',
          language: user.systemLanguage || 'fr',
          isMeeshyer: false
        };
      } else {
        enrichedMessage.sender = {
          id: user.id,
          username: user.username,
          email: user.email || '',
          phoneNumber: user.phoneNumber || '',
          firstName: user.firstName || '',
          lastName: user.lastName || '',
          displayName: user.displayName,
          avatar: user.avatar,
          role: user.role,
          isOnline: true,
          lastSeen: new Date(),
          createdAt: user.createdAt || new Date(),
          updatedAt: user.updatedAt || new Date(),
          systemLanguage: user.systemLanguage || 'fr',
          regionalLanguage: user.regionalLanguage || 'fr',
          autoTranslateEnabled: user.autoTranslateEnabled !== false,
          translateToSystemLanguage: user.translateToSystemLanguage !== false,
          translateToRegionalLanguage: user.translateToRegionalLanguage || false,
          useCustomDestination: user.useCustomDestination || false,
          isActive: true,
          lastActiveAt: new Date(),
          isMeeshyer: true
        };
      }
    }
    
    // Ajouter le message enrichi à la liste (il sera inséré au début grâce au hook)
    addMessage(enrichedMessage);
    
    // Notification UNIQUEMENT pour les nouveaux messages d'autres utilisateurs
    if (message.senderId !== user.id && message.anonymousSenderId !== user.id) {
      const senderName = enrichedMessage.sender?.firstName || 
                        enrichedMessage.anonymousSender?.firstName || 
                        enrichedMessage.sender?.username ||
                        enrichedMessage.anonymousSender?.username ||
                        'Utilisateur';
      toast.info(`📨 Nouveau message de ${senderName}`, {
        duration: TOAST_LONG_DURATION
      });
      
      // Scroll automatique SEULEMENT si l'utilisateur est déjà proche du haut (dans les 300px)
      setTimeout(() => {
        if (messagesContainerRef.current) {
          const currentScrollTop = messagesContainerRef.current.scrollTop;
          
          if (currentScrollTop < 300) {
            messagesContainerRef.current.scrollTo({
              top: 0,
              behavior: 'smooth'
            });
            console.log('📜 Scroll vers le haut pour nouveau message reçu');
          }
        }
      }, 300);
    } else {
      // Pour nos propres messages, c'est déjà géré dans handleSendMessage
      // Mon message publié avec succès
    }
  }, [addMessage, user.id, user.username, user.firstName, user.lastName, user.displayName, user.avatar, user.systemLanguage, isAnonymousMode]);

  // Hook pour les statistiques de traduction de messages
  const { stats: translationStats, incrementTranslationCount } = useMessageTranslation();
  
  const { 
    sendMessage: sendMessageToService,
    sendMessageWithAttachments: sendMessageWithAttachmentsToService,
    connectionStatus,
    startTyping,
    stopTyping,
    reconnect,
    getDiagnostics
  } = useSocketIOMessaging({
    conversationId: conversationId, // Utiliser le conversationId passé en props
    currentUser: user,
    onNewMessage: handleNewMessage,
    onUserTyping: handleUserTyping,
    onUserStatus: handleUserStatus,
    onTranslation: handleTranslation,
    onConversationStats: (data) => {
      if (!data || data.conversationId !== conversationId) return;
      const stats: any = data.stats || {};
      if (stats.messagesPerLanguage) {
        const mapped = Object.entries(stats.messagesPerLanguage).map(([code, count]) => ({
          language: code as string,
          flag: getLanguageFlag(code as string),
          count: count as number,
          color: undefined as any
        })).filter((s: any) => s.count > 0);
        setMessageLanguageStats(mapped as any);
      }
      if (stats.participantsPerLanguage) {
        const mapped = Object.entries(stats.participantsPerLanguage).map(([code, count]) => ({
          language: code as string,
          flag: getLanguageFlag(code as string),
          count: count as number,
          color: undefined as any
        })).filter((s: any) => s.count > 0);
        setActiveLanguageStats(mapped as any);
      }
      if (typeof stats.participantCount === 'number') {
        // Optional: could be displayed somewhere in UI later
        // setParticipantsCount(stats.participantCount);
      }
      if (Array.isArray(stats.onlineUsers)) {
        setActiveUsersDeduped(stats.onlineUsers.map((u: any) => ({
          id: u.id,
          username: u.username,
          firstName: u.firstName,
          lastName: u.lastName,
          email: '',
          avatar: '',
          role: 'USER' as const,
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
          systemLanguage: 'fr',
          regionalLanguage: 'fr',
          autoTranslateEnabled: true,
          translateToSystemLanguage: true,
          translateToRegionalLanguage: false,
          useCustomDestination: false,
          isOnline: true,
          isActive: true,
          lastSeen: new Date(),
          createdAt: new Date(),
          lastActiveAt: new Date(),
          updatedAt: new Date()
        })));
      }
    },
    onConversationOnlineStats: (data) => {
      if (!data || data.conversationId !== conversationId) return;
      if (Array.isArray(data.onlineUsers)) {
        setActiveUsersDeduped(data.onlineUsers.map((u: any) => ({
          id: u.id,
          username: u.username,
          firstName: u.firstName,
          lastName: u.lastName,
          email: '',
          avatar: '',
          role: 'USER' as const,
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
          systemLanguage: 'fr',
          regionalLanguage: 'fr',
          autoTranslateEnabled: true,
          translateToSystemLanguage: true,
          translateToRegionalLanguage: false,
          useCustomDestination: false,
          isOnline: true,
          isActive: true,
          lastSeen: new Date(),
          createdAt: new Date(),
          lastActiveAt: new Date(),
          updatedAt: new Date()
        })));
      }
    },
  });

  const { notifications, markAsRead } = useNotifications();

  // Protection contre les toasts multiples
  const [hasShownConnectionToast, setHasShownConnectionToast] = useState(false);

  // Initialisation de la connexion WebSocket en temps réel
  useEffect(() => {
    console.log('Initialisation de la connexion WebSocket...');
    
    // Diagnostic initial
    const diagnostics = getDiagnostics();
    console.log('Diagnostic initial:', diagnostics);
    
    // Attendre que les traductions soient chargées avant d'afficher les toasts
    if (isLoadingTranslations) {
      return;
    }

    // Délai pour vérifier la connexion établie
    const initTimeout = setTimeout(() => {
      const newDiagnostics = getDiagnostics();
      console.log('Diagnostic après délai:', newDiagnostics);
      
      if (connectionStatus.isConnected && connectionStatus.hasSocket && !hasShownConnectionToast) {
        console.log(`✅ ${t('bubbleStream.websocketConnected')}`);
        console.log(`${t('bubbleStream.connected')}`);
        setHasShownConnectionToast(true);
      } else if (!connectionStatus.isConnected || !connectionStatus.hasSocket) {
        console.log('WebSocket non connecté après délai');
        console.log('Diagnostic de connexion:', {
          hasSocket: connectionStatus.hasSocket,
          isConnected: connectionStatus.isConnected,
          hasToken: !!localStorage.getItem('auth_token'),
          wsUrl: (typeof window !== 'undefined' ? (process.env.NEXT_PUBLIC_WS_URL || 'ws://meeshy.me/api') : 'ws://gateway:3000') + '/ws'
        });
        toast.warning(t('bubbleStream.connectingWebSocket'));
      }
    }, 3000);

    return () => clearTimeout(initTimeout);
  }, [connectionStatus.isConnected, connectionStatus.hasSocket, hasShownConnectionToast, isLoadingTranslations, t]);

  // Surveillance du statut de connexion WebSocket
  useEffect(() => {
    const checkConnection = () => {
      const isReallyConnected = connectionStatus.isConnected && connectionStatus.hasSocket;
      
      if (isReallyConnected) {
        console.log('Connexion WebSocket active');
      } else {
        console.log('WebSocket déconnecté');
      }
      
      console.log('Statut connexion vérifié:', { 
        isConnected: connectionStatus.isConnected,
        hasSocket: connectionStatus.hasSocket,
        connectionStatus 
      });
    };

    checkConnection();
    
    // Vérifier périodiquement le statut
    const interval = setInterval(checkConnection, 5000);
    return () => clearInterval(interval);
  }, [connectionStatus]);

  // Géolocalisation
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            // Optionnel : Convertir les coordonnées en ville/région
            // Pour cet exemple, on utilise une ville par défaut
            setLocation('Paris');
          } catch (error) {
            console.error('Erreur géolocalisation:', error);
          }
        },
        (error) => {
          console.log('Géolocalisation non disponible');
        }
      );
    }
  }, []);

  // Détection automatique de langue pour affichage informatif uniquement (pas de mise à jour automatique)
  useEffect(() => {
    if (newMessage.trim().length > 15) { // Seuil plus élevé pour une meilleure détection
      const detectedLang = detectLanguage(newMessage);
      setDetectedLanguage(detectedLang);
      console.log('Langue détectée:', detectedLang, '(affichage informatif uniquement)');
    }
  }, [newMessage]);

  // Définir le callback pour récupérer un message par ID (utilise la liste translatedMessages existante)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const meeshySocketIOService = require('@/services/meeshy-socketio.service').meeshySocketIOService;
      const getMessageById = (messageId: string) => {
        return (translatedMessages as Message[]).find(msg => msg.id === messageId);
      };
      meeshySocketIOService.setGetMessageByIdCallback(getMessageById);
      console.log(`� [CALLBACK] Callback getMessageById défini (${translatedMessages.length} messages disponibles)`);
    }
  }, [translatedMessages]);

  // Mise à jour de la langue sélectionnée basée sur les préférences utilisateur uniquement
  useEffect(() => {
    const newUserLanguage = resolveUserPreferredLanguage();
    setUserLanguage(newUserLanguage);
    
    // Vérifier si la langue actuellement sélectionnée est encore valide dans les choix disponibles
    const availableLanguageCodes = languageChoices.map(choice => choice.code);
    if (!availableLanguageCodes.includes(selectedInputLanguage)) {
      // Si la langue sélectionnée n'est plus dans les choix, revenir à la langue système
      console.log('Langue sélectionnée non disponible, retour à la langue système:', user.systemLanguage);
      setSelectedInputLanguage(user.systemLanguage || 'fr');
    }
  }, [user.systemLanguage, user.regionalLanguage, user.customDestinationLanguage]); // Supprimé languageChoices et selectedInputLanguage

  // Suppression de la simulation des statistiques de langues (désormais alimentées en temps réel)

  // Pas d'initialisation de messages démo - les messages seront chargés depuis le serveur
  useEffect(() => {
    // Messages chargés depuis le serveur uniquement
  }, [userLanguage]);

  // Cleanup timeout de frappe au démontage et initialisation de la hauteur du textarea
  useEffect(() => {
    // Initialiser la hauteur du textarea au montage
    if (textareaRef.current && textareaRef.current.style) {
      try {
        textareaRef.current.style.height = '80px'; // Hauteur minimale
      } catch (error) {
        console.warn('Erreur lors de l\'initialisation du textarea:', error);
      }
    }
    
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  // Chargement des données trending sans simulation de messages
  useEffect(() => {
    // Simulation des hashtags tendances - Plus de 7 pour tester le scroll
    setTrendingHashtags([
      '#meeshy', '#multilingual', '#chat', '#translation', '#connect', 
      '#realtime', '#languages', '#global', '#community', '#innovation',
      '#communication', '#technology', '#ai', '#international', '#diversity'
    ]);
    
    // Pas de simulation d'utilisateurs actifs: alimentés par WebSocket
  }, []);

  // Charger les messages existants dès que possible, sans attendre la connexion WebSocket
  useEffect(() => {
    if (conversationId && !hasLoadedMessages) {
      console.log('Chargement initial des messages depuis la base de données...');
      // Charger immédiatement les messages existants via HTTP API
      refreshMessages();
      setHasLoadedMessages(true);
    }
  }, [conversationId]); // Supprimé refreshMessages des dépendances

  // Separately handle WebSocket connection for real-time updates
  useEffect(() => {
    // Attendre que les traductions soient chargées
    if (isLoadingTranslations) {
      return;
    }

    if (connectionStatus.isConnected) {
      setHasEstablishedConnection(true);
      console.log(`${t('bubbleStream.websocketEstablished')}`);
      
      if (!hasShownConnectionToast) {
        console.log(`${t('bubbleStream.connected')}`);
        setHasShownConnectionToast(true);
      }
    } else {
      console.log('WebSocket en attente de connexion...');
    }
  }, [connectionStatus.isConnected, hasShownConnectionToast, isLoadingTranslations, t]);

  // Gérer l'état d'initialisation global
  useEffect(() => {
    if (hasLoadedMessages && !isLoadingMessages) {
      setIsInitializing(false);
      console.log('✅ Initialisation terminée : messages chargés');
    }
  }, [hasLoadedMessages, isLoadingMessages]);

  // Charger les utilisateurs actifs au démarrage
  useEffect(() => {
    if (conversationId && activeUsers.length === 0) {
      loadActiveUsers();
    }
  }, [conversationId]); // Supprimé loadActiveUsers des dépendances

  // Calculer les statistiques de langues à partir des messages chargés
  useEffect(() => {
    if (translatedMessages.length > 0) {
      // Calculer les statistiques des langues des messages
      const languageCounts: { [key: string]: number } = {};
      const userLanguages: { [key: string]: Set<string> } = {}; // Pour les langues des utilisateurs
      
      translatedMessages.forEach(message => {
        // Compter les langues originales des messages
        const originalLang = message.originalLanguage || 'fr';
        languageCounts[originalLang] = (languageCounts[originalLang] || 0) + 1;
        
        // Simuler les langues des utilisateurs (en réalité, on devrait avoir les préférences des utilisateurs)
        if (message.sender?.id) {
          if (!userLanguages[originalLang]) {
            userLanguages[originalLang] = new Set();
          }
          userLanguages[originalLang].add(message.sender.id);
        }
      });
      
      // Convertir en format LanguageStats pour les messages
      const messageStats: LanguageStats[] = Object.entries(languageCounts)
        .map(([code, count], index) => ({
          language: code,
          flag: getLanguageFlag(code),
          count: count,
          color: `hsl(${(index * 137.5) % 360}, 60%, 60%)` // Couleurs automatiques
        }))
        .filter(stat => stat.count > 0)
        .sort((a, b) => b.count - a.count);
      
      // Convertir en format LanguageStats pour les utilisateurs actifs
      const userStats: LanguageStats[] = Object.entries(userLanguages)
        .map(([code, users], index) => ({
          language: code,
          flag: getLanguageFlag(code),
          count: users.size,
          color: `hsl(${(index * 137.5) % 360}, 50%, 50%)` // Couleurs automatiques
        }))
        .filter(stat => stat.count > 0)
        .sort((a, b) => b.count - a.count);
      
      setMessageLanguageStats(messageStats);
      setActiveLanguageStats(userStats);
      
      // Charger tous les participants pour calculer les statistiques des utilisateurs
      loadAllParticipants().then(allParticipants => {
        if (allParticipants.length > 0) {
          // Recalculer les statistiques des utilisateurs avec les vraies données
          const realUserLanguages: { [key: string]: Set<string> } = {};
          
          allParticipants.forEach(participant => {
            const lang = participant.systemLanguage || 'fr';
            if (!realUserLanguages[lang]) {
              realUserLanguages[lang] = new Set();
            }
            realUserLanguages[lang].add(participant.id);
          });
          
          const realUserStats: LanguageStats[] = Object.entries(realUserLanguages)
            .map(([code, users], index) => ({
              language: code,
              flag: getLanguageFlag(code),
              count: users.size,
              color: `hsl(${(index * 137.5) % 360}, 50%, 50%)`
            }))
            .filter(stat => stat.count > 0)
            .sort((a, b) => b.count - a.count);
          
          setActiveLanguageStats(realUserStats);
        }
      });
    }
  }, [translatedMessages.length]); // Supprimé les dépendances qui causent des boucles

  // Afficher l'écran de chargement pendant l'initialisation
  if (isInitializing) {
    return (
      <LoadingState 
        message={
          !hasLoadedMessages 
            ? t('bubbleStream.loading')
            : !hasEstablishedConnection
            ? t('bubbleStream.connecting')
            : t('bubbleStream.initializing')
        }
        fullScreen={true}
      />
    );
  }

  const handleSendMessage = async () => {
    // Vérifier qu'il y a soit du contenu soit des attachments
    if ((!newMessage.trim() && attachmentIds.length === 0) || newMessage.length > MAX_MESSAGE_LENGTH) {
      return;
    }

    const messageContent = newMessage.trim();
    const replyToId = useReplyStore.getState().replyingTo?.id;
    const hasAttachments = attachmentIds.length > 0;
    
    console.log('📤 Envoi du message avec langue sélectionnée:', {
      content: messageContent.substring(0, 50) + '...',
      sourceLanguage: selectedInputLanguage,
      languageChoice: languageChoices.find(choice => choice.code === selectedInputLanguage),
      replyToId: replyToId || 'none',
      attachmentCount: attachmentIds.length,
      attachmentIds: attachmentIds,
      hasAttachments: hasAttachments
    });
    
    setNewMessage(''); // Réinitialiser immédiatement pour éviter les doubles envois
    setIsTyping(false);
    
    // Effacer l'état de réponse après l'envoi
    if (replyToId) {
      useReplyStore.getState().clearReply();
    }
    
    // Clear les attachments après l'envoi
    const currentAttachmentIds = [...attachmentIds];
    setAttachmentIds([]);
    
    // Clear les attachments du composer
    if (textareaRef.current && (textareaRef.current as any).clearAttachments) {
      (textareaRef.current as any).clearAttachments();
    }
    
    // Réinitialiser la hauteur du textarea
    if (textareaRef.current && textareaRef.current.style) {
      try {
        textareaRef.current.style.height = 'auto';
      } catch (error) {
        console.warn('Erreur lors de la réinitialisation du textarea:', error);
      }
    }

    try {
      // Vérifier l'état de la connexion avant l'envoi
      if (!connectionStatus.isConnected) {
        console.log('⚠️ WebSocket non connecté - Impossible d\'envoyer le message');
        toast.warning(tCommon('messages.connectionInProgress'));
        // Restaurer le message pour permettre un nouvel essai
        setNewMessage(messageContent);
        setAttachmentIds(currentAttachmentIds);
        return;
      }

      // Essayer d'envoyer via le service WebSocket
      try {
        // Préparer le message avec métadonnées de langue pour transmission
        const messageWithLanguage = {
          content: messageContent,
          sourceLanguage: selectedInputLanguage,
          detectedLanguage: detectedLanguage,
          userLanguageChoices: languageChoices.map(c => c.code),
          attachmentCount: currentAttachmentIds.length
        };
        
        console.log('📤 Envoi du message avec métadonnées de langue:', messageWithLanguage);
        
        // Envoyer le message avec ou sans attachments selon le cas
        if (hasAttachments) {
          console.log('📎 Envoi du message AVEC attachments:', {
            messageContent,
            attachmentIds: currentAttachmentIds,
            sourceLanguage: selectedInputLanguage,
            replyToId
          });
        } else {
          console.log('📝 Envoi du message SANS attachments');
        }
        
        const sendResult = hasAttachments 
          ? await sendMessageWithAttachmentsToService(messageContent, currentAttachmentIds, selectedInputLanguage, replyToId)
          : await sendMessageToService(messageContent, selectedInputLanguage, replyToId);
        
        if (sendResult) {
          console.log('✅ Message envoyé via WebSocket avec succès');
          toast.success(tCommon('messages.messageSent'));
          
          // Log pour le debug - La langue source sera utilisée côté serveur
          console.log(`🔤 Langue source du message: ${selectedInputLanguage} (détectée: ${detectedLanguage})`);
          
          // Scroll automatique vers le haut pour voir le message envoyé
          setTimeout(() => {
            if (messagesContainerRef.current) {
              messagesContainerRef.current.scrollTo({
                top: 0,
                behavior: 'smooth'
              });
              console.log('📜 Scroll vers le haut pour voir le message envoyé');
            }
          }, 300); // Délai pour laisser le message s'ajouter au DOM
        } else {
          console.error('❌ Envoi échoué: sendResult est false');
          throw new Error('L\'envoi du message a échoué - le serveur a retourné false');
        }
        
      } catch (wsError) {
        console.error('❌ Erreur envoi WebSocket:', wsError);
        
        // Message d'erreur plus spécifique
        let errorMessage = 'Erreur lors de l\'envoi du message';
        if (wsError instanceof Error) {
          if (wsError.message.includes('Timeout')) {
            errorMessage = 'Le serveur met trop de temps à répondre. Vérifiez votre connexion.';
          } else if (wsError.message.includes('Socket non connecté')) {
            errorMessage = 'Connexion perdue. Tentative de reconnexion...';
            // Optionnel: déclencher une reconnexion
            reconnect();
          } else {
            errorMessage = wsError.message;
          }
        }
        
        toast.error(errorMessage);
        // Restaurer le message en cas d'erreur
        setNewMessage(messageContent);
        return;
      }

    } catch (error) {
      console.error('❌ Erreur lors de l\'envoi du message:', error);
      toast.error(tCommon('messages.sendError'));
      // Restaurer le message en cas d'erreur
      setNewMessage(messageContent);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleTyping = (value: string) => {
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
      }, TYPING_CANCELATION_DELAY);
      
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

    // Auto-resize textarea avec gestion améliorée des retours à la ligne
    if (textareaRef.current && textareaRef.current.style) {
      try {
        // Réinitialiser la hauteur pour obtenir la hauteur naturelle du contenu
        textareaRef.current.style.height = 'auto';
        
        // Calculer la hauteur nécessaire avec une hauteur minimale
        const minHeight = 80; // Correspond à min-h-[80px]
        const maxHeight = 160; // Correspond à max-h-40 (40 * 4px = 160px)
        const scrollHeight = textareaRef.current.scrollHeight;
        
        // Utiliser la hauteur calculée en respectant les limites
        const newHeight = Math.max(minHeight, Math.min(scrollHeight, maxHeight));
        textareaRef.current.style.height = `${newHeight}px`;
        
        // Si le contenu dépasse la hauteur maximale, permettre le scroll
        if (scrollHeight > maxHeight) {
          textareaRef.current.style.overflowY = 'auto';
        } else {
          textareaRef.current.style.overflowY = 'hidden';
        }
      } catch (error) {
        console.warn('Erreur lors du redimensionnement du textarea:', error);
      }
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery)}`);
    }
  };


  return (
    <>
      <style jsx global>{`
        /* Cache toutes les barres de défilement */
        .scrollbar-hidden {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .scrollbar-hidden::-webkit-scrollbar {
          display: none;
        }
        
        /* Style pour les conteneurs avec scroll caché */
        .scroll-hidden {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .scroll-hidden::-webkit-scrollbar {
          display: none;
        }

        /* Styles pour mobile */
        @media (max-width: 768px) {
          .mobile-fullscreen {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            z-index: 40 !important;
            background: linear-gradient(to-br, #eff6ff, #ffffff, #e0e7ff) !important;
          }
          
          .mobile-messages-container {
            padding-top: 5rem !important;
            padding-bottom: 6rem !important;
            margin-bottom: 2rem !important;
          }
          
          .mobile-input-zone {
            position: fixed !important;
            bottom: 0 !important;
            left: 0 !important;
            right: 0 !important;
            z-index: 60 !important;
          }
        }
      `}</style>
      {/* Layout principal */}
      <div className="h-full relative mobile-fullscreen">
        {/* Feed principal - Container avec gestion propre du scroll */}
        <div className="w-full xl:pr-80 relative">{/* Indicateur dynamique - Frappe prioritaire sur connexion */}
          <div className="fixed top-16 left-0 right-0 xl:right-80 z-[40] px-4 sm:px-6 lg:px-8 pt-4 pb-2 bg-gradient-to-b from-blue-50 to-transparent pointer-events-none realtime-indicator hidden md:block">
            <div className="pointer-events-auto">
              {/* Priorité à l'indicateur de frappe quand actif */}
              {typingUsers.length > 0 && connectionStatus.isConnected ? (
                <div className="inline-flex items-center space-x-2 px-4 py-2 rounded-full text-sm backdrop-blur-sm bg-blue-100/90 text-blue-800 border border-blue-200/80 transition-all">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>
                    {typingUsers.length === 1 
                      ? t('bubbleStream.typing.single', { name: typingUsers[0].displayName })
                      : typingUsers.length === 2
                      ? t('bubbleStream.typing.double', { name1: typingUsers[0].displayName, name2: typingUsers[1].displayName })
                      : t('bubbleStream.typing.multiple', { name: typingUsers[0].displayName, count: typingUsers.length - 1 })
                    }
                  </span>
                </div>
              ) : (
                /* Indicateur de connexion par défaut */
                <div className={`inline-flex items-center space-x-2 px-3 py-1 rounded-full text-sm backdrop-blur-sm transition-all ${
                  connectionStatus.isConnected && connectionStatus.hasSocket
                    ? 'bg-green-100/80 text-green-800 border border-green-200/60' 
                    : 'bg-orange-100/80 text-orange-800 border border-orange-200/60'
                }`}>
                  <div className={`w-2 h-2 rounded-full animate-pulse ${
                    connectionStatus.isConnected && connectionStatus.hasSocket ? 'bg-green-600' : 'bg-orange-600'
                  }`} />
                  <span className="font-medium">
                    {t('bubbleStream.realTimeMessages')}
                  </span>
                  {!(connectionStatus.isConnected && connectionStatus.hasSocket) && (
                    <span className="text-xs opacity-75">• {t('bubbleStream.connectionInProgress')}</span>
                  )}
                  {!(connectionStatus.isConnected && connectionStatus.hasSocket) && (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          reconnect();
                        }}
                        className="ml-2 text-xs px-2 py-1 h-auto hover:bg-orange-200/50"
                      >
                        {t('bubbleStream.reconnect')}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          printWebSocketDiagnostics();
                          toast.info('🔍 Diagnostics affichés dans la console');
                        }}
                        className="ml-2 text-xs px-2 py-1 h-auto hover:bg-orange-200/50"
                        title="Afficher les diagnostics de connexion dans la console"
                      >
                        🔍 Debug
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Feed des messages avec scroll naturel - Padding top pour l'indicateur fixe */}
          <div 
            ref={messagesContainerRef}
            className="relative h-full pt-4 md:pt-20 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-40 messages-container scroll-optimized scrollbar-thin overflow-y-auto mobile-messages-container"
            style={{ background: 'transparent' }}
          >
            {/* 
              MODE BUBBLESTREAM: Messages récents EN HAUT (sous header)
              - Backend retourne: orderBy createdAt DESC = [récent...ancien]
              - reverseOrder=false garde l'ordre: [récent...ancien]
              - scrollDirection='down' (spécifié dans useConversationMessages)
              - Scroll vers le bas charge les plus anciens (ajoutés à la FIN)
              - Résultat: Récent EN HAUT, Ancien EN BAS ✅
            */}
            <MessagesDisplay
              messages={messages}
              translatedMessages={translatedMessages}
              isLoadingMessages={isLoadingMessages}
              currentUser={user}
              userLanguage={userLanguage}
              usedLanguages={usedLanguages}
              emptyStateMessage={t('bubbleStream.emptyStateMessage')}
              emptyStateDescription={t('bubbleStream.emptyStateDescription')}
              reverseOrder={false}
              className=""
              onTranslation={handleTranslation}
              onEditMessage={handleEditMessage}
              onDeleteMessage={handleDeleteMessage}
              onReplyMessage={handleReplyMessage}
              onNavigateToMessage={handleNavigateToMessage}
              onImageClick={handleImageClick}
              conversationType="public"
              userRole={getUserModerationRole() as any}
              addTranslatingState={addTranslatingState}
              isTranslating={isTranslating}
              containerRef={messagesContainerRef}
              onLoadMore={loadMore}
              hasMore={hasMore}
              isLoadingMore={isLoadingMore}
            />

            {/* Indicateur si plus de messages disponibles - positionné après les messages */}
            {!hasMore && messages.length > 0 && (
              <div className="flex justify-center py-4">
                <div className="text-sm text-muted-foreground">
                  {tCommon('messages.allMessagesLoaded')}
                </div>
              </div>
            )}

            {/* Espace supplémentaire pour éviter que le dernier message soit caché */}
            <div className="h-16" />
          </div>
        </div>

        {/* Dégradé inférieur fixe - Transition progressive vers les couleurs générales de la page */}
        <div className="fixed bottom-0 left-0 right-0 xl:right-80 h-32 bg-gradient-to-t from-blue-50 dark:from-gray-950 via-blue-50/40 dark:via-gray-950/40 to-transparent pointer-events-none z-20" />

        {/* Zone de composition flottante - Position fixe avec style plus large et aéré comme /conversations */}
        <div className="fixed bottom-0 left-0 right-0 xl:right-80 z-30 mobile-input-zone">
          {/* Dégradé de fond pour transition douce avec les couleurs générales */}
          <div className="h-10 bg-gradient-to-t from-blue-50 dark:from-gray-950 via-blue-50/40 dark:via-gray-950/40 to-transparent pointer-events-none" />
          
          {/* Zone de saisie avec transparence et couleurs harmonisées */}
          <div className="bg-blue-50/20 dark:bg-gray-900/80 backdrop-blur-lg border-t border-blue-200/50 dark:border-gray-800/50 shadow-xl shadow-blue-500/10 dark:shadow-gray-900/50">
            <div className="p-4">
              <div className="max-w-5xl mx-auto">
                <MessageComposer
                  ref={textareaRef}
                  value={newMessage}
                  onChange={handleTyping}
                  onSend={handleSendMessage}
                  selectedLanguage={selectedInputLanguage}
                  onLanguageChange={setSelectedInputLanguage}
                  location={location}
                  isComposingEnabled={isComposingEnabled}
                  placeholder={t('conversationSearch.shareMessage')}
                  onKeyPress={handleKeyPress}
                  choices={languageChoices}
                  onAttachmentsChange={setAttachmentIds}
                  token={typeof window !== 'undefined' ? localStorage.getItem('auth_token') || localStorage.getItem('anonymous_session_token') || undefined : undefined}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar droite - Desktop uniquement - FIXE avec scroll indépendant */}
        <div className="hidden xl:block w-80 fixed right-0 top-20 bottom-0 bg-white/60 dark:bg-gray-900/80 backdrop-blur-lg border-l border-blue-200/30 dark:border-gray-800/50 z-40">
          <div 
            className="h-full overflow-y-auto p-6 scroll-hidden"
          >
            
            {/* Header avec langues globales */}
            <SidebarLanguageHeader 
              languageStats={messageLanguageStats} 
              userLanguage={userLanguage}
            />

            {/* Section Langues Actives - Foldable */}
            <FoldableSection
              title={t('bubbleStream.activeLanguages')}
              icon={<Languages className="h-4 w-4 mr-2" />}
              defaultExpanded={true}
            >
              <LanguageIndicators languageStats={activeLanguageStats} />
            </FoldableSection>

            {/* Section Utilisateurs Actifs - Foldable - Remontée en 2e position */}
            <FoldableSection
              title={`Utilisateurs Actifs (${activeUsers.length})`}
              icon={<Users className="h-4 w-4 mr-2" />}
              defaultExpanded={true}
            >
              <div className="space-y-3">
                {/* Affichage des 6 premiers utilisateurs */}
                {activeUsers.slice(0, 6).map((activeUser, index) => (
                  <div
                    key={`${activeUser.id}-${index}`}
                    className="flex items-center space-x-3 p-2 rounded hover:bg-gray-50/80 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={activeUser.avatar || undefined} alt={activeUser.firstName} />
                      <AvatarFallback className="bg-gradient-to-br from-blue-400 to-indigo-500 text-white">
                        {activeUser.firstName?.charAt(0)}{activeUser.lastName?.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {activeUser.firstName} {activeUser.lastName}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        @{activeUser.username}
                      </p>
                    </div>
                    <div className="w-2 h-2 bg-green-500 rounded-full" />
                  </div>
                ))}
                
                {/* Section scrollable pour les utilisateurs restants */}
                {activeUsers.length > 6 && (
                  <div 
                    className="max-h-48 overflow-y-auto space-y-3 pr-1 border-t border-gray-100 dark:border-gray-700 pt-3 mt-3 scroll-hidden"
                  >
                    {activeUsers.slice(6).map((activeUser, index) => (
                      <div
                        key={`${activeUser.id}-${index + 6}`}
                        className="flex items-center space-x-3 p-2 rounded hover:bg-gray-50/80 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={activeUser.avatar || undefined} alt={activeUser.firstName} />
                          <AvatarFallback className="bg-gradient-to-br from-blue-400 to-indigo-500 text-white">
                            {activeUser.firstName?.charAt(0)}{activeUser.lastName?.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {activeUser.firstName} {activeUser.lastName}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            @{activeUser.username}
                          </p>
                        </div>
                        <div className="w-2 h-2 bg-green-500 rounded-full" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </FoldableSection>

            {/* Section Tendances - Statique non-interactive, grisée */}
            <div className="opacity-60 saturate-50 bg-gray-50/50 dark:bg-gray-800/50 rounded-lg p-2">
              <Card className="mb-6 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-gray-200/50 dark:border-gray-700/50 shadow-lg dark:shadow-gray-900/30">
                <CardContent className="p-0">
                  {/* Header non-cliquable */}
                  <div className="flex items-center justify-between p-4 bg-gray-50/80 dark:bg-gray-700/50">
                    <h3 className="font-semibold text-gray-500 dark:text-gray-400 flex items-center">
                      <TrendingUp className="h-4 w-4 mr-2 text-gray-400 dark:text-gray-500" />
                      Tendances
                    </h3>
                    <ChevronDown className="h-4 w-4 text-gray-300 dark:text-gray-600" />
                  </div>
                  
                  {/* Contenu statique (non-visible car fermé) */}
                  <div className="hidden">
                    <div className="px-4 pb-4 border-t border-gray-100">
                      <div className="mt-3 opacity-70">
                        <TrendingSection hashtags={trendingHashtags} />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* Galerie d'images */}
      <AttachmentGallery
        conversationId={conversationId}
        initialAttachmentId={selectedAttachmentId || undefined}
        open={galleryOpen}
        onClose={() => setGalleryOpen(false)}
        onNavigateToMessage={handleNavigateToMessageFromGallery}
        token={typeof window !== 'undefined' ? localStorage.getItem('auth_token') || localStorage.getItem('anonymous_session_token') || undefined : undefined}
      />
    </>
  );
}