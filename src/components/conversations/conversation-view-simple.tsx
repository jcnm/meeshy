'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
  Info,
  MessageSquare
} from 'lucide-react';
import { User, Conversation, Message, TranslatedMessage } from '@/types';
import { MessageBubble } from './message-bubble';
import { useTranslation } from '@/hooks/use-translation';
import { useMessaging } from '@/hooks/use-messaging';
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
  onNewMessage?: (message: Message) => void;
}

export function ConversationViewSimple({
  conversation,
  messages,
  newMessage,
  onNewMessageChange,
  onSendMessage,
  onKeyPress,
  currentUser
}: ConversationViewProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);

  // États pour la gestion des traductions et affichages
  const [translatedMessages, setTranslatedMessages] = useState<Map<string, TranslatedMessage>>(new Map());
  const [showingOriginal, setShowingOriginal] = useState<Map<string, boolean>>(new Map());

  // Hooks pour la traduction et services
  const { translateMessage } = useTranslation(currentUser);
  const messaging = useMessaging({
    conversationId: conversation.id,
    currentUser: currentUser || undefined
  });

  // Convertir Message en TranslatedMessage pour MessageBubble
  const convertToTranslatedMessage = useCallback((message: Message): TranslatedMessage => {
    const sender = conversation.participants?.find(p => p.userId === message.senderId)?.user;
    const translated = translatedMessages.get(message.id);
    const isShowingOriginal = showingOriginal.get(message.id) ?? true;
    
    return {
      ...message,
      showingOriginal: isShowingOriginal,
      isTranslated: translated?.isTranslated || false,
      isTranslating: false,
      translationError: undefined,
      translationFailed: false,
      translatedContent: translated?.translatedContent,
      targetLanguage: translated?.targetLanguage,
      translations: translated?.translations || [],
      sender: sender || {
        id: message.senderId,
        username: 'Utilisateur inconnu',
        email: '',
        displayName: 'Utilisateur inconnu',
        avatar: '',
        isOnline: false,
        systemLanguage: currentUser.systemLanguage,
        regionalLanguage: currentUser.regionalLanguage || currentUser.systemLanguage,
        autoTranslateEnabled: false,
        translateToSystemLanguage: false,
        translateToRegionalLanguage: false,
        useCustomDestination: false,
        customDestinationLanguage: undefined,
        lastSeen: new Date(),
        role: 'USER',
        permissions: {
          canAccessAdmin: false,
          canManageUsers: false,
          canManageGroups: false,
          canManageConversations: false,
          canManageTranslations: false,
          canViewAnalytics: false,
          canModerateContent: false,
          canViewAuditLogs: false,
          canManageNotifications: false
        },
        createdAt: new Date(),
        lastActiveAt: new Date()
      }
    };
  }, [conversation.participants, translatedMessages, showingOriginal, currentUser]);

  // Auto-convertir les messages
  useEffect(() => {
    if (messages.length === 0) return;
    
    const converted = new Map<string, TranslatedMessage>();
    messages.forEach(message => {
      converted.set(message.id, convertToTranslatedMessage(message));
    });
    
    setTranslatedMessages(converted);
  }, [messages, convertToTranslatedMessage]);

  // Auto-scroll vers le bas
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Handler pour traduction
  const handleTranslate = async (messageId: string, targetLanguage: string, forceRetranslate = false) => {
    const message = messages.find(m => m.id === messageId);
    if (!message) return;

    const currentTranslated = translatedMessages.get(messageId);
    
    // Si déjà traduit et pas de force retranslate, basculer l'affichage
    if (currentTranslated?.isTranslated && !forceRetranslate) {
      const currentlyShowingOriginal = showingOriginal.get(messageId) ?? true;
      setShowingOriginal(prev => new Map(prev.set(messageId, !currentlyShowingOriginal)));
      return;
    }

    // Marquer comme en cours de traduction
    const translatingMessage: TranslatedMessage = {
      ...convertToTranslatedMessage(message),
      isTranslating: true,
      translationError: undefined
    };
    setTranslatedMessages(prev => new Map(prev.set(messageId, translatingMessage)));

    try {
      const translatedMessage = await translateMessage(
        message, 
        targetLanguage
      );

      // Mettre à jour avec la traduction
      setTranslatedMessages(prev => new Map(prev.set(messageId, translatedMessage)));
      setShowingOriginal(prev => new Map(prev.set(messageId, false)));
      
    } catch (error) {
      console.error('Erreur de traduction:', error);
      
      // Mettre à jour avec l'erreur
      const errorMessage: TranslatedMessage = {
        ...convertToTranslatedMessage(message),
        isTranslating: false,
        translationError: 'Erreur lors de la traduction',
        translationFailed: true
      };
      setTranslatedMessages(prev => new Map(prev.set(messageId, errorMessage)));
    }
  };

  // Handler pour édition
  const handleEdit = async (messageId: string, newContent: string) => {
    try {
      // Utiliser le hook unifié pour l'édition
      const success = await messaging.editMessage(messageId, newContent);
      
      if (success) {
        toast.success('Message modifié');
      } else {
        toast.error('Erreur lors de la modification');
      }
    } catch (error) {
      console.error('Erreur modification message:', error);
      toast.error('Erreur de connexion');
    }
  };

  // Handler pour basculer affichage original/traduit
  const handleToggleOriginal = (messageId: string) => {
    const currentlyShowingOriginal = showingOriginal.get(messageId) ?? true;
    setShowingOriginal(prev => new Map(prev.set(messageId, !currentlyShowingOriginal)));
  };

  // Calculer le titre de la conversation
  const getConversationTitle = () => {
    if (conversation.isGroup) {
      return conversation.name || conversation.title || 'Groupe sans nom';
    } else {
      const otherParticipant = conversation.participants?.find(p => p.userId !== currentUser.id);
      return otherParticipant?.user?.displayName || 
             otherParticipant?.user?.username || 
             'Conversation privée';
    }
  };

  // Calculer le sous-titre
  const getConversationSubtitle = () => {
    const participantCount = conversation.participants?.length || 0;
    if (conversation.isGroup) {
      return `${participantCount} participant${participantCount > 1 ? 's' : ''}`;
    } else {
      const otherParticipant = conversation.participants?.find(p => p.userId !== currentUser.id);
      return otherParticipant?.user?.isOnline ? 'En ligne' : 'Hors ligne';
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* En-tête */}
      <div className="border-b border-gray-200 p-4 bg-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={conversation.isGroup ? '' : conversation.participants?.find(p => p.userId !== currentUser.id)?.user?.avatar} />
              <AvatarFallback>
                {conversation.isGroup ? (
                  <Users className="h-5 w-5" />
                ) : (
                  getConversationTitle().slice(0, 2).toUpperCase()
                )}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="font-semibold text-lg truncate">{getConversationTitle()}</h1>
              <p className="text-sm text-gray-500 truncate">{getConversationSubtitle()}</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
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
                {conversation.isGroup && (
                  <DropdownMenuItem>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Ajouter un participant
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem>
                  <Settings className="mr-2 h-4 w-4" />
                  Paramètres
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>Aucun message dans cette conversation</p>
              </div>
            ) : (
              messages.map((message) => {
                const translatedMessage = convertToTranslatedMessage(message);
                return (
                  <MessageBubble
                    key={message.id}
                    message={translatedMessage}
                    currentUserId={currentUser.id}
                    currentUserLanguage={currentUser.systemLanguage}
                    onTranslate={handleTranslate}
                    onEdit={handleEdit}
                    onToggleOriginal={handleToggleOriginal}
                  />
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
      </div>

      {/* Zone de saisie */}
      <div className="border-t border-gray-200 p-4 bg-gray-50">
        <div className="flex items-center space-x-3">
          <Input
            ref={messageInputRef}
            placeholder="Tapez votre message..."
            value={newMessage}
            onChange={(e) => onNewMessageChange(e.target.value)}
            onKeyPress={onKeyPress}
            disabled={!messaging.connectionStatus.isConnected}
            className="flex-1"
          />
          <Button 
            onClick={onSendMessage}
            disabled={!newMessage.trim() || !messaging.connectionStatus.isConnected}
            size="sm"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>

        {/* Statut connexion */}
        {!messaging.connectionStatus.isConnected && (
          <div className="text-center text-red-500 text-sm mt-2">
            Connexion perdue - Reconnexion en cours...
          </div>
        )}
      </div>
    </div>
  );
}
