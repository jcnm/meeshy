
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUser } from '@/context/AppContext';
import { useMessageSender } from '@/hooks/use-message-sender';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  MessageSquare,
  Users,
  Plus,
  Send,
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
} from '@/types';
import { conversationsService } from '@/services/conversations.service';
import { BubbleMessage } from '@/components/common/bubble-message';
import { MessageComposer, MessageComposerRef } from '@/components/common/message-composer';
import { CreateLinkModal } from './create-link-modal';
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
import { 
  translationDataToBubbleTranslation, 
  getUserTranslation,
  type BubbleTranslation 
} from '@/utils/translation-adapter';
import { TypingIndicator } from '@/components/conversations/typing-indicator';
import { ConversationParticipants } from '@/components/conversations/conversation-participants';
import { ConversationParticipantsPopover } from '@/components/conversations/conversation-participants-popover';
import { CreateLinkButton } from '@/components/conversations/create-link-button';
import { getUserLanguageChoices } from '@/utils/user-language-preferences';
import { useMessageLoader } from '@/hooks/use-message-loader';
import AuthDiagnostic from '@/components/debug/auth-diagnostic';

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
  const { user } = useUser(); // user est garanti d'exister grâce au wrapper

  // Assertion de sécurité : user est garanti non-null par le wrapper
  if (!user) {
    throw new Error('ConversationLayoutResponsive: user should not be null when wrapped by ConversationLayoutWrapper');
  }

  // États principaux
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [conversationParticipants, setConversationParticipants] = useState<ThreadMember[]>([]);
  const [onlineParticipants, setOnlineParticipants] = useState<ThreadMember[]>([]);
  const [showOnlineOnly, setShowOnlineOnly] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('fr'); // Langue pour l'envoi des messages
  const [isLoading, setIsLoading] = useState(true);

  // États UI responsive
  const [showConversationList, setShowConversationList] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  // États modaux
  const [isCreateLinkModalOpen, setIsCreateLinkModalOpen] = useState(false);
  const [isCreateConversationModalOpen, setIsCreateConversationModalOpen] = useState(false);
  const [isDetailsSidebarOpen, setIsDetailsSidebarOpen] = useState(false);

  // États de traduction
  const [selectedTranslationModel, setSelectedTranslationModel] = useState<string>('api-service');

  // Hook pour le chargement des messages
  const {
    messages,
    translatedMessages,
    isLoadingMessages,
    loadMessages,
    clearMessages,
    addMessage,
    updateMessageTranslations
  } = useMessageLoader({
    currentUser: user!, // user est garanti d'exister après les checks
    conversationId: selectedConversation?.id
  });

  // Ref pour le scroll automatique vers le dernier message
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messageComposerRef = useRef<MessageComposerRef>(null);

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
      displayName = username;
    } else {
      displayName = `Utilisateur ${userId.slice(-6)}`;
    }
    
    console.log('✍️ [Conversation] Utilisateur en train de taper:', { 
      userId, 
      displayName, 
      participantFound: !!participant,
      conversationId: selectedConversation?.id 
    });
    
    // Ici on pourrait ajouter une logique pour afficher l'indicateur de frappe
    // Par exemple, mettre à jour un état local pour l'affichage
  }, [user?.id, conversationParticipants, selectedConversation?.id]);

  // Hook de messagerie réutilisable basé sur BubbleStreamPage
  const {
    isSending,
    connectionStatus,
    sendMessage: sendMessageToService,
    startTyping,
    stopTyping,
    reconnect,
    getDiagnostics
  } = useMessageSender({
    conversationId: selectedConversation?.id,
    currentUser: user!, // user est garanti d'exister
    onUserTyping: handleUserTyping, // Ajouter le gestionnaire de frappe
    onNewMessage: (message: Message) => {
      // Vérifier que le message appartient à la conversation active
      if (selectedConversation?.id && message.conversationId !== selectedConversation.id) {
        return;
      }

      // Ajouter le message en temps réel à la liste affichée
      addMessage(message);

      // Mettre à jour la conversation avec le dernier message
      setConversations(prev => prev.map(
        conv => conv.id === message.conversationId
          ? { ...conv, lastMessage: message, updatedAt: new Date() }
          : conv
      ));

      // Scroller vers le bas pour voir le nouveau message
      setTimeout(() => {
        try {
          const container = messagesContainerRef.current;
          if (container) {
            container.scrollTop = container.scrollHeight;
          }
        } catch {}
      }, 100);
    },
    onTranslation: (messageId: string, translations: any[]) => {
      console.log('🌐 [Conversation] Traductions reçues pour message:', messageId, translations);
      // Appliquer les traductions au message concerné via le loader commun
      updateMessageTranslations(messageId, translations);
    },
    onMessageSent: (content: string, language: string) => {
      console.log('✅ Message envoyé avec succès:', { content: content.substring(0, 50) + '...', language });
      // Scroller vers le bas après l'envoi
      setTimeout(scrollToBottom, 200);
    },
    onMessageFailed: (content: string, error: Error) => {
      console.error('❌ Échec d\'envoi du message:', { content: content.substring(0, 50) + '...', error });
      // Restaurer le message en cas d'erreur
      setNewMessage(content);
    }
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
        console.log('🔽 Scroll forcé vers le bas (message envoyé)');
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
      console.log(`🔄 Traduction avec modèle sélectionné: ${selectedTranslationModel}`);

      // Afficher un indicateur de traduction en cours
      toast.loading('Traduction en cours...', { id: `translate-${messageId}` });

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
        console.log('🔄 Forcer la retraduction du message');
        toast.loading('Retraduction forcée en cours...', { id: `retranslate-${messageId}` });
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
          translationModel: selectedTranslationModel,
          cacheKey: `${messageId}-${targetLanguage}`,
          cached: false
        }],
        sender: message.sender ? socketIOUserToUser(message.sender) : createDefaultUser(message.senderId)
      };



      console.log(`✅ Message traduit avec ${selectedTranslationModel}: ${translationResult.translatedText}`);
      toast.success(`Message traduit avec ${selectedTranslationModel}`, { id: `translate-${messageId}` });

    } catch (error) {
      console.error('❌ Erreur lors de la traduction:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erreur lors de la traduction du message';
      toast.error(errorMessage, { id: `translate-${messageId}` });
    }
  };

  const handleEdit = async (messageId: string, newContent: string) => {
    console.log('Edit message:', messageId, 'New content:', newContent);
    toast.info('Édition de message bientôt disponible');
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

      // Ajouter la conversation globale "any" si elle n'est pas déjà présente
      let conversationsWithAny = [...conversationsData];
      const hasAnyConversation = conversationsData.some(c => c.id === 'any');
      
      if (!hasAnyConversation) {
        const anyConversation: Conversation = {
          id: 'any',
          name: 'Meeshy',
          title: 'Meeshy',
          type: 'global',
          isGroup: true,
          isActive: true,
          participants: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          unreadCount: 0
        };
        // Ajouter en premier dans la liste
        conversationsWithAny = [anyConversation, ...conversationsData];
      }

      setConversations(conversationsWithAny);

      // Sélectionner une conversation seulement si spécifiée dans l'URL
      const conversationIdFromUrl = searchParams.get('id') || selectedConversationId;
      if (conversationIdFromUrl) {
        let conversation = conversationsWithAny.find(c => c.id === conversationIdFromUrl);
        
        if (conversation) {
          setSelectedConversation(conversation);
          // NOTE: La gestion WebSocket sera faite dans un useEffect séparé
          // Le chargement des messages sera géré par l'effet useEffect
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
      toast.error('Impossible de charger les conversations');
      
      // Laisser la liste de conversations vide pour utiliser les seeds de la DB
      setConversations([]);
      setIsLoading(false);
    }
  }, [user, searchParams, selectedConversationId, router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Redirection automatique (optionnelle)
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (user && token) {
      // Debug: vérifier que l'utilisateur est bien configuré
      console.log('🔐 ConversationLayoutResponsive: Utilisateur authentifié', {
        userId: user.id,
        username: user.username,
        hasToken: !!token,
        tokenPreview: token ? token.substring(0, 20) + '...' : 'none'
      });
    }
  }, [user, router]);

  // Sélectionner une conversation
  const handleSelectConversation = (conversation: Conversation) => {
    // Si c'est la même conversation, ne rien faire
    if (selectedConversation?.id === conversation.id) {
      console.log('📬 Conversation déjà sélectionnée');
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

    console.log('📤 Envoi du message:', messageContent);
    console.log('🔤 Langue sélectionnée par l\'utilisateur:', selectedLanguage);

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
      // Charger tous les participants
      const allParticipants = await conversationsService.getParticipants(conversationId);
      
      // Charger les participants en ligne
      const onlineParticipants = await conversationsService.getParticipants(conversationId, { onlineOnly: true });
      
      // Transformer tous les participants en ThreadMember
      const allThreadMembers: ThreadMember[] = allParticipants.map((user, index) => ({
        id: `participant-${conversationId}-${user.id}`,
        conversationId: conversationId,
        userId: user.id,
        joinedAt: new Date(), // On n'a pas cette info pour l'instant
        role: 'MEMBER' as const, // On n'a pas cette info pour l'instant
        user: user
      }));
      
      // Transformer les participants en ligne en ThreadMember
      const onlineThreadMembers: ThreadMember[] = onlineParticipants.map((user, index) => ({
        id: `participant-${conversationId}-${user.id}`,
        conversationId: conversationId,
        userId: user.id,
        joinedAt: new Date(),
        role: 'MEMBER' as const,
        user: user
      }));
      
      setConversationParticipants(allThreadMembers);
      setOnlineParticipants(onlineThreadMembers);
      
      console.log(`📊 Participants chargés: ${allThreadMembers.length} total, ${onlineThreadMembers.length} en ligne`);
    } catch (error) {
      console.error('Erreur lors du chargement des participants:', error);
      setConversationParticipants([]);
      setOnlineParticipants([]);
    }
  }, []);

  // Effet pour gérer le changement de conversation
  useEffect(() => {
    // Si on a une conversation sélectionnée, charger ses messages et participants
    if (selectedConversation?.id) {
      loadMessages(selectedConversation.id, true);
      loadConversationParticipants(selectedConversation.id);
    } else {
      // Aucune conversation sélectionnée, vider les messages et participants
      clearMessages();
      setConversationParticipants([]);
      setOnlineParticipants([]);
    }
  }, [selectedConversation?.id, loadMessages, clearMessages, loadConversationParticipants]);

  return (
    <DashboardLayout title="Conversations">
      <AuthDiagnostic />
      {isLoading ? (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Chargement des conversations...</p>
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
                  <h2 className="text-xl font-bold text-foreground">Conversations</h2>
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

              {/* Sélecteur de modèle de traduction */}
              <div className="mb-2">
                <label className="text-sm font-medium text-muted-foreground mb-2 block">
                  Modèle de traduction
                </label>
                <Select
                  value={selectedTranslationModel}
                  onValueChange={(value) => setSelectedTranslationModel(value)}
                >
                  <SelectTrigger className="w-full h-8 text-sm">
                    <SelectValue placeholder="Choisir un modèle" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="api-service">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-full bg-green-500"
                        />
                        <span className="text-sm">Service API</span>
                        <Badge variant="default" className="text-xs px-1 py-0 bg-green-500">
                          Actif
                        </Badge>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Liste scrollable */}
            <div className="flex-1 overflow-y-auto">
              {/* Debug info */}
              {process.env.NODE_ENV === 'development' && (
                <div className="p-2 bg-yellow-100 text-yellow-800 text-xs">
                  Debug: {conversations.length} conversations | Loading: {isLoading ? 'oui' : 'non'} | User: {user ? 'connecté' : 'non connecté'}
                </div>
              )}
              
              {conversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                  <MessageSquare className="h-16 w-16 text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    {isLoading ? 'Chargement...' : 'Aucune conversation'}
                  </h3>
                  <p className="text-muted-foreground mb-6">
                    {isLoading 
                      ? 'Récupération de vos conversations...' 
                      : 'Commencez une nouvelle conversation pour discuter avec vos amis !'
                    }
                  </p>
                </div>
              ) : (
                <div className="p-2">
                  {/* Séparer les conversations en publiques et privées */}
                  {(() => {
                    const publicConversations = conversations.filter(conv => 
                      conv.id === 'any' || conv.type === 'GLOBAL' || !conv.isPrivate
                    );
                    const privateConversations = conversations.filter(conv => 
                      conv.id !== 'any' && conv.type !== 'GLOBAL' && conv.isPrivate
                    );

                    return (
                      <>
                        {/* Section Conversations Publiques */}
                        {publicConversations.length > 0 && (
                          <div className="mb-6">
                            <div className="px-4 py-2 mb-3">
                              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                                Public
                              </h3>
                            </div>
                            <div className="space-y-2">
                              {publicConversations.map((conversation) => (
                                <div
                                  key={conversation.id}
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
                                        {conversation.isGroup ? (
                                          <Users className="h-6 w-6" />
                                        ) : (
                                          getConversationAvatar(conversation)
                                        )}
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
                                Privé
                              </h3>
                            </div>
                            <div className="space-y-2">
                              {privateConversations.map((conversation) => (
                                <div
                                  key={conversation.id}
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
                                        {conversation.isGroup ? (
                                          <Users className="h-6 w-6" />
                                        ) : (
                                          getConversationAvatar(conversation)
                                        )}
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
              <div className="flex gap-3">
                <Button
                  className="flex-1 rounded-2xl h-12 bg-primary/10 hover:bg-primary/20 border-0 text-primary font-semibold"
                  onClick={() => setIsCreateLinkModalOpen(true)}
                >
                  <Link2 className="h-5 w-5 mr-2" />
                  Créer un lien
                </Button>
                <Button
                  className="flex-1 rounded-2xl h-12 bg-primary/10 hover:bg-primary/20 border-0 text-primary font-semibold"
                  onClick={() => setIsCreateConversationModalOpen(true)}
                >
                  <Plus className="h-5 w-5 mr-2" />
                  Nouvelle conversation
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
                          {selectedConversation.isGroup ? (
                            <Users className="h-5 w-5" />
                          ) : (
                            getConversationAvatar(selectedConversation)
                          )}
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
                          className="mt-1"
                        />
                      </div>
                    </div>
                    
                    {/* Bouton pour créer un lien */}
                    <CreateLinkButton
                      conversationId={selectedConversation.id}
                      isGroup={selectedConversation.isGroup || false}
                      onLinkCreated={(link) => {
                        console.log('Lien créé:', link);
                      }}
                    />

                    {/* Bouton pour afficher les participants */}
                    <ConversationParticipantsPopover
                      conversationId={selectedConversation.id}
                      participants={conversationParticipants}
                      currentUser={user}
                      isGroup={selectedConversation.isGroup || false}
                      onParticipantRemoved={(userId) => {
                        console.log('Participant supprimé:', userId);
                        // Recharger les participants
                        loadConversationParticipants(selectedConversation.id);
                      }}
                      onParticipantAdded={(userId) => {
                        console.log('Participant ajouté:', userId);
                        // Recharger les participants
                        loadConversationParticipants(selectedConversation.id);
                      }}
                      onLinkCreated={(link) => {
                        console.log('Lien créé depuis popover:', link);
                      }}
                    />

                    {/* Bouton pour ouvrir les détails */}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setIsDetailsSidebarOpen(true)}
                      className="rounded-full h-10 w-10 p-0 hover:bg-accent/50"
                      title="Détails de la conversation"
                    >
                      <Info className="h-5 w-5" />
                    </Button>
                  </div>
                </div>

                {/* Messages scrollables */}
                <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 bg-white/50 backdrop-blur-sm messages-container scroll-optimized scrollbar-thin">
                  {isLoadingMessages ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                        <p className="text-muted-foreground">Chargement des messages...</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {translatedMessages.map((message) => {
                        // Langues utilisées (similaire à bubble-stream-page)
                        const usedLanguages: string[] = [
                          user.regionalLanguage,
                          user.customDestinationLanguage
                        ].filter((lang): lang is string => Boolean(lang)).filter(lang => lang !== user.systemLanguage);
                        
                        return (
                          <BubbleMessage
                            key={message.id}
                            message={message as any}
                            currentUser={user}
                            userLanguage={user.systemLanguage}
                            usedLanguages={usedLanguages}
                            onForceTranslation={async (messageId: string, targetLanguage: string) => {
                              try {
                                console.log('🔄 Forcer la traduction dans conversation:', { messageId, targetLanguage });
                                
                                // Récupérer la langue source du message
                                const message = messages.find(m => m.id === messageId);
                                const sourceLanguage = message?.originalLanguage || message?.content ? 'fr' : undefined;
                                
                                console.log('🔤 Langue source détectée pour la traduction forcée:', sourceLanguage);

                                const result = await messageTranslationService.requestTranslation({
                                  messageId,
                                  targetLanguage,
                                  sourceLanguage,
                                  model: 'basic'
                                });
                                console.log('✅ Traduction forcée demandée:', result);
                                toast.success(`Traduction en cours...`);
                              } catch (error) {
                                console.error('❌ Erreur traduction forcée:', error);
                                toast.error('Erreur lors de la demande de traduction');
                              }
                            }}
                          />
                        );
                      })}
                      {/* Élément invisible pour le scroll automatique */}
                      <div ref={messagesEndRef} />
                    </div>
                  )}
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
                    placeholder="Écris ton message..."
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
                      <h3 className="text-xl font-bold text-foreground mb-2 text-center">Choisis une conversation !</h3>
                      <p className="text-muted-foreground text-base mb-6 text-center">
                        Clique sur une conversation à gauche pour commencer à discuter
                      </p>
                    </>
                  ) : (
                    <>
                      <h3 className="text-xl font-bold text-foreground mb-2 text-center">Bienvenue ! 🎉</h3>
                      <p className="text-muted-foreground text-base mb-6 text-center">
                        Tu n&apos;as pas encore de conversations. Commence par en créer une !
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
                    <Plus className="h-5 w-5 mr-2" />
                    Nouvelle conversation
                  </Button>
                  <Button
                    onClick={() => setIsCreateLinkModalOpen(true)}
                    variant="outline"
                    className="rounded-2xl px-6 py-3 border-2 border-primary/20 hover:border-primary/40 font-semibold shadow-md hover:shadow-lg transition-all"
                  >
                    <Link2 className="h-5 w-5 mr-2" />
                    Créer un lien
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modales */}
      <CreateLinkModal
        isOpen={isCreateLinkModalOpen}
        onClose={() => setIsCreateLinkModalOpen(false)}
        onLinkCreated={() => {
          console.log('Lien créé');
          loadData();
        }}
      />

      <CreateConversationModal
        isOpen={isCreateConversationModalOpen}
        onClose={() => setIsCreateConversationModalOpen(false)}
        currentUser={user}
        onConversationCreated={() => {
          console.log('Conversation créée');
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


