'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  MessageSquare, 
  Send, 
  Search, 
  MoreVertical,
  Users,
  Settings,
  LogOut,
  Bell,
  BellRing,
  X,
  UserPlus,
  Link2
} from 'lucide-react';
import { buildApiUrl, API_ENDPOINTS } from '@/lib/config';
import { User, Conversation, Message } from '@/types';
import { useWebSocket } from '@/hooks/use-websocket-new';
import { useTypingIndicator } from '@/hooks/use-typing-indicator-new';
import { useNotifications } from '@/hooks/use-notifications';
import { MessageBubble } from '@/components/message-bubble';
import { TypingIndicator } from '@/components/typing-indicator';
import { CreateConversationModal } from '@/components/create-conversation-modal';
import { CreateLinkModal } from '@/components/create-link-modal';
import { CreateGroupModal } from '@/components/create-group-modal';
// Composants temporairement désactivés
// import { UserSelector } from '@/components/user-selector';
// import { UserSettingsModal } from '@/components/user-settings-modal';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ChatLayoutProps {
  currentUser: User;
}

export default function ChatLayout({ currentUser }: ChatLayoutProps) {
  const router = useRouter();
  
  // États principaux
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  
  // États pour les modals
  const [isCreateConversationOpen, setIsCreateConversationOpen] = useState(false);
  const [isCreateLinkOpen, setIsCreateLinkOpen] = useState(false);
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  
  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);
  
  // Hooks personnalisés
  const { socket, isConnected } = useWebSocket(currentUser?.id);
  const { typingUsers, startTyping, stopTyping } = useTypingIndicator(socket, currentUser?.id);
  const { notifications, markAsRead } = useNotifications();

  // Auto-scroll vers les nouveaux messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Fonctions principales (définies avant useEffect)
  const loadConversations = useCallback(async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(buildApiUrl(API_ENDPOINTS.CONVERSATION.LIST), {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setConversations(data.conversations || []);
      }
    } catch (error) {
      console.error('Erreur chargement conversations:', error);
      toast.error('Erreur lors du chargement des conversations');
    }
  }, []);

  const loadMessages = useCallback(async (conversationId: string) => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(
        buildApiUrl(API_ENDPOINTS.CONVERSATION.MESSAGES.replace(':id', conversationId)),
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages || []);
        setTimeout(scrollToBottom, 100);
      }
    } catch (error) {
      console.error('Erreur chargement messages:', error);
      toast.error('Erreur lors du chargement des messages');
    }
  }, []);

  const openConversation = useCallback(async (conversationId: string) => {
    const conversation = conversations.find(c => c.id === conversationId);
    if (conversation) {
      setSelectedConversation(conversation);
      setIsDrawerOpen(true);
      await loadMessages(conversationId);
      
      // Réinitialiser le compteur non lus
      setUnreadCounts(prev => ({ ...prev, [conversationId]: 0 }));
      
      // Rejoindre la room WebSocket
      if (socket) {
        socket.emit('joinConversation', { conversationId });
      }
    }
  }, [conversations, socket, loadMessages]);

  // Charger les conversations
  useEffect(() => {
    loadConversations();
  }, [currentUser, loadConversations]);

  // WebSocket - Écouter les nouveaux messages
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (message: Message) => {
      // Si c'est la conversation active, ajouter le message
      if (selectedConversation && message.conversationId === selectedConversation.id) {
        setMessages(prev => [...prev, message]);
        scrollToBottom();
        
        // Marquer comme lu si c'est ouvert
        if (isDrawerOpen) {
          markMessageAsRead(message.id);
        }
      } else {
        // Conversation pas ouverte -> notification + incrémenter unread
        setUnreadCounts(prev => ({
          ...prev,
          [message.conversationId]: (prev[message.conversationId] || 0) + 1
        }));
        
        // Remonter la conversation en tête de liste
        setConversations(prev => {
          const conversation = prev.find(c => c.id === message.conversationId);
          if (conversation) {
            const others = prev.filter(c => c.id !== message.conversationId);
            return [{ ...conversation, lastMessage: message, updatedAt: new Date() }, ...others];
          }
          return prev;
        });
        
        // Notification toast
        toast.info(`Nouveau message de ${message.sender?.displayName || message.sender?.username}`, {
          description: message.content.substring(0, 50) + (message.content.length > 50 ? '...' : ''),
          action: {
            label: 'Voir',
            onClick: () => openConversation(message.conversationId)
          }
        });
      }
    };

    const handleMessageEdited = (message: Message) => {
      setMessages(prev => prev.map(m => m.id === message.id ? message : m));
    };

    const handleMessageDeleted = (messageId: string) => {
      setMessages(prev => prev.filter(m => m.id !== messageId));
    };

    socket.on('newMessage', handleNewMessage);
    socket.on('messageEdited', handleMessageEdited);
    socket.on('messageDeleted', handleMessageDeleted);

    return () => {
      socket.off('newMessage', handleNewMessage);
      socket.off('messageEdited', handleMessageEdited);
      socket.off('messageDeleted', handleMessageDeleted);
    };
  }, [socket, selectedConversation, isDrawerOpen, openConversation]);

  // Gestion typing indicator
  useEffect(() => {
    if (!messageInputRef.current || !socket) return;

    let typingTimer: NodeJS.Timeout;

    const handleTyping = () => {
      if (selectedConversation) {
        startTyping(selectedConversation.id);
        
        clearTimeout(typingTimer);
        typingTimer = setTimeout(() => {
          stopTyping(selectedConversation.id);
        }, 3000);
      }
    };

    const inputElement = messageInputRef.current;
    inputElement.addEventListener('input', handleTyping);

    return () => {
      inputElement?.removeEventListener('input', handleTyping);
      clearTimeout(typingTimer);
    };
  }, [selectedConversation, socket, startTyping, stopTyping]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || !socket) return;

    const messageData = {
      content: newMessage.trim(),
      conversationId: selectedConversation.id,
      originalLanguage: currentUser.systemLanguage
    };

    try {
      // Envoyer via WebSocket pour temps réel
      socket.emit('sendMessage', messageData);
      
      // Ajouter immédiatement à l'affichage (optimistic update)
      const tempMessage: Message = {
        id: `temp-${Date.now()}`,
        content: messageData.content,
        senderId: currentUser.id,
        conversationId: selectedConversation.id,
        originalLanguage: messageData.originalLanguage,
        isEdited: false,
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        sender: currentUser
      };
      
      setMessages(prev => [...prev, tempMessage]);
      setNewMessage('');
      scrollToBottom();
      
      // Arrêter l'indicateur de frappe
      if (selectedConversation) {
        stopTyping(selectedConversation.id);
      }
      
    } catch (error) {
      console.error('Erreur envoi message:', error);
      toast.error('Erreur lors de l\'envoi du message');
    }
  };

  const markMessageAsRead = async (messageId: string) => {
    try {
      const token = localStorage.getItem('auth_token');
      await fetch(buildApiUrl(`/message/${messageId}/read`), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (error) {
      console.error('Erreur marquage comme lu:', error);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    if (socket) {
      socket.disconnect();
    }
    router.push('/');
  };

  const filteredConversations = conversations.filter(conv =>
    conv.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.participants?.some(p => 
      p.user?.username.toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar Conversations */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        {/* Header Sidebar */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <div className="h-8 w-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
                <MessageSquare className="h-5 w-5 text-white" />
              </div>
              <span className="text-lg font-semibold">Meeshy</span>
            </div>
            
            <div className="flex items-center space-x-2">
              {/* Notifications */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="relative">
                    {notifications.length > 0 ? (
                      <BellRing className="h-4 w-4" />
                    ) : (
                      <Bell className="h-4 w-4" />
                    )}
                    {notifications.length > 0 && (
                      <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 text-xs">
                        {notifications.length}
                      </Badge>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80">
                  <DropdownMenuLabel>Notifications</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {notifications.length === 0 ? (
                    <div className="p-4 text-center text-gray-500">
                      Aucune notification
                    </div>
                  ) : (
                    notifications.map(notification => (
                      <DropdownMenuItem key={notification.id} className="flex-col items-start p-3">
                        <div className="flex items-center justify-between w-full">
                          <span className="font-medium">{notification.title}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => markAsRead(notification.id)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                        <span className="text-sm text-gray-500">{notification.message}</span>
                      </DropdownMenuItem>
                    ))
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Menu utilisateur */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>
                    {currentUser.displayName || currentUser.username}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => router.push('/settings')}>
                    <Settings className="mr-2 h-4 w-4" />
                    Paramètres
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Déconnexion
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Recherche */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Rechercher une conversation..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Actions rapides */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex space-x-2">
            <Button 
              onClick={() => setIsCreateConversationOpen(true)}
              size="sm" 
              className="flex-1"
            >
              <UserPlus className="mr-2 h-4 w-4" />
              Nouveau Chat
            </Button>
            <Button 
              onClick={() => setIsCreateGroupOpen(true)}
              variant="outline" 
              size="sm"
            >
              <Users className="h-4 w-4" />
            </Button>
            <Button 
              onClick={() => setIsCreateLinkOpen(true)}
              variant="outline" 
              size="sm"
            >
              <Link2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Liste des conversations */}
        <ScrollArea className="flex-1">
          <div className="p-2">
            {filteredConversations.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Aucune conversation</p>
                <p className="text-sm">Créez votre première conversation !</p>
              </div>
            ) : (
              filteredConversations.map(conversation => (
                <Card
                  key={conversation.id}
                  className={cn(
                    "mb-2 cursor-pointer transition-colors hover:bg-gray-50",
                    selectedConversation?.id === conversation.id && "bg-blue-50 border-blue-200"
                  )}
                  onClick={() => openConversation(conversation.id)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3 flex-1 min-w-0">
                        {/* Avatar */}
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={conversation.participants?.[0]?.user?.avatar} />
                          <AvatarFallback>
                            {conversation.title?.[0] || conversation.participants?.[0]?.user?.username[0] || '?'}
                          </AvatarFallback>
                        </Avatar>
                        
                        {/* Info conversation */}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">
                            {conversation.title || 
                             conversation.participants?.map(p => p.user?.displayName || p.user?.username).join(', ')}
                          </p>
                          {conversation.lastMessage && (
                            <p className="text-xs text-gray-500 truncate">
                              {conversation.lastMessage.content}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      {/* Badges */}
                      <div className="flex flex-col items-end space-y-1">
                        {unreadCounts[conversation.id] > 0 && (
                          <Badge variant="destructive" className="h-5 w-5 p-0 text-xs flex items-center justify-center">
                            {unreadCounts[conversation.id]}
                          </Badge>
                        )}
                        {conversation.lastMessage && (
                          <span className="text-xs text-gray-400">
                            {new Date(conversation.lastMessage.createdAt).toLocaleTimeString('fr-FR', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </ScrollArea>

        {/* Statut connexion */}
        <div className="p-3 border-t border-gray-200">
          <div className="flex items-center space-x-2 text-xs">
            <div className={cn(
              "h-2 w-2 rounded-full",
              isConnected ? "bg-green-500" : "bg-red-500"
            )} />
            <span className="text-gray-500">
              {isConnected ? 'Connecté' : 'Déconnecté'}
            </span>
          </div>
        </div>
      </div>

      {/* Zone principale */}
      <div className="flex-1 flex flex-col">
        {!selectedConversation ? (
          /* État vide */
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center text-gray-500">
              <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">Bienvenue sur Meeshy</h3>
              <p>Sélectionnez une conversation pour commencer à discuter</p>
              <p className="text-sm mt-1">Les messages sont traduits automatiquement !</p>
            </div>
          </div>
        ) : (
          /* Chat drawer */
          <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
            <SheetContent side="right" className="w-full sm:w-[600px] p-0">
              <div className="flex flex-col h-full">
                {/* Header conversation */}
                <SheetHeader className="p-4 border-b border-gray-200">
                  <div className="flex items-center space-x-3">
                    <Avatar>
                      <AvatarImage src={selectedConversation.participants?.[0]?.user?.avatar} />
                      <AvatarFallback>
                        {selectedConversation.title?.[0] || selectedConversation.participants?.[0]?.user?.username[0] || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <SheetTitle className="text-left truncate">
                        {selectedConversation.title || 
                         selectedConversation.participants?.map(p => p.user?.displayName || p.user?.username).join(', ')}
                      </SheetTitle>
                      <SheetDescription className="text-left">
                        {isConnected && typingUsers[selectedConversation.id]?.length > 0 ? (
                          <TypingIndicator 
                            chatId={selectedConversation.id}
                            currentUserId={currentUser.id}
                          />
                        ) : (
                          `${selectedConversation.participants?.length || 0} participant(s)`
                        )}
                      </SheetDescription>
                    </div>
                  </div>
                </SheetHeader>

                {/* Messages */}
                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-4">
                    {messages.map(message => (
                      <MessageBubble
                        key={message.id}
                        message={message}
                        currentUserId={currentUser.id}
                        currentUserLanguage={currentUser.systemLanguage}
                        onTranslate={async () => {}}
                        onEdit={async () => {}}
                        onToggleOriginal={() => {}}
                      />
                    ))}
                    {/* Indicateur de frappe */}
                    {isConnected && typingUsers[selectedConversation.id]?.length > 0 && (
                      <div className="flex items-center space-x-2 text-sm text-gray-500">
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                        </div>
                        <span>
                          {typingUsers[selectedConversation.id].map(u => u.username).join(', ')} 
                          {typingUsers[selectedConversation.id].length > 1 ? ' sont en train d\'écrire...' : ' est en train d\'écrire...'}
                        </span>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>

                {/* Input message */}
                <div className="p-4 border-t border-gray-200">
                  <div className="flex space-x-2">
                    <Input
                      ref={messageInputRef}
                      placeholder="Tapez votre message..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          sendMessage();
                        }
                      }}
                      disabled={!isConnected}
                      className="flex-1"
                    />
                    <Button 
                      onClick={sendMessage}
                      disabled={!newMessage.trim() || !isConnected}
                      size="icon"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                  {!isConnected && (
                    <p className="text-xs text-red-500 mt-1">
                      Connexion interrompue - Reconnexion en cours...
                    </p>
                  )}
                </div>
              </div>
            </SheetContent>
          </Sheet>
        )}
      </div>

      {/* Modals - Temporairement désactivés */}
      {/* TODO: Réactiver et corriger les interfaces
      <UserSelector
        isOpen={isUserSelectorOpen}
        onClose={() => setIsUserSelectorOpen(false)}
        currentUser={currentUser}
        onUserSelected={(user) => {
          // TODO: Créer nouvelle conversation
          setIsUserSelectorOpen(false);
        }}
      />

      <UserSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        currentUser={currentUser}
      />
      */}

      {/* Modals fonctionnelles */}
      <CreateConversationModal
        isOpen={isCreateConversationOpen}
        onClose={() => setIsCreateConversationOpen(false)}
        currentUser={currentUser}
        onConversationCreated={(conversationId) => {
          loadConversations();
          openConversation(conversationId);
        }}
      />

      <CreateLinkModal
        isOpen={isCreateLinkOpen}
        onClose={() => setIsCreateLinkOpen(false)}
        onLinkCreated={() => {
          // Rafraîchir la liste des conversations si nécessaire
          loadConversations();
        }}
      />

      <CreateGroupModal
        isOpen={isCreateGroupOpen}
        onClose={() => setIsCreateGroupOpen(false)}
        currentUser={currentUser}
        onGroupCreated={(groupId) => {
          // Rediriger vers la page du groupe créé
          window.location.href = `/groups/${groupId}`;
        }}
      />
    </div>
  );
}
