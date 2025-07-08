'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
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
  Info
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { User, Conversation, Message, TranslatedMessage, Translation, SUPPORTED_LANGUAGES } from '@/types';
import { MessageBubble } from './message-bubble';
import { useTranslation } from '@/hooks/use-translation';
import { useWebSocket } from '@/hooks/use-websocket';
import { SocketService } from '@/lib/socket.service';
import { toast } from 'sonner';
import { translationService } from '@/services/translation.service';

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

  // Hooks pour la traduction et services
  const { translateMessage } = useTranslation(currentUser);
  const { isConnected } = useWebSocket();
  const socketService = SocketService.getInstance();

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
        id: message.senderId,
        username: 'Utilisateur inconnu',
        email: '',
        displayName: 'Utilisateur inconnu',
        avatar: '',
        isOnline: false,
        systemLanguage: 'fr',
        regionalLanguage: 'fr',
        autoTranslateEnabled: false,
        translateToSystemLanguage: false,
        translateToRegionalLanguage: false,
        useCustomDestination: false,
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
        lastActiveAt: new Date()
      },
    };
  };

  // Charger les traductions persistées au démarrage
  useEffect(() => {
    if (messages.length === 0) return;
    
    // Initialiser le service de persistance (nettoie les traductions expirées)
    translationPersistenceService.initialize();
    
    // Charger toutes les traductions persistées pour les messages actuels
    const messageIds = messages.map(m => m.id);
    const persistedData = translationPersistenceService.loadAllTranslations(messageIds);
    
    if (persistedData.size > 0) {
      const newTranslatedMessages = new Map<string, TranslatedMessage>();
      const newShowingOriginal = new Map<string, boolean>();
      
      persistedData.forEach((data, messageId) => {
        const message = messages.find(m => m.id === messageId);
        if (message && data.translations.length > 0) {
          // Reconstituer le TranslatedMessage avec les traductions persistées
          const translatedMessage: TranslatedMessage = {
            ...message,
            translations: data.translations,
            isTranslated: true,
            showingOriginal: data.showingOriginal,
            // Utiliser la première traduction comme traduction principale par défaut
            translatedContent: data.translations[0]?.content,
            targetLanguage: data.translations[0]?.language,
            sender: message.sender || {
              id: message.senderId,
              username: 'Utilisateur inconnu',
              email: '',
              displayName: 'Utilisateur inconnu',
              avatar: '',
              isOnline: false,
              systemLanguage: 'fr',
              regionalLanguage: 'fr',
              autoTranslateEnabled: false,
              translateToSystemLanguage: false,
              translateToRegionalLanguage: false,
              useCustomDestination: false,
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
              lastActiveAt: new Date()
            }
          };
          
          newTranslatedMessages.set(messageId, translatedMessage);
          newShowingOriginal.set(messageId, data.showingOriginal);
        }
      });
      
      if (newTranslatedMessages.size > 0) {
        setTranslatedMessages(newTranslatedMessages);
        setShowingOriginal(newShowingOriginal);
        console.log(`🔄 ${newTranslatedMessages.size} traductions rechargées depuis la persistance`);
      }
    }
  }, [messages]);

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
      if (currentTranslated?.translations?.some(t => t.language === targetLanguage) && !forceRetranslate) {
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
      const filteredTranslations = existingTranslations.filter(t => t.language !== targetLanguage);
      
      // Ajouter la nouvelle traduction avec drapeau
      const flag = SUPPORTED_LANGUAGES.find(lang => lang.code === targetLanguage)?.flag || '🌐';
      const newTranslation: Translation = {
        language: targetLanguage,
        content: translatedMessage.translatedContent || message.content,
        flag,
        createdAt: new Date(),
        modelUsed: translatedMessage.modelUsed
      };
      
      const updatedTranslatedMessage: TranslatedMessage = {
        ...message,
        ...translatedMessage,
        translations: [...filteredTranslations, newTranslation],
        isTranslating: false
      };

      setTranslatedMessages(prev => new Map(prev.set(messageId, updatedTranslatedMessage)));
      setShowingOriginal(prev => new Map(prev.set(messageId, false)));
      
      // Sauvegarder les traductions dans la persistance via le service centralisé
      translationPersistenceService.saveTranslations(messageId, updatedTranslatedMessage.translations!, false);
      
      console.log(`💾 Traduction sauvegardée pour le message ${messageId} en ${targetLanguage}`);
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
      
      toast.error('Erreur lors de la traduction du message');
    }
  };

  // Fonction pour gérer l'édition
  const handleEdit = async (messageId: string, newContent: string): Promise<void> => {
    try {
      if (!newContent.trim()) {
        toast.error('Le contenu du message ne peut pas être vide');
        return;
      }

      await socketService.editMessage(messageId, newContent.trim());
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
      
      // Sauvegarder l'état d'affichage dans la persistance via le service centralisé
      translationPersistenceService.updateShowingOriginal(messageId, newShowingOriginal);
      
      console.log(`👁️ État d'affichage mis à jour pour le message ${messageId}: ${newShowingOriginal ? 'original' : 'traduit'}`);
    }
  };

  // Fonction pour traiter les nouveaux messages reçus (WebSocket)
  const handleNewMessageReceived = useCallback((newIncomingMessage: Message) => {
    console.log(`📨 Nouveau message reçu: ${newIncomingMessage.id} de ${newIncomingMessage.senderId}`);
    
    // Enrichir le message avec les traductions existantes (s'il y en a)
    const enrichedMessage = translationPersistenceService.enrichMessageWithTranslations(newIncomingMessage);
    
    // Si le message a déjà des traductions persistées, les intégrer dans l'état
    if (enrichedMessage.translations && enrichedMessage.translations.length > 0) {
      setTranslatedMessages(prev => new Map(prev.set(newIncomingMessage.id, enrichedMessage)));
      setShowingOriginal(prev => new Map(prev.set(newIncomingMessage.id, enrichedMessage.showingOriginal ?? true)));
      console.log(`🔄 Message ${newIncomingMessage.id} enrichi avec ${enrichedMessage.translations.length} traductions persistées`);
    }
    
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

        {/* Indicateur d'activité */}
        <div className="mt-2 text-xs text-gray-500">
          {getActivityIndicator()}
        </div>
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
                <MessageBubble
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
              disabled={!isConnected}
              className="bg-white"
            />
          </div>
          <Button 
            onClick={onSendMessage} 
            disabled={!newMessage.trim() || !isConnected}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>

        {/* Statut connexion */}
        {!isConnected && (
          <div className="flex items-center space-x-2 text-xs text-red-500 mt-2">
            <div className="h-2 w-2 rounded-full bg-red-500" />
            <span>Connexion perdue, reconnexion en cours...</span>
          </div>
        )}
      </div>
    </div>
  );
}
