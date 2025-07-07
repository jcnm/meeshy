'use client';

import { useEffect, useRef, useState } from 'react';
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
import { useMessageTranslation } from '@/hooks/use-message-translation';
import { SocketService } from '@/lib/socket.service';
import { toast } from 'sonner';

interface ConversationViewProps {
  conversation: Conversation;
  messages: Message[];
  newMessage: string;
  onNewMessageChange: (message: string) => void;
  onSendMessage: () => void;
  onKeyPress: (e: React.KeyboardEvent) => void;
  currentUser: User;
  isConnected: boolean;
  typingUsers: string[];
}

export function ConversationView({
  conversation,
  messages,
  newMessage,
  onNewMessageChange,
  onSendMessage,
  onKeyPress,
  currentUser,
  isConnected,
  typingUsers
}: ConversationViewProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);

  // États pour la gestion des traductions et affichages
  const [translatedMessages, setTranslatedMessages] = useState<Map<string, TranslatedMessage>>(new Map());
  const [showingOriginal, setShowingOriginal] = useState<Map<string, boolean>>(new Map());

  // Hooks pour la traduction et services
  const { translateMessage } = useMessageTranslation(currentUser);
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
        setShowingOriginal(prev => new Map(prev.set(messageId, !prev.get(messageId))));
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
    if (translatedMessages.has(messageId)) {
      setShowingOriginal(prev => new Map(prev.set(messageId, !prev.get(messageId))));
    }
  };

  // Auto-scroll vers les nouveaux messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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
