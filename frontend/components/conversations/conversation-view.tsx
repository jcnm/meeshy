'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Send,
  MoreVertical,
  Users,
  Settings,
  UserPlus,
  Phone,
  Video,
  Info,
  Users as UsersIcon,
  Search
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { User, 
  Conversation, 
  Message, 
  TranslatedMessage,
  Translation, 
  SUPPORTED_LANGUAGES } from '@/types';
import { TranslationData } from '@/shared/types';
import { MessageBubbleAdapter } from './message-bubble-adapter';
import { useTranslation } from '@/hooks/use-translation';
import { useMessageSender } from '@/hooks/use-message-sender';
import { toast } from 'sonner';

interface ConversationViewProps {
  conversation: Conversation;
  messages: Message[];
  newMessage: string;
  onNewMessageChange: (message: string) => void;
  onSendMessage: () => void;
  onKeyPress: (e: React.KeyboardEvent) => void;
  currentUser: User;
  typingUsers: string[];
  onNewMessage?: (message: Message) => void; // Callback pour les nouveaux messages
}

export function ConversationView({
  conversation,
  messages,
  newMessage,
  onNewMessageChange,
  onSendMessage,
  onKeyPress,
  currentUser,
  typingUsers,
  onNewMessage
}: ConversationViewProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);

  // États pour la gestion des traductions et affichages
  const [translatedMessages, setTranslatedMessages] = useState<Map<string, TranslatedMessage>>(new Map());
  const [showingOriginal, setShowingOriginal] = useState<Map<string, boolean>>(new Map());
  const processedMessageIds = useRef<Set<string>>(new Set());

  // État pour le popover des participants
  const [isParticipantsOpen, setIsParticipantsOpen] = useState(false);
  const [participantsFilter, setParticipantsFilter] = useState('');

  // Hooks pour la traduction et services
  const { translateMessage } = useTranslation();
  const {
    isSending,
    connectionStatus,
    sendMessage: sendMessageToService,
    editMessage,
    startTyping,
    stopTyping
  } = useMessageSender({
    conversationId: conversation.id,
    currentUser: currentUser || undefined
  });

  // Convertir Message en TranslatedMessage pour MessageBubble
  const convertToTranslatedMessage = (message: Message): TranslatedMessage => {
    const sender = conversation.participants?.find(p => p.userId === message.senderId)?.user;
    const translated = translatedMessages.get(message.id);
    const isShowingOriginal = showingOriginal.get(message.id) ?? true;
    
    return {
      ...message,
      showingOriginal: isShowingOriginal,
      isTranslated: translated?.isTranslated ?? false,
      isTranslating: translated?.isTranslating ?? false,
      translatedContent: translated?.translatedContent,
      targetLanguage: translated?.targetLanguage,
      translations: translated?.translations ?? [],
      translationFailed: translated?.translationFailed ?? false,
      sender: sender || {
        id: message.senderId || 'unknown',
        username: 'Utilisateur inconnu',
        firstName: 'Utilisateur',
        lastName: 'Inconnu',
        email: '',
        displayName: 'Utilisateur inconnu',
        avatar: '',
        isOnline: false,
        lastSeen: new Date(),
        systemLanguage: 'fr',
        regionalLanguage: 'fr',
        autoTranslateEnabled: false,
        translateToSystemLanguage: false,
        translateToRegionalLanguage: false,
        useCustomDestination: false,
        isActive: true,
        deactivatedAt: undefined,
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
        createdAt: new Date(),
        lastActiveAt: new Date(),
        updatedAt: new Date()
      },
    };
  };

  // Initialiser l'état de traduction pour les nouveaux messages
  useEffect(() => {
    if (messages.length === 0) return;
    
    console.log('📝 ConversationView: Initialisation des états de traduction');
    
    messages.forEach(message => {
      // Initialiser l'état seulement si le message n'est pas déjà traité
      if (!translatedMessages.has(message.id)) {
        setShowingOriginal(prev => new Map(prev.set(message.id, true)));
      }
    });
  }, [messages, translatedMessages]);

  // Fonction pour gérer la traduction
  const handleTranslate = async (messageId: string, targetLanguage: string, forceRetranslate?: boolean): Promise<void> => {
    try {
      const message = messages.find(m => m.id === messageId);
      if (!message) {
        toast.error('Message introuvable');
        return;
      }

      const currentTranslated = translatedMessages.get(messageId);
      
      // Si déjà traduit dans cette langue et pas de force-retranslation, basculer l'affichage
      if (currentTranslated?.translations?.some(t => t.targetLanguage === targetLanguage) && !forceRetranslate) {
        // Basculer entre original et traduction
        const currentlyShowingOriginal = showingOriginal.get(messageId) ?? true;
        setShowingOriginal(prev => new Map(prev.set(messageId, !currentlyShowingOriginal)));
        return;
      }

      // Marquer comme en cours de traduction
      if (currentTranslated) {
        setTranslatedMessages(prev => new Map(prev.set(messageId, {
          ...currentTranslated,
          isTranslating: true
        })));
      } else {
        setTranslatedMessages(prev => new Map(prev.set(messageId, {
          ...message,
          isTranslating: true,
          translations: []
        } as TranslatedMessage)));
      }

      // Effectuer la traduction
      const translatedMessage = await translateMessage(message, targetLanguage);
      
      // Ajouter ou mettre à jour la traduction dans la liste
      const existingTranslated = translatedMessages.get(messageId);
      const existingTranslations = existingTranslated?.translations || [];
      
      // Retirer l'ancienne traduction dans cette langue si elle existe
      const filteredTranslations = existingTranslations.filter(t => t.targetLanguage !== targetLanguage);
      
      // Ajouter la nouvelle traduction
      const newTranslation: TranslationData = {
        messageId: messageId,
        sourceLanguage: message.originalLanguage || 'fr',
        targetLanguage: targetLanguage,
        translatedContent: translatedMessage?.translatedContent || message.content,
        translationModel: 'MT5_SMALL',
        cacheKey: `${messageId}-${targetLanguage}`,
        cached: false
      };
      
      const messageSender = conversation.participants?.find(p => p.userId === message.senderId)?.user;
      
      const updatedTranslatedMessage: TranslatedMessage = {
        ...message,
        ...translatedMessage,
        sender: messageSender || {
          id: message.senderId || 'unknown',
          username: 'Utilisateur inconnu',
          firstName: 'Utilisateur',
          lastName: 'Inconnu',
          email: '',
          displayName: 'Utilisateur inconnu',
          avatar: '',
          isOnline: false,
          lastSeen: new Date(),
          systemLanguage: 'fr',
          regionalLanguage: 'fr',
          autoTranslateEnabled: false,
          translateToSystemLanguage: false,
          translateToRegionalLanguage: false,
          useCustomDestination: false,
          isActive: true,
          deactivatedAt: undefined,
          role: 'USER',
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
          createdAt: new Date(),
          lastActiveAt: new Date(),
          updatedAt: new Date()
        },
        translations: [...filteredTranslations, newTranslation],
        isTranslating: false
      };

      setTranslatedMessages(prev => new Map(prev.set(messageId, updatedTranslatedMessage)));
      setShowingOriginal(prev => new Map(prev.set(messageId, false)));
      
      // TODO: Réimplémenter la persistance des traductions
      console.log(`💾 Traduction effectuée pour le message ${messageId} en ${targetLanguage}`);
      toast.success('Message traduit avec succès');
    } catch (error) {
      console.error('Erreur lors de la traduction:', error);
      
      // Retirer l'état de traduction en cas d'erreur
      const currentTranslated = translatedMessages.get(messageId);
      if (currentTranslated) {
        setTranslatedMessages(prev => new Map(prev.set(messageId, {
          ...currentTranslated,
          isTranslating: false,
          translationFailed: true
        })));
      }
      
      // Formater le message d'erreur pour l'utilisateur
      let errorMessage = 'Erreur lors de la traduction du message';
      if (error instanceof Error) {
        const message = error.message;
        if (message.includes('not supported') || message.includes('non supporté')) {
          errorMessage = `Langue "${targetLanguage}" non supportée par le modèle`;
        } else if (message.includes('not loaded') || message.includes('non chargé')) {
          errorMessage = 'Modèle de traduction non disponible. Veuillez télécharger les modèles.';
        } else if (message.includes('network') || message.includes('fetch')) {
          errorMessage = 'Erreur de connexion lors de la traduction';
        } else if (message.length < 150) {
          // Si le message est court et lisible, l'afficher
          errorMessage = message;
        }
      }
      
      toast.error(errorMessage);
    }
  };

  // Fonction pour gérer l'édition
  const handleEdit = async (messageId: string, newContent: string): Promise<void> => {
    try {
      if (!newContent.trim()) {
        toast.error('Le contenu du message ne peut pas être vide');
        return;
      }

      // Utiliser le service de messagerie unifié pour l'édition
      await editMessage(messageId, newContent.trim());
      toast.success('Message modifié avec succès');
    } catch (error) {
      console.error('Erreur lors de l\'édition:', error);
      toast.error('Erreur lors de la modification du message');
    }
  };

  // Fonction pour basculer entre original et traduction
  const handleToggleOriginal = (messageId: string): void => {
    // On peut basculer s'il y a des traductions disponibles
    const currentTranslated = translatedMessages.get(messageId);
    
    if (currentTranslated && currentTranslated.translations && currentTranslated.translations.length > 0) {
      const currentlyShowingOriginal = showingOriginal.get(messageId) ?? true;
      const newShowingOriginal = !currentlyShowingOriginal;
      
      setShowingOriginal(prev => new Map(prev.set(messageId, newShowingOriginal)));
      
      // TODO: Réimplémenter la persistance de l'état d'affichage
      console.log(`👁️ État d'affichage mis à jour pour le message ${messageId}: ${newShowingOriginal ? 'original' : 'traduit'}`);
    }
  };

  // Fonction pour traiter les nouveaux messages reçus (WebSocket)
  const handleNewMessageReceived = useCallback((newIncomingMessage: Message) => {
    console.log(`📨 Nouveau message reçu: ${newIncomingMessage.id} de ${newIncomingMessage.senderId}`);
    
    // Initialiser l'état d'affichage pour le nouveau message
    setShowingOriginal(prev => new Map(prev.set(newIncomingMessage.id, true)));
    console.log(`🆕 Nouvel état d'affichage initialisé pour le message ${newIncomingMessage.id}`);
    
    // Déclencher le callback parent s'il existe
    if (onNewMessage) {
      onNewMessage(newIncomingMessage);
    }
  }, [onNewMessage]);

  // Effet pour surveiller les changements dans la liste des messages 
  // et traiter les nouveaux messages
  useEffect(() => {
    // Détecter les nouveaux messages ajoutés (pas encore traités)
    const newMessages = messages.filter(m => !processedMessageIds.current.has(m.id));
    
    if (newMessages.length > 0) {
      console.log(`📨 ${newMessages.length} nouveaux messages détectés`);
      newMessages.forEach(message => {
        processedMessageIds.current.add(message.id);
        handleNewMessageReceived(message);
      });
    }
  }, [messages, handleNewMessageReceived]);

  // Auto-scroll vers les nouveaux messages (amélioré)
  const scrollToBottom = useCallback((force = false) => {
    // Utiliser setTimeout pour s'assurer que le DOM est mis à jour
    const delay = force ? 50 : 100; // Délai plus court pour les messages envoyés
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ 
        behavior: force ? 'auto' : 'smooth', // Scroll immédiat pour nos propres messages
        block: 'end'
      });
    }, delay);
  }, []);

  // Scroll vers le bas quand les messages changent (avec priorité pour nos propres messages)
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    
    // Si c'est notre propre message, forcer le scroll immédiatement
    if (lastMessage && lastMessage.senderId === currentUser.id) {
      console.log('🔽 Scroll forcé vers le bas (message envoyé)');
      // Scroll immédiat pour nos propres messages
      scrollToBottom(true);
      
      // Double scroll pour s'assurer que ça fonctionne
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ 
          behavior: 'auto',
          block: 'end'
        });
      }, 200);
    } else {
      // Scroll normal pour les autres messages
      scrollToBottom();
    }
  }, [messages, currentUser.id, scrollToBottom]);

  // Titre de la conversation
  const conversationTitle = conversation.title || 
    conversation.participants?.map(p => p.user?.displayName || p.user?.username).join(', ') ||
    'Conversation';

  // Description/sous-titre
  const getConversationSubtitle = () => {
    if (conversation.type === 'group') {
      const memberCount = conversation.participants?.length || 0;
      return `${memberCount} membre${memberCount > 1 ? 's' : ''}`;
    } else {
      // Pour les conversations directes, afficher le statut en ligne
      const otherUser = conversation.participants?.find(p => p.userId !== currentUser.id)?.user;
      if (otherUser) {
        return otherUser.isOnline ? 'En ligne' : 'Hors ligne';
      }
    }
    return '';
  };

  // Indicateur de frappe ou dernière activité
  const getActivityIndicator = () => {
    if (typingUsers.length > 0) {
      const typingNames = typingUsers.map(userId => {
        const user = conversation.participants?.find(p => p.userId === userId)?.user;
        return user?.displayName || user?.username || 'Quelqu\'un';
      });
      
      if (typingNames.length === 1) {
        return `${typingNames[0]} est en train d'écrire...`;
      } else if (typingNames.length === 2) {
        return `${typingNames[0]} et ${typingNames[1]} sont en train d'écrire...`;
      } else {
        return `${typingNames.length} personnes sont en train d'écrire...`;
      }
    }

    // Sinon, afficher l'heure du dernier message
    const lastMessage = messages[messages.length - 1];
    if (lastMessage) {
      return `Dernier message: ${new Date(lastMessage.createdAt).toLocaleString('fr-FR')}`;
    }

    return 'Aucun message';
  };

  const getDisplayName = (user?: User) => {
    if (!user) return 'Utilisateur';
    return (
      user.displayName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username || 'Utilisateur'
    );
  };

  const participants = conversation.participants || [];
  const onlineParticipants = participants.filter(p => p.user?.isOnline);
  const offlineParticipants = participants.filter(p => !p.user?.isOnline);

  const filteredOnline = onlineParticipants.filter(p => {
    if (!participantsFilter.trim()) return true;
    const target = `${p.user?.username || ''} ${getDisplayName(p.user)}`.toLowerCase();
    return target.includes(participantsFilter.toLowerCase());
  });
  const filteredOffline = offlineParticipants.filter(p => {
    if (!participantsFilter.trim()) return true;
    const target = `${p.user?.username || ''} ${getDisplayName(p.user)}`.toLowerCase();
    return target.includes(participantsFilter.toLowerCase());
  });

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header de la conversation */}
      <div className="border-b border-gray-200 p-4 bg-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3 flex-1 min-w-0">
            {/* Avatar */}
            <div className="relative">
              <Avatar className="h-10 w-10">
                <AvatarImage 
                  src={conversation.type === 'group' 
                    ? undefined 
                    : conversation.participants?.find(p => p.userId !== currentUser.id)?.user?.avatar
                  } 
                />
                <AvatarFallback>
                  {conversation.type === 'group' ? (
                    <Users className="h-5 w-5" />
                  ) : (
                    conversation.participants?.find(p => p.userId !== currentUser.id)?.user?.username[0] || '?'
                  )}
                </AvatarFallback>
              </Avatar>
              
              {/* Indicateur en ligne pour conversations directes */}
              {conversation.type !== 'group' && (
                <div className={cn(
                  "absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white",
                  conversation.participants?.find(p => p.userId !== currentUser.id)?.user?.isOnline 
                    ? "bg-green-500" 
                    : "bg-gray-400"
                )} />
              )}
            </div>

            {/* Info conversation */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2">
                <h1 className="font-semibold text-lg truncate">{conversationTitle}</h1>
                {conversation.type === 'group' && (
                  <Badge variant="secondary" className="text-xs">
                    <Users className="h-3 w-3 mr-1" />
                    Groupe
                  </Badge>
                )}
              </div>
              <p className="text-sm text-gray-500 truncate">{getConversationSubtitle()}</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center space-x-2">
            {conversation.type !== 'group' && (
              <>
                <Button variant="ghost" size="sm">
                  <Phone className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm">
                  <Video className="h-4 w-4" />
                </Button>
              </>
            )}
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <Info className="mr-2 h-4 w-4" />
                  Informations
                </DropdownMenuItem>
                {conversation.type === 'group' && (
                  <>
                    <DropdownMenuItem>
                      <UserPlus className="mr-2 h-4 w-4" />
                      Ajouter des membres
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Settings className="mr-2 h-4 w-4" />
                      Paramètres du groupe
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-red-600">
                  Quitter la conversation
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Indicateur d'activité ou liste des en ligne + popover participants */}
        {typingUsers.length > 0 ? (
          <div className="mt-2 text-xs text-gray-500">
            {getActivityIndicator()}
          </div>
        ) : (
          <div className="mt-2 flex items-center gap-2">
            {/* Bouton popover participants à gauche */}
            <Popover open={isParticipantsOpen} onOpenChange={setIsParticipantsOpen}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 px-2">
                  <UsersIcon className="h-4 w-4 mr-1" />
                  <span className="text-xs">Participants</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-80 p-0 shadow-2xl border border-gray-200 bg-white/95 backdrop-blur-sm"
                side="bottom"
                align="start"
                sideOffset={8}
                alignOffset={0}
                onOpenAutoFocus={(e) => e.preventDefault()}
              >
                <div className="p-3">
                  {/* Barre de recherche */}
                  <div className="mb-3">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                      <Input
                        placeholder="Rechercher..."
                        value={participantsFilter}
                        onChange={(e) => setParticipantsFilter(e.target.value)}
                        className="pl-8 pr-8 h-8 text-xs bg-gray-50/80 border-gray-200/60 focus:bg-white focus:border-blue-300"
                      />
                    </div>
                  </div>

                  <div className="max-h-64 overflow-y-auto space-y-3">
                    {/* Section en ligne */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-gray-600">En ligne</span>
                        <Badge variant="secondary" className="text-[10px]">
                          {filteredOnline.length}
                        </Badge>
                      </div>
                      {filteredOnline.length === 0 ? (
                        <div className="text-xs text-gray-400">Personne en ligne</div>
                      ) : (
                        <div className="space-y-1">
                          {filteredOnline.map((p) => (
                            <div key={p.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50">
                              <div className="relative">
                                <Avatar className="h-7 w-7">
                                  <AvatarImage src={p.user?.avatar} />
                                  <AvatarFallback className="text-[10px] bg-primary/20 text-primary">
                                    {getDisplayName(p.user).slice(0, 2).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="absolute -bottom-0 -right-0 h-3 w-3 bg-green-500 rounded-full border-2 border-white" />
                              </div>
                              <div className="min-w-0">
                                <div className="text-sm font-medium truncate">{getDisplayName(p.user)}</div>
                                <div className="text-xs text-gray-500 truncate">@{p.user?.username}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Section hors ligne */}
                    <div>
                      <div className="flex items-center justify-between mt-2 mb-1">
                        <span className="text-xs font-semibold text-gray-600">Hors ligne</span>
                        <Badge variant="outline" className="text-[10px]">
                          {filteredOffline.length}
                        </Badge>
                      </div>
                      {filteredOffline.length === 0 ? (
                        <div className="text-xs text-gray-400">Aucun participant hors ligne</div>
                      ) : (
                        <div className="space-y-1">
                          {filteredOffline.map((p) => (
                            <div key={p.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50">
                              <div className="relative">
                                <Avatar className="h-7 w-7">
                                  <AvatarImage src={p.user?.avatar} />
                                  <AvatarFallback className="text-[10px] bg-gray-100 text-gray-600">
                                    {getDisplayName(p.user).slice(0, 2).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="absolute -bottom-0 -right-0 h-3 w-3 bg-gray-400 rounded-full border-2 border-white" />
                              </div>
                              <div className="min-w-0">
                                <div className="text-sm font-medium truncate">{getDisplayName(p.user)}</div>
                                <div className="text-xs text-gray-500 truncate">@{p.user?.username}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            {/* Liste horizontale des en ligne */}
            <div className="flex items-center gap-1 overflow-x-auto">
              {onlineParticipants.length === 0 ? (
                <span className="text-xs text-gray-500">Personne en ligne</span>
              ) : (
                onlineParticipants.slice(0, 10).map((p) => (
                  <div key={p.id} className="relative">
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={p.user?.avatar} />
                      <AvatarFallback className="text-[10px] bg-primary/20 text-primary">
                        {getDisplayName(p.user).slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-0 -right-0 h-2.5 w-2.5 bg-green-500 rounded-full border-2 border-white" />
                  </div>
                ))
              )}
              {onlineParticipants.length > 10 && (
                <Badge variant="secondary" className="ml-1 text-[10px]">+{onlineParticipants.length - 10}</Badge>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                <div className="mb-4">
                  {conversation.type === 'group' ? (
                    <Users className="h-16 w-16 mx-auto opacity-20" />
                  ) : (
                    <Avatar className="h-16 w-16 mx-auto">
                      <AvatarImage 
                        src={conversation.participants?.find(p => p.userId !== currentUser.id)?.user?.avatar} 
                      />
                      <AvatarFallback className="text-2xl">
                        {conversation.participants?.find(p => p.userId !== currentUser.id)?.user?.username[0] || '?'}
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>
                <h3 className="text-lg font-medium mb-2">
                  Début de votre conversation avec {conversationTitle}
                </h3>
                <p className="text-sm">
                  Envoyez votre premier message pour commencer !
                </p>
              </div>
            ) : (
              messages.map((message) => (
                <MessageBubbleAdapter
                  key={message.id}
                  message={convertToTranslatedMessage(message)}
                  currentUserId={currentUser.id}
                  currentUserLanguage={currentUser.systemLanguage}
                  onTranslate={handleTranslate}
                  onEdit={handleEdit}
                  onToggleOriginal={handleToggleOriginal}
                />
              ))
            )}

            {/* Indicateur de frappe */}
            {typingUsers.length > 0 && (
              <div className="text-sm text-gray-500 italic">
                {typingUsers.length === 1 ? 'Quelqu\'un' : `${typingUsers.length} personnes`} 
                {' '}en train d&apos;écrire...
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
      </div>

      {/* Zone de saisie */}
      <div className="border-t border-gray-200 p-4 bg-gray-50">
        <div className="flex space-x-3">
          <div className="flex-1">
            <Input
              ref={messageInputRef}
              placeholder="Tapez votre message..."
              value={newMessage}
              onChange={(e) => onNewMessageChange(e.target.value)}
              onKeyPress={onKeyPress}
              disabled={!connectionStatus.isConnected}
              className="bg-white"
            />
          </div>
          <Button 
            onClick={onSendMessage} 
            disabled={!newMessage.trim() || !connectionStatus.isConnected}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>

        {/* Statut connexion */}
        {!connectionStatus.isConnected && (
          <div className="flex items-center space-x-2 text-xs text-red-500 mt-2">
            <div className="h-2 w-2 rounded-full bg-red-500" />
            <span>Connexion perdue, reconnexion en cours...</span>
          </div>
        )}
      </div>
    </div>
  );
}
