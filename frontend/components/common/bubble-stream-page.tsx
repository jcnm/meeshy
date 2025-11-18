'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
import { getMaxMessageLength } from '@/lib/constants/languages';
const TOAST_SHORT_DURATION = 2000;
const TOAST_LONG_DURATION = 3000;
const TOAST_ERROR_DURATION = 5000;
const TYPING_STOP_DELAY = 3000; // 3 secondes après la dernière frappe

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

import { BubbleMessage } from '@/components/common/BubbleMessage';
import { TrendingSection } from '@/components/common/trending-section';
import { LoadingState } from '@/components/common/LoadingStates';
import { useReplyStore } from '@/stores/reply-store';
import { AttachmentGallery } from '@/components/attachments/AttachmentGallery';

import { useSocketIOMessaging } from '@/hooks/use-socketio-messaging';
import { useNotifications } from '@/hooks/use-notifications';
import { meeshySocketIOService } from '@/services/meeshy-socketio.service';
import { useMessageTranslations } from '@/hooks/use-message-translations';
import { useMessageTranslation } from '@/hooks/useMessageTranslation';
import { useFixRadixZIndex } from '@/hooks/use-fix-z-index';
import { detectLanguage } from '@/utils/language-detection';
import { useI18n } from '@/hooks/useI18n';
import { cn } from '@/lib/utils';
import { UserRoleEnum, type User, type Message, type BubbleTranslation, type Attachment } from '@shared/types';
import { buildApiUrl, API_ENDPOINTS } from '@/lib/config';
import { messageTranslationService } from '@/services/message-translation.service';
import { getAuthToken } from '@/utils/token-utils';
import { conversationsService } from '@/services';
import { messageService } from '@/services/message.service';
import { TypingIndicator } from '@/components/conversations/typing-indicator';
import { useConversationMessages } from '@/hooks/use-conversation-messages';
import { ConversationMessages } from '@/components/conversations/ConversationMessages';
import { authManager } from '@/services/auth-manager.service';

export function BubbleStreamPage({ user, conversationId = 'meeshy', isAnonymousMode = false, linkId, initialParticipants }: BubbleStreamPageProps) {

  const { t, isLoading: isLoadingTranslations } = useI18n('conversations');
  const { t: tCommon } = useI18n('common');
  const router = useRouter();
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messageComposerRef = useRef<any>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Ref pour éviter les reconnexions multiples au montage
  const hasInitialized = useRef(false);
  
  // Déterminer la limite de caractères en fonction du rôle de l'utilisateur
  const maxMessageLength = getMaxMessageLength(user?.role);

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
    scrollDirection: 'down', // Scroll vers le bas pour charger plus (page publique)
    disableAutoFill: false // Activer le chargement automatique pour remplir l'écran
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
  const [attachmentMimeTypes, setAttachmentMimeTypes] = useState<string[]>([]);

  // Ref pour stocker les valeurs précédentes d'attachments
  const prevAttachmentIdsRef = useRef<string>('[]');
  const prevMimeTypesRef = useRef<string>('[]');

  // Callback mémorisé pour les changements d'attachments
  // CRITIQUE: Mémoiser pour éviter les boucles infinies dans MessageComposer
  const handleAttachmentsChange = useCallback((ids: string[], mimeTypes: string[]) => {
    // Comparer par valeur sérialisée pour éviter les updates inutiles
    const idsString = JSON.stringify(ids);
    const mimeTypesString = JSON.stringify(mimeTypes);

    // CRITIQUE: Ne mettre à jour QUE si les valeurs ont vraiment changé
    if (idsString !== prevAttachmentIdsRef.current) {
      setAttachmentIds(ids);
      prevAttachmentIdsRef.current = idsString;
    }

    if (mimeTypesString !== prevMimeTypesRef.current) {
      setAttachmentMimeTypes(mimeTypes);
      prevMimeTypesRef.current = mimeTypesString;
    }
  }, []); // Pas de dépendances - les setState et refs sont stables
  // État pour la détection mobile
  const [isMobile, setIsMobile] = useState(false);

  // Debug: log quand attachmentIds change
  useEffect(() => {
  }, [attachmentIds]);
  
  // Détection mobile
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  // État pour la galerie d'images
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [selectedAttachmentId, setSelectedAttachmentId] = useState<string | null>(null);
  const [deletedAttachmentIds, setDeletedAttachmentIds] = useState<string[]>([]);

  // Handler appelé quand un attachment est supprimé
  const handleAttachmentDeleted = useCallback((attachmentId: string) => {
    setDeletedAttachmentIds(prev => [...prev, attachmentId]);
  }, []);

  // Extraire tous les attachments images des messages pour la galerie
  const imageAttachments = useMemo(() => {
    const allAttachments: Attachment[] = [];

    messages.forEach((message: any) => {
      if (message.attachments && Array.isArray(message.attachments)) {
        const imageAtts = message.attachments.filter((att: Attachment) =>
          att.mimeType?.startsWith('image/') && !deletedAttachmentIds.includes(att.id)
        );
        allAttachments.push(...imageAtts);
      }
    });

    return allAttachments;
  }, [messages, deletedAttachmentIds]);

  // Handler pour ouvrir la galerie d'images
  const handleImageClick = useCallback((attachmentId: string) => {
    setSelectedAttachmentId(attachmentId);
    setGalleryOpen(true);
  }, []);

  // Handler pour naviguer vers un message depuis la galerie
  const handleNavigateToMessageFromGallery = useCallback((messageId: string) => {
    
    // Fermer la galerie
    setGalleryOpen(false);
    
    // Attendre que la galerie se ferme avant de scroller
    setTimeout(() => {
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
        
      } else {
        console.warn('⚠️ Message non trouvé dans le DOM:', messageId);
      }
    }, 300); // Délai pour laisser le dialog se fermer
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
    if (messageComposerRef.current) {
      messageComposerRef.current.focus();
    }
  }, []);

  const handleNavigateToMessage = useCallback((messageId: string) => {
    
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
  const getUserModerationRole = useCallback((): UserRoleEnum => {
    // Pour BubbleStreamPage, nous considérons que c'est une conversation publique
    // Les utilisateurs avec des rôles élevés peuvent modérer
    const role = (user.role as UserRoleEnum) ?? UserRoleEnum.USER;

    if (
      role === UserRoleEnum.ADMIN ||
      role === UserRoleEnum.BIGBOSS ||
      role === UserRoleEnum.MODERATOR
    ) {
      return role;
    }
    
    // Pour les conversations publiques, les créateurs peuvent aussi modérer
    // Nous devrions vérifier si l'utilisateur est le créateur de la conversation
    return role;
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

  // ObjectId normalisé du backend (pour "meeshy" → vrai ObjectId)
  const [normalizedConversationId, setNormalizedConversationId] = useState<string | null>(null);

  // Langues utilisées par l'utilisateur (basées sur ses préférences)
  const usedLanguages: string[] = getUserLanguagePreferences();

  // Obtenir les choix de langues pour l'utilisateur via la fonction centralisée
  // CRITIQUE: Mémoiser pour éviter les re-renders infinis
  const languageChoices = useMemo(() => getUserLanguageChoices(user), [
    user.systemLanguage,
    user.regionalLanguage,
    user.customDestinationLanguage
  ]);

  // État pour les utilisateurs en train de taper avec leurs noms
  const [typingUsers, setTypingUsers] = useState<{id: string, displayName: string}[]>([]);

  // Fonctions de gestion des événements utilisateur
  const handleUserTyping = useCallback((userId: string, username: string, isTyping: boolean, typingConversationId: string) => {
    if (userId === user.id) return; // Ignorer nos propres événements de frappe

    // FIX: Filtrer les événements typing par conversation
    // Le client peut être connecté à plusieurs rooms, il faut filtrer pour n'afficher
    // que les indicateurs de frappe de la conversation actuelle
    if (typingConversationId !== conversationIdRef.current) {
      return;
    }

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
  }, [user.id, activeUsers, conversationId]); // Ajouter conversationId aux dépendances

  const handleUserStatus = useCallback((userId: string, username: string, isOnline: boolean) => {
    // Statut utilisateur changé - géré par les événements socket
  }, []);

  const handleTranslation = useCallback((messageId: string, translations: any[]) => {
    
    // Mettre à jour le message avec les nouvelles traductions
    updateMessageTranslations(messageId, (prevMessage) => {
      if (!prevMessage) {
        console.warn('⚠️ [BubbleStreamPage] Message introuvable pour traduction:', messageId);
        return prevMessage;
      }
      
      
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

      const updatedMessage = {
        ...prevMessage,
        translations: updatedTranslations
      };
      
      
      return updatedMessage;
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

  // Refs pour éviter les re-créations du callback
  const conversationIdRef = useRef(conversationId);
  const normalizedConversationIdRef = useRef<string | null>(null); // ObjectId normalisé du backend
  const userRef = useRef(user);
  const isAnonymousModeRef = useRef(isAnonymousMode);
  const activeUsersRef = useRef(activeUsers); // CORRECTION: Ref pour activeUsers

  // Mettre à jour les refs quand les valeurs changent
  useEffect(() => {
    conversationIdRef.current = conversationId;
    // Récupérer l'ObjectId normalisé depuis le service
    const currentNormalizedId = meeshySocketIOService.getCurrentConversationId();
    normalizedConversationIdRef.current = currentNormalizedId;
    if (currentNormalizedId) {
      setNormalizedConversationId(currentNormalizedId);
    }
  }, [conversationId]);

  useEffect(() => {
    activeUsersRef.current = activeUsers;
  }, [activeUsers]);

  // Écouter l'événement CONVERSATION_JOINED pour obtenir l'ObjectId normalisé
  useEffect(() => {
    const unsubscribe = meeshySocketIOService.onConversationJoined((data: { conversationId: string; userId: string }) => {
      normalizedConversationIdRef.current = data.conversationId;
      setNormalizedConversationId(data.conversationId); // Mettre à jour le state pour re-render
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    isAnonymousModeRef.current = isAnonymousMode;
  }, [isAnonymousMode]);

  // Handler pour les nouveaux messages reçus via WebSocket avec traductions optimisées
  // CRITIQUE: Utiliser des REFS pour éviter les re-créations et désinscriptions
  const handleNewMessage = useCallback((message: Message) => {

    // FILTRAGE SIMPLIFIÉ: Le backend envoie maintenant TOUJOURS l'ObjectId normalisé
    // Plus besoin de triple comparaison ni de getCurrentConversationIdentifier()
    const normalizedConvId = meeshySocketIOService.getCurrentConversationId();
    const currentConvId = conversationIdRef.current;

    // Comparer avec l'ObjectId normalisé reçu lors du CONVERSATION_JOINED
    const shouldAccept = message.conversationId === normalizedConvId;


    if (!shouldAccept) {
      return;
    }


    // Message reçu via WebSocket

    // CORRECTION CRITIQUE: Enrichir le message avec les informations du sender si nécessaire
    const enrichedMessage = { ...message };
    const currentUser = userRef.current;
    const currentIsAnonymous = isAnonymousModeRef.current;

    // CAS 1: Si c'est notre propre message et que sender/anonymousSender manque
    if ((message.senderId === currentUser.id || message.anonymousSenderId === currentUser.id) &&
        !message.sender && !message.anonymousSender) {
      if (currentIsAnonymous) {
        enrichedMessage.anonymousSender = {
          id: currentUser.id,
          username: currentUser.username,
          firstName: currentUser.firstName || '',
          lastName: currentUser.lastName || '',
          language: currentUser.systemLanguage || 'fr',
          isMeeshyer: false
        };
      } else {
        enrichedMessage.sender = {
          id: currentUser.id,
          username: currentUser.username,
          email: currentUser.email || '',
          phoneNumber: currentUser.phoneNumber || '',
          firstName: currentUser.firstName || '',
          lastName: currentUser.lastName || '',
          displayName: currentUser.displayName,
          avatar: currentUser.avatar,
          role: currentUser.role,
          isOnline: true,
          lastSeen: new Date(),
          createdAt: currentUser.createdAt || new Date(),
          updatedAt: currentUser.updatedAt || new Date(),
          systemLanguage: currentUser.systemLanguage || 'fr',
          regionalLanguage: currentUser.regionalLanguage || 'fr',
          autoTranslateEnabled: currentUser.autoTranslateEnabled !== false,
          translateToSystemLanguage: currentUser.translateToSystemLanguage !== false,
          translateToRegionalLanguage: currentUser.translateToRegionalLanguage || false,
          useCustomDestination: currentUser.useCustomDestination || false,
          isActive: true,
          lastActiveAt: new Date(),
          isMeeshyer: true
        };
      }
    }

    // CAS 2: CORRECTION MAJEURE - Si c'est un message d'un AUTRE utilisateur anonyme
    // et que anonymousSender manque, l'enrichir depuis activeUsers
    else if (message.anonymousSenderId && !message.anonymousSender) {

      // CORRECTION: Utiliser activeUsersRef.current au lieu de activeUsers
      // pour éviter les problèmes de closure stale dans le callback
      const senderUser = activeUsersRef.current.find(u => u.id === message.anonymousSenderId);

      if (senderUser) {

        enrichedMessage.anonymousSender = {
          id: senderUser.id,
          username: senderUser.username,
          firstName: senderUser.firstName || '',
          lastName: senderUser.lastName || '',
          language: senderUser.systemLanguage || 'fr',
          isMeeshyer: false
        };
      } else {
        console.warn('[BubbleStreamPage] ⚠️ Utilisateur anonyme non trouvé dans activeUsers:', {
          anonymousSenderId: message.anonymousSenderId,
          activeUsersIds: activeUsersRef.current.map(u => u.id)
        });

        // Fallback: créer un anonymousSender minimal pour éviter les bugs d'affichage
        enrichedMessage.anonymousSender = {
          id: message.anonymousSenderId,
          username: `Anonymous_${message.anonymousSenderId.slice(-6)}`,
          firstName: '',
          lastName: '',
          language: 'fr',
          isMeeshyer: false
        };
      }
    }

    // Ajouter le message enrichi à la liste (il sera inséré au début grâce au hook)
    addMessage(enrichedMessage);

    // Scroll automatique pour les nouveaux messages d'autres utilisateurs
    if (message.senderId !== currentUser.id && message.anonymousSenderId !== currentUser.id) {
      // Scroll automatique SEULEMENT si l'utilisateur est déjà proche du haut (pour scrollDirection='down')
      setTimeout(() => {
        if (messagesContainerRef.current) {
          const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
          
          // En mode scrollDirection='down' (BubbleStream), les nouveaux messages sont EN HAUT
          // Donc on scroll vers le haut (top: 0) si l'utilisateur est déjà proche du haut
          if (scrollTop < 300) {
            messagesContainerRef.current.scrollTo({
              top: 0,
              behavior: 'smooth'
            });
          }
        }
      }, 300);
    }
  }, [addMessage]); // CRITIQUE: Deps minimales pour éviter re-créations et désinscriptions

  // Hook pour les statistiques de traduction de messages
  const { stats: translationStats, incrementTranslationCount } = useMessageTranslation();
  
  const {
    sendMessage: sendMessageToService,
    connectionStatus,
    startTyping,
    stopTyping,
    reconnect,
    getDiagnostics
  } = useSocketIOMessaging({
    conversationId: conversationId, // Utiliser le conversationId passé en props
    currentUser: user,
    onNewMessage: handleNewMessage,
    onMessageEdited: (message: Message) => {
      updateMessageTranslations(message.id, message);
      toast.info(tCommon('messages.messageEditedByOther'));
    },
    onMessageDeleted: (messageId: string) => {
      removeMessage(messageId);
      toast.info(tCommon('messages.messageDeletedByOther'));
    },
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
        // Inclure l'utilisateur connecté dans la liste
        const usersToDisplay = [...data.onlineUsers];

        // Ajouter l'utilisateur actuel s'il n'est pas déjà dans la liste
        if (!usersToDisplay.find((u: any) => u.id === user?.id)) {
          usersToDisplay.unshift({
            id: user?.id,
            username: user?.username,
            firstName: user?.firstName,
            lastName: user?.lastName,
            avatar: user?.avatar,
            email: user?.email,
            systemLanguage: user?.systemLanguage,
            displayName: user?.displayName
          });
        }

        setActiveUsersDeduped(usersToDisplay.map((u: any) => ({
          id: u.id,
          username: u.username,
          firstName: u.firstName,
          lastName: u.lastName,
          email: u.email || '',
          avatar: u.avatar || '',
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
          systemLanguage: u.systemLanguage || 'fr',
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

  // Initialisation de la connexion WebSocket en temps réel (UNE SEULE FOIS au montage)
  useEffect(() => {
    // CORRECTION CRITIQUE: N'initialiser QU'UNE SEULE FOIS pour éviter la boucle de reconnexion
    if (hasInitialized.current) {
      return;
    }
    
    
    // Attendre que les traductions soient chargées avant d'afficher les toasts
    if (isLoadingTranslations) {
      return;
    }

    hasInitialized.current = true;

    // OPTIMISATION: Appeler reconnect() automatiquement au chargement
    // Cela garantit que la connexion WebSocket est établie dès le début
    const reconnectTimeout = setTimeout(() => {
      reconnect();
    }, 500); // Petit délai pour laisser le temps à l'authentification

    // Délai pour vérifier la connexion établie
    const initTimeout = setTimeout(() => {
      const newDiagnostics = getDiagnostics();
      
      if (connectionStatus.isConnected && connectionStatus.hasSocket && !hasShownConnectionToast) {
        setHasShownConnectionToast(true);
      } else if (!connectionStatus.isConnected || !connectionStatus.hasSocket) {
        // Toast de connexion supprimé pour éviter les notifications intrusives
      }
    }, 3000);

    return () => {
      clearTimeout(reconnectTimeout);
      clearTimeout(initTimeout);
    };
  }, [isLoadingTranslations, t, reconnect, getDiagnostics]);
  
  // Surveillance de l'état de connexion (SANS déclencher de reconnexion)
  useEffect(() => {
    if (!hasInitialized.current) {
      return;
    }
    
    // Afficher le toast de confirmation UNE SEULE FOIS
    if (connectionStatus.isConnected && connectionStatus.hasSocket && !hasShownConnectionToast) {
      setHasShownConnectionToast(true);
    }
  }, [connectionStatus.isConnected, connectionStatus.hasSocket, hasShownConnectionToast, t]);

  // Surveillance du statut de connexion WebSocket
  useEffect(() => {
    const checkConnection = () => {
      const isReallyConnected = connectionStatus.isConnected && connectionStatus.hasSocket;

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
        }
      );
    }
  }, []);

  // Détection automatique de langue pour affichage informatif uniquement (pas de mise à jour automatique)
  useEffect(() => {
    if (newMessage.trim().length > 15) { // Seuil plus élevé pour une meilleure détection
      const detectedLang = detectLanguage(newMessage);
      setDetectedLanguage(detectedLang);
    }
  }, [newMessage]);

  // Définir le callback pour récupérer un message par ID (utilise la liste messages existante)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const meeshySocketIOService = require('@/services/meeshy-socketio.service').meeshySocketIOService;
      const getMessageById = (messageId: string) => {
        return (messages as Message[]).find(msg => msg.id === messageId);
      };
      meeshySocketIOService.setGetMessageByIdCallback(getMessageById);
    }
  }, [messages]);

  // Mise à jour de la langue sélectionnée basée sur les préférences utilisateur uniquement
  useEffect(() => {
    const newUserLanguage = resolveUserPreferredLanguage();
    setUserLanguage(newUserLanguage);
  }, [user.systemLanguage, user.regionalLanguage, user.customDestinationLanguage, resolveUserPreferredLanguage]);

  // Validation de la langue sélectionnée - Effet séparé pour éviter les boucles
  useEffect(() => {
    const availableLanguageCodes = languageChoices.map(choice => choice.code);
    if (!availableLanguageCodes.includes(selectedInputLanguage)) {
      // Si la langue sélectionnée n'est plus dans les choix, revenir à la langue système
      setSelectedInputLanguage(user.systemLanguage || 'fr');
    }
  }, [languageChoices, selectedInputLanguage, user.systemLanguage]);

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
      
      if (!hasShownConnectionToast) {
        setHasShownConnectionToast(true);
      }
    }
  }, [connectionStatus.isConnected, hasShownConnectionToast, isLoadingTranslations, t]);

  // Gérer l'état d'initialisation global
  useEffect(() => {
    if (hasLoadedMessages && !isLoadingMessages) {
      setIsInitializing(false);
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
    if (messages.length > 0) {
      // Calculer les statistiques des langues des messages
      const languageCounts: { [key: string]: number } = {};
      const userLanguages: { [key: string]: Set<string> } = {}; // Pour les langues des utilisateurs
      
      messages.forEach(message => {
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
  }, [messages.length]); // Supprimé les dépendances qui causent des boucles

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
    if ((!newMessage.trim() && attachmentIds.length === 0) || newMessage.length > maxMessageLength) {
      return;
    }

    const messageContent = newMessage.trim();
    const replyToId = useReplyStore.getState().replyingTo?.id;
    const hasAttachments = attachmentIds.length > 0;
    
    
    // Arrêter immédiatement l'indicateur de frappe lors de l'envoi
    if (isTyping) {
      setIsTyping(false);
      stopTyping();
    }
    
    // Nettoyer le timeout de frappe
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    
    setNewMessage(''); // Réinitialiser immédiatement pour éviter les doubles envois
    
    // Effacer l'état de réponse après l'envoi
    if (replyToId) {
      useReplyStore.getState().clearReply();
    }
    
    // Clear les attachments après l'envoi
    const currentAttachmentIds = [...attachmentIds];
    const currentAttachmentMimeTypes = [...attachmentMimeTypes];
    setAttachmentIds([]);
    setAttachmentMimeTypes([]);
    
    // Clear les attachments du composer
    if (messageComposerRef.current && messageComposerRef.current.clearAttachments) {
      messageComposerRef.current.clearAttachments();
    }

    try {
      // Vérifier l'état de la connexion avant l'envoi
      if (!connectionStatus.isConnected) {
        // Toast de connexion supprimé pour éviter les notifications intrusives
        // Restaurer le message pour permettre un nouvel essai
        setNewMessage(messageContent);
        setAttachmentIds(currentAttachmentIds);
        setAttachmentMimeTypes(currentAttachmentMimeTypes);
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
        
        
        // Extraire les mentions depuis le composer
        const mentionedUserIds = messageComposerRef.current?.getMentionedUserIds?.() || [];

        // Envoyer le message (avec ou sans attachments, avec ou sans mentions)
        const sendResult = await sendMessageToService(
          messageContent,
          selectedInputLanguage,
          replyToId,
          mentionedUserIds,
          hasAttachments ? currentAttachmentIds : undefined,
          hasAttachments ? attachmentMimeTypes : undefined
        );
        
        if (sendResult) {
          toast.success(tCommon('messages.messageSent'));

          // Clear les mentions du composer après envoi réussi
          if (messageComposerRef.current && messageComposerRef.current.clearMentionedUserIds) {
            messageComposerRef.current.clearMentionedUserIds();
          }

          // Log pour le debug - La langue source sera utilisée côté serveur

          // Scroll automatique vers le HAUT pour voir le message envoyé (scrollDirection='down')
          // Utiliser plusieurs tentatives pour s'assurer que le scroll fonctionne
          const scrollToTop = () => {
            if (messagesContainerRef.current) {
              messagesContainerRef.current.scrollTo({
                top: 0,
                behavior: 'smooth'
              });
            }
          };

          // Premier scroll rapide
          setTimeout(scrollToTop, 100);
          // Deuxième scroll pour assurer que le message est dans le DOM
          setTimeout(scrollToTop, 500);
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
        
        /* Force popover visibility in BubbleStream */
        .radix-popover-fixed {
          z-index: 99999 !important;
          position: fixed !important;
          pointer-events: auto !important;
          overflow: visible !important;
        }
        
        /* Ensure parent containers don't clip popovers */
        .bubble-message-container {
          overflow: visible !important;
        }
        
        .bubble-message {
          overflow: visible !important;
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
            height: 100dvh !important; /* Dynamic viewport height pour mobile */
            z-index: 40 !important;
            overflow: visible !important; /* Changed to visible for popovers */
          }
          
          .mobile-messages-container {
            min-height: 100vh !important;
            min-height: 100dvh !important; /* Dynamic viewport height */
            padding-top: 5rem !important;
            padding-bottom: 2rem !important; /* Augmenté pour laisser plus d'espace sous la zone de saisie */
            margin-bottom: 0 !important;
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
      
      {/* Conteneur principal avec gradient - Hauteur fixe sans scroll */}
      <div className="flex h-full min-h-0 w-full flex-col bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="flex h-full min-h-0 w-full flex-col xl:flex-row">
          {/* Colonne principale */}
          <section className="grid flex-1 min-h-0 grid-rows-[auto,1fr,auto] overflow-hidden">
            {/* Indicateur dynamique - Frappe prioritaire sur connexion */}
            <div className="row-start-1 px-4 pt-4 pb-2 sm:px-6 lg:px-8 bg-gradient-to-b from-blue-50 to-transparent dark:from-gray-900/80 dark:to-transparent pointer-events-none hidden md:block">
              <div className="pointer-events-auto">
                {typingUsers.length > 0 && connectionStatus.isConnected ? (
                  <div className="inline-flex items-center space-x-2 px-4 py-2 rounded-full text-sm backdrop-blur-sm bg-blue-100/90 text-blue-800 dark:bg-blue-900/90 dark:text-blue-200 border border-blue-200/80 dark:border-blue-700/80 transition-all">
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
                  <div className={`inline-flex items-center space-x-2 px-3 py-1 rounded-full text-sm backdrop-blur-sm transition-all ${
                    connectionStatus.isConnected && connectionStatus.hasSocket
                      ? 'bg-green-100/80 text-green-800 dark:bg-green-900/80 dark:text-green-200 border border-green-200/60 dark:border-green-700/60' 
                      : 'bg-orange-100/80 text-orange-800 dark:bg-orange-900/80 dark:text-orange-200 border border-orange-200/60 dark:border-orange-700/60'
                  }`}>
                    <div className={`w-2 h-2 rounded-full animate-pulse ${
                      connectionStatus.isConnected && connectionStatus.hasSocket ? 'bg-green-600 dark:bg-green-400' : 'bg-orange-600 dark:bg-orange-400'
                    }`} />
                    <span className="font-medium">
                      {t('bubbleStream.realTimeMessages')}
                    </span>
                    {!(connectionStatus.isConnected && connectionStatus.hasSocket) && (
                      <span className="text-xs opacity-75">• {t('bubbleStream.connectionInProgress')}</span>
                    )}
                    {!(connectionStatus.isConnected && connectionStatus.hasSocket) && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => reconnect()}
                        className="ml-2 text-xs px-2 py-1 h-auto hover:bg-orange-200/50 dark:hover:bg-orange-800/50"
                      >
                        {t('bubbleStream.reconnect')}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Feed principal - Container de scroll avec ref pour le scroll infini */}
            <div
              ref={messagesContainerRef}
              className="row-start-2 min-h-0 h-full overflow-y-auto overflow-x-hidden bg-gradient-to-b from-blue-50/50 to-white dark:from-gray-900/50 dark:to-gray-950"
            >
              <ConversationMessages
                messages={messages}
                translatedMessages={messages as any}
                isLoadingMessages={isLoadingMessages}
                isLoadingMore={isLoadingMore}
                hasMore={hasMore}
                currentUser={user}
                userLanguage={userLanguage}
                usedLanguages={usedLanguages}
                isMobile={isMobile}
                conversationType="public"
                userRole={getUserModerationRole()}
                conversationId={normalizedConversationId || conversationId}
                isAnonymous={isAnonymousMode}
                currentAnonymousUserId={isAnonymousMode ? user.id : undefined}
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
                reverseOrder={false}
                scrollDirection="down"
                scrollButtonDirection="up"
                scrollContainerRef={messagesContainerRef}
              />
            </div>

            {/* Zone de composition dans le flux */}
            <div className="z-30 row-start-3 border-t border-gray-200/70 bg-white/98 backdrop-blur-xl shadow-2xl dark:border-gray-700/70 dark:bg-gray-950/98">
              <div className="w-full px-4 sm:px-6 lg:px-8 py-4">
                <MessageComposer
                  ref={messageComposerRef}
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
                  onAttachmentsChange={handleAttachmentsChange}
                  token={typeof window !== 'undefined' ? getAuthToken()?.value : undefined}
                  userRole={user?.role}
                  conversationId={normalizedConversationId || conversationId}
                />
              </div>
            </div>
          </section>

          {/* Sidebar droite - Desktop uniquement */}
          <aside className="hidden xl:flex xl:w-80 xl:flex-col bg-white/60 dark:bg-gray-900/80 backdrop-blur-lg border-l border-blue-200/30 dark:border-gray-800/50">
            <div className="flex-1 overflow-y-auto p-6 scroll-hidden">
              <SidebarLanguageHeader 
                languageStats={messageLanguageStats} 
                userLanguage={userLanguage}
              />

              <FoldableSection
                title={t('bubbleStream.activeLanguages')}
                icon={<Languages className="h-4 w-4 mr-2" />}
                defaultExpanded={true}
              >
                <LanguageIndicators languageStats={activeLanguageStats} />
              </FoldableSection>

              <FoldableSection
                title={`${tCommon('sidebar.activeUsers')} (${activeUsers.length})`}
                icon={<Users className="h-4 w-4 mr-2" />}
                defaultExpanded={true}
              >
                <div className="space-y-3">
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

              <div className="opacity-60 saturate-50 bg-gray-50/50 dark:bg-gray-800/50 rounded-lg p-2 mt-6">
                <Card className="mb-6 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-gray-200/50 dark:border-gray-700/50 shadow-lg dark:shadow-gray-900/30">
                  <CardContent className="p-0">
                    <div className="flex items-center justify-between p-4 bg-gray-50/80 dark:bg-gray-700/50">
                      <h3 className="font-semibold text-gray-500 dark:text-gray-400 flex items-center">
                        <TrendingUp className="h-4 w-4 mr-2 text-gray-400 dark:text-gray-500" />
                        {tCommon('sidebar.trends')}
                      </h3>
                      <ChevronDown className="h-4 w-4 text-gray-300 dark:text-gray-600" />
                    </div>

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
          </aside>
        </div>
      </div>

      {/* Galerie d'images */}
      <AttachmentGallery
        conversationId={normalizedConversationId || conversationId}
        initialAttachmentId={selectedAttachmentId || undefined}
        open={galleryOpen}
        onClose={() => setGalleryOpen(false)}
        onNavigateToMessage={handleNavigateToMessageFromGallery}
        token={typeof window !== 'undefined' ? getAuthToken()?.value : undefined}
        attachments={imageAttachments}
        currentUserId={user?.id}
        onAttachmentDeleted={handleAttachmentDeleted}
      />
    </>
  );
}