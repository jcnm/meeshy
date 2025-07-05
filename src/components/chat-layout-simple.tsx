'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { 
  MessageSquare, 
  Send, 
  Search, 
  UserPlus,
  Users,
  Link2,
  Settings,
  LogOut,
  Bell
} from 'lucide-react';
import { buildApiUrl, API_ENDPOINTS } from '@/lib/config';
import { User, Conversation, Message } from '@/types';
import { useWebSocket } from '@/hooks/use-websocket-new';
import { useTypingIndicator } from '@/hooks/use-typing-indicator-new';
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
  
  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);
  
  // Hooks personnalisés
  const { socket, isConnected } = useWebSocket(currentUser?.id);
  const { typingUsers, startTyping, stopTyping } = useTypingIndicator(socket, currentUser?.id);

  // Auto-scroll vers les nouveaux messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Charger les conversations
  useEffect(() => {
    loadConversations();
  }, [currentUser]);

  // WebSocket - Écouter les nouveaux messages
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (message: Message) => {
      console.log('Nouveau message reçu:', message);
      
      // Si c'est la conversation active, ajouter le message
      if (selectedConversation && message.conversationId === selectedConversation.id) {
        setMessages(prev => [...prev, message]);
        scrollToBottom();
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
            const updatedConv = { 
              ...conversation, 
              lastMessage: message, 
              updatedAt: new Date(message.createdAt) 
            };
            return [updatedConv, ...others];
          }
          return prev;
        });
        
        // Notification toast
        const senderName = message.sender?.displayName || message.sender?.username || message.senderName || 'Utilisateur';
        toast.info(`💬 Message de ${senderName}`, {
          description: message.content.substring(0, 50) + (message.content.length > 50 ? '...' : ''),
          action: {
            label: 'Voir',
            onClick: () => openConversation(message.conversationId)
          }
        });
      }
    };

    const handleMessageSent = (message: Message) => {
      // Message envoyé avec succès - remplacer le message temporaire
      setMessages(prev => {
        const filtered = prev.filter(m => !m.id.startsWith('temp-'));
        return [...filtered, message];
      });
    };

    socket.on('messageReceived', handleNewMessage);
    socket.on('messageSent', handleMessageSent);
    socket.on('newMessage', handleNewMessage);

    return () => {
      socket.off('messageReceived', handleNewMessage);
      socket.off('messageSent', handleMessageSent);
      socket.off('newMessage', handleNewMessage);
    };
  }, [socket, selectedConversation]);

  // Gestion typing indicator
  useEffect(() => {
    if (!messageInputRef.current || !socket || !selectedConversation) return;

    let typingTimer: NodeJS.Timeout;

    const handleTyping = () => {
      startTyping(selectedConversation.id);
      
      clearTimeout(typingTimer);
      typingTimer = setTimeout(() => {
        stopTyping(selectedConversation.id);
      }, 3000);
    };

    const inputElement = messageInputRef.current;
    const handleInput = () => {
      if (newMessage.trim()) {
        handleTyping();
      } else {
        stopTyping(selectedConversation.id);
      }
    };

    inputElement.addEventListener('input', handleInput);

    return () => {
      inputElement?.removeEventListener('input', handleInput);
      clearTimeout(typingTimer);
      if (selectedConversation) {
        stopTyping(selectedConversation.id);
      }
    };
  }, [selectedConversation, socket, startTyping, stopTyping, newMessage]);

  const loadConversations = async () => {
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
  };

  const loadMessages = async (conversationId: string) => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(
        buildApiUrl(`/conversation/${conversationId}/messages`),
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
  };

  const openConversation = async (conversationId: string) => {
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
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || !socket) return;

    const messageData = {
      content: newMessage.trim(),
      conversationId: selectedConversation.id,
      originalLanguage: currentUser.systemLanguage
    };

    try {
      // Ajouter immédiatement à l'affichage (optimistic update)
      const tempMessage: Message = {
        id: `temp-${Date.now()}`,
        content: messageData.content,
        senderId: currentUser.id,
        conversationId: selectedConversation.id,
        originalLanguage: messageData.originalLanguage,
        isEdited: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        sender: currentUser,
        senderName: currentUser.displayName || currentUser.username,
        senderAvatar: currentUser.avatar
      };
      
      setMessages(prev => [...prev, tempMessage]);
      setNewMessage('');
      scrollToBottom();
      
      // Envoyer via WebSocket
      socket.emit('sendMessage', messageData);
      
      // Arrêter l'indicateur de frappe
      stopTyping(selectedConversation.id);
      
    } catch (error) {
      console.error('Erreur envoi message:', error);
      toast.error('Erreur lors de l\'envoi du message');
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
      p.user?.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.user?.displayName?.toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  // Simple message bubble component
  const MessageBubble = ({ message, isOwn }: { message: Message; isOwn: boolean }) => (
    <div className={cn("flex mb-4", isOwn ? "justify-end" : "justify-start")}>
      <div className={cn(
        "max-w-xs lg:max-w-md px-4 py-2 rounded-lg",
        isOwn 
          ? "bg-blue-500 text-white" 
          : "bg-gray-200 text-gray-900"
      )}>
        {!isOwn && (
          <p className="text-xs text-gray-500 mb-1">
            {message.sender?.displayName || message.sender?.username || message.senderName}
          </p>
        )}
        <p className="text-sm">{message.content}</p>
        <p className={cn(
          "text-xs mt-1",
          isOwn ? "text-blue-100" : "text-gray-500"
        )}>
          {new Date(message.createdAt).toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit'
          })}
          {message.isEdited && " (modifié)"}
        </p>
      </div>
    </div>
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
              <Button variant="ghost" size="sm">
                <Bell className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                <LogOut className="h-4 w-4" />
              </Button>
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
            <Button size="sm" className="flex-1">
              <UserPlus className="mr-2 h-4 w-4" />
              Nouveau Chat
            </Button>
            <Button variant="outline" size="sm">
              <Users className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm">
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
                            {conversation.title?.[0] || 
                             conversation.participants?.[0]?.user?.displayName?.[0] ||
                             conversation.participants?.[0]?.user?.username?.[0] || '?'}
                          </AvatarFallback>
                        </Avatar>
                        
                        {/* Info conversation */}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">
                            {conversation.title || 
                             conversation.participants?.map(p => 
                               p.user?.displayName || p.user?.username
                             ).join(', ')}
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
              <Button className="mt-4" onClick={() => openConversation(conversations[0]?.id)}>
                Commencer à discuter
              </Button>
            </div>
          </div>
        ) : isDrawerOpen && (
          /* Chat ouvert */
          <div className="flex flex-col h-full">
            {/* Header conversation */}
            <div className="p-4 border-b border-gray-200 bg-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Avatar>
                    <AvatarImage src={selectedConversation.participants?.[0]?.user?.avatar} />
                    <AvatarFallback>
                      {selectedConversation.title?.[0] || 
                       selectedConversation.participants?.[0]?.user?.displayName?.[0] ||
                       selectedConversation.participants?.[0]?.user?.username?.[0] || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <h2 className="font-semibold truncate">
                      {selectedConversation.title || 
                       selectedConversation.participants?.map(p => 
                         p.user?.displayName || p.user?.username
                       ).join(', ')}
                    </h2>
                    <p className="text-sm text-gray-500">
                      {isConnected && typingUsers[selectedConversation.id]?.length > 0 ? (
                        <span className="text-blue-500">
                          {typingUsers[selectedConversation.id].map(u => u.displayName || u.username).join(', ')} 
                          {typingUsers[selectedConversation.id].length > 1 ? ' sont en train d\'écrire...' : ' est en train d\'écrire...'}
                        </span>
                      ) : (
                        `${selectedConversation.participants?.length || 0} participant(s)`
                      )}
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setIsDrawerOpen(false)}>
                  ✕
                </Button>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-2">
                {messages.map(message => (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    isOwn={message.senderId === currentUser.id}
                  />
                ))}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Input message */}
            <div className="p-4 border-t border-gray-200 bg-white">
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
        )}
      </div>
    </div>
  );
}
