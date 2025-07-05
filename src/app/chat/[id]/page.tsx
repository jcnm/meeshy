'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { 
  Send, 
  ArrowLeft, 
  Users, 
  Settings,
  MoreVertical,
  Languages,
  Eye,
  EyeOff
} from 'lucide-react';
import { User, Conversation, Message, TranslatedMessage } from '@/types';
import { toast } from 'sonner';
import { io, Socket } from 'socket.io-client';

export default function ChatPage() {
  const params = useParams();
  const router = useRouter();
  const conversationId = params?.id as string;
  
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<TranslatedMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isConnectedUsers, setIsConnectedUsers] = useState(false);
  const [connectedUsers, setConnectedUsers] = useState<User[]>([]);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  
  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const initializeChat = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        if (!token) {
          router.push('/');
          return;
        }

        // Vérifier l'auth et récupérer l'utilisateur
        const authResponse = await fetch('http://localhost:3002/auth/me', {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (!authResponse.ok) {
          localStorage.removeItem('auth_token');
          router.push('/');
          return;
        }

        const userData = await authResponse.json();
        setCurrentUser(userData);

        // Charger la conversation
        const conversationResponse = await fetch(`http://localhost:3002/conversation/${conversationId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (!conversationResponse.ok) {
          toast.error('Conversation non trouvée');
          router.push('/dashboard');
          return;
        }

        const conversationData = await conversationResponse.json();
        setConversation(conversationData);

        // Charger les messages
        const messagesResponse = await fetch(`http://localhost:3002/message/conversation/${conversationId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (messagesResponse.ok) {
          const messagesData = await messagesResponse.json();
          setMessages(messagesData.map((msg: Message) => ({
            ...msg,
            isTranslated: false,
            showingOriginal: true,
          })));
        }

        // Initialiser WebSocket
        initializeWebSocket(userData.id, token);

      } catch (error) {
        console.error('Erreur initialisation chat:', error);
        router.push('/dashboard');
      } finally {
        setIsLoading(false);
      }
    };

    if (conversationId) {
      initializeChat();
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [conversationId, router]);

  const initializeWebSocket = (userId: string, token: string) => {
    socketRef.current = io('http://localhost:3002', {
      auth: { token }
    });

    socketRef.current.on('connect', () => {
      console.log('Connected to WebSocket');
      socketRef.current?.emit('join-conversation', { conversationId, userId });
    });

    socketRef.current.on('new-message', (message: Message) => {
      setMessages(prev => [...prev, {
        ...message,
        isTranslated: false,
        showingOriginal: true,
      }]);
      scrollToBottom();
    });

    socketRef.current.on('user-typing', ({ userId: typingUserId }: { userId: string }) => {
      if (typingUserId !== userId) {
        setTypingUsers(prev => [...prev.filter(id => id !== typingUserId), typingUserId]);
        setTimeout(() => {
          setTypingUsers(prev => prev.filter(id => id !== typingUserId));
        }, 3000);
      }
    });

    socketRef.current.on('user-joined', (users: User[]) => {
      setConnectedUsers(users);
    });

    socketRef.current.on('user-left', (users: User[]) => {
      setConnectedUsers(users);
    });
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !currentUser || isSending) return;

    setIsSending(true);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('http://localhost:3002/message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          conversationId,
          content: newMessage.trim(),
          originalLanguage: currentUser.systemLanguage,
        }),
      });

      if (response.ok) {
        setNewMessage('');
        // Le message sera ajouté via WebSocket
      } else {
        toast.error('Erreur lors de l\'envoi du message');
      }
    } catch (error) {
      console.error('Erreur envoi message:', error);
      toast.error('Erreur de connexion');
    } finally {
      setIsSending(false);
    }
  };

  const handleTyping = () => {
    if (socketRef.current && currentUser) {
      socketRef.current.emit('typing', { conversationId, userId: currentUser.id });
    }
  };

  const translateMessage = async (message: TranslatedMessage, targetLanguage: string) => {
    // TODO: Implémenter la traduction côté client avec MT5/NLLB
    // Pour l'instant, simuler la traduction
    const translatedContent = `[TRADUIT] ${message.content}`;
    
    setMessages(prev => prev.map(msg => 
      msg.id === message.id 
        ? { 
            ...msg, 
            translatedContent,
            targetLanguage,
            isTranslated: true,
            showingOriginal: false 
          }
        : msg
    ));
  };

  const toggleOriginalTranslated = (messageId: string) => {
    setMessages(prev => prev.map(msg => 
      msg.id === messageId 
        ? { ...msg, showingOriginal: !msg.showingOriginal }
        : msg
    ));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!conversation || !currentUser) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => router.back()}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            
            <div className="flex items-center space-x-3">
              <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                {conversation.isGroup ? (
                  <Users className="h-5 w-5 text-blue-600" />
                ) : (
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                )}
              </div>
              <div>
                <h1 className="font-semibold text-gray-900">
                  {conversation.name || 'Conversation sans nom'}
                </h1>
                <p className="text-sm text-gray-500">
                  {conversation.members.length} participant(s)
                  {typingUsers.length > 0 && (
                    <span className="ml-2 text-blue-600">• En train d'écrire...</span>
                  )}
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Dialog open={isConnectedUsers} onOpenChange={setIsConnectedUsers}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm">
                  <Users className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Participants</DialogTitle>
                  <DialogDescription>
                    Liste des participants de la conversation
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  {conversation.members.map((member) => (
                    <div key={member.id} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="h-8 w-8 bg-gray-200 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium">
                            {member.user.firstName[0]}{member.user.lastName[0]}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium">{member.user.firstName} {member.user.lastName}</p>
                          <p className="text-sm text-gray-500">@{member.user.username}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant={member.role === 'ADMIN' ? 'default' : 'secondary'}>
                          {member.role}
                        </Badge>
                        {connectedUsers.some(u => u.id === member.user.id) && (
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </DialogContent>
            </Dialog>
            
            <Button variant="ghost" size="sm">
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div 
            key={message.id}
            className={`flex ${message.senderId === currentUser.id ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-xs lg:max-w-md ${
              message.senderId === currentUser.id 
                ? 'bg-blue-600 text-white' 
                : 'bg-white text-gray-900'
            } rounded-lg px-4 py-2 shadow`}>
              {message.senderId !== currentUser.id && (
                <p className="text-xs font-medium mb-1 opacity-70">
                  {message.sender?.firstName} {message.sender?.lastName}
                </p>
              )}
              
              <p className="text-sm">
                {message.isTranslated && !message.showingOriginal 
                  ? message.translatedContent 
                  : message.content
                }
              </p>
              
              <div className="flex items-center justify-between mt-2">
                <p className="text-xs opacity-70">
                  {new Date(message.createdAt).toLocaleTimeString()}
                </p>
                
                {message.senderId !== currentUser.id && (
                  <div className="flex items-center space-x-1">
                    {message.isTranslated && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className={`h-6 w-6 p-0 ${
                          message.senderId === currentUser.id ? 'text-white hover:text-gray-200' : ''
                        }`}
                        onClick={() => toggleOriginalTranslated(message.id)}
                      >
                        {message.showingOriginal ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                      </Button>
                    )}
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`h-6 w-6 p-0 ${
                        message.senderId === currentUser.id ? 'text-white hover:text-gray-200' : ''
                      }`}
                      onClick={() => translateMessage(message, currentUser.systemLanguage)}
                    >
                      <Languages className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="bg-white border-t border-gray-200 p-4">
        <div className="flex items-center space-x-3">
          <Input
            placeholder="Tapez votre message..."
            value={newMessage}
            onChange={(e) => {
              setNewMessage(e.target.value);
              handleTyping();
            }}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            disabled={isSending}
            className="flex-1"
          />
          <Button 
            onClick={sendMessage}
            disabled={!newMessage.trim() || isSending}
            size="sm"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
