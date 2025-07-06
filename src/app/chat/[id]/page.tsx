'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { MessageBubble } from '@/components/conversations';
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
  Settings
} from 'lucide-react';
import { User, Conversation, Message, TranslatedMessage } from '@/types';
import { toast } from 'sonner';
import { io, Socket } from 'socket.io-client';
import { buildApiUrl, API_ENDPOINTS, APP_CONFIG } from '@/lib/config';
import { useSimpleTranslation } from '@/hooks/use-simple-translation';
import { ModelSetupModal } from '@/components/models/model-setup-modal';
import { useModelStatus } from '@/hooks/useModelStatus';

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
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  
  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Hook de traduction avec persistance
  const { translate } = useSimpleTranslation();

  // Hook de vérification des modèles
  const { hasAnyModel, isLoading: isLoadingModels } = useModelStatus();
  const [showModelSetup, setShowModelSetup] = useState(false);
  const [hasCheckedModels, setHasCheckedModels] = useState(false);

  useEffect(() => {
    const initializeChat = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        if (!token) {
          router.push('/');
          return;
        }

        // Vérifier l'auth et récupérer l'utilisateur
        const authResponse = await fetch(buildApiUrl(API_ENDPOINTS.AUTH.ME), {
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
        const conversationResponse = await fetch(`${buildApiUrl('/conversation')}/${conversationId}`, {
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
        const messagesResponse = await fetch(`${buildApiUrl('/message/conversation')}/${conversationId}`, {
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
        const initializeWebSocket = (userId: string, token: string) => {
          socketRef.current = io(APP_CONFIG.getBackendUrl(), {
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

          socketRef.current.on('user-joined', () => {
            // Users joined, could be used for presence indicators
          });

          socketRef.current.on('disconnect', () => {
            console.log('Disconnected from WebSocket');
          });
        };

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
      const response = await fetch(buildApiUrl(API_ENDPOINTS.MESSAGE.SEND), {
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

  // Handlers for MessageBubble actions
  const handleTranslate = async (messageId: string, targetLanguage: string, forceRetranslate = false) => {
    const messageIndex = messages.findIndex(msg => msg.id === messageId);
    if (messageIndex === -1) return;

    const message = messages[messageIndex];
    
    // Si déjà traduit et pas de force retranslate, basculer l'affichage
    if (message.translatedContent && !forceRetranslate) {
      setMessages(prev => prev.map(msg => 
        msg.id === messageId 
          ? { ...msg, showingOriginal: !msg.showingOriginal }
          : msg
      ));
      return;
    }

    // Marquer comme en cours de traduction
    setMessages(prev => prev.map(msg => 
      msg.id === messageId 
        ? { ...msg, isTranslating: true, translationError: undefined }
        : msg
    ));

    try {
      const translatedText = await translate(
        message.content, 
        message.originalLanguage || 'auto', 
        targetLanguage
      );

      // Mettre à jour avec la traduction
      setMessages(prev => prev.map(msg => 
        msg.id === messageId 
          ? { 
              ...msg, 
              translatedContent: translatedText,
              targetLanguage,
              isTranslated: true,
              isTranslating: false,
              showingOriginal: false,
              translationError: undefined
            }
          : msg
      ));
    } catch (error) {
      console.error('Erreur de traduction:', error);
      
      // Mettre à jour avec l'erreur
      setMessages(prev => prev.map(msg => 
        msg.id === messageId 
          ? { 
              ...msg, 
              isTranslating: false,
              translationError: 'Erreur lors de la traduction',
              translationFailed: true
            }
          : msg
      ));
    }
  };

  const handleEdit = async (messageId: string, newContent: string) => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${buildApiUrl('/message')}/${messageId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          content: newContent
        }),
      });

      if (response.ok) {
        setMessages(prev => prev.map(msg => 
          msg.id === messageId 
            ? { 
                ...msg, 
                content: newContent,
                isEdited: true,
                // Reset translations when content changes
                translatedContent: undefined,
                isTranslated: false,
                showingOriginal: true,
                translations: []
              }
            : msg
        ));
        toast.success('Message modifié');
      } else {
        toast.error('Erreur lors de la modification');
      }
    } catch (error) {
      console.error('Erreur modification message:', error);
      toast.error('Erreur de connexion');
    }
  };

  const handleToggleOriginal = (messageId: string) => {
    setMessages(prev => prev.map(msg => 
      msg.id === messageId 
        ? { ...msg, showingOriginal: !msg.showingOriginal }
        : msg
    ));
  };

  // Effet pour vérifier les modèles après l'initialisation
  useEffect(() => {
    if (currentUser && !isLoadingModels && !hasCheckedModels) {
      if (!hasAnyModel) {
        setShowModelSetup(true);
      } else {
        setHasCheckedModels(true);
      }
    }
  }, [currentUser, hasAnyModel, isLoadingModels, hasCheckedModels]);

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
                  {conversation.participants?.length || 0} participant(s)
                  {typingUsers.length > 0 && (
                    <span className="ml-2 text-blue-600">• En train d&apos;écrire...</span>
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
                  {conversation.participants?.map((member) => (
                    <div key={member.id} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="h-8 w-8 bg-gray-200 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium">
                            {member.user.displayName ? member.user.displayName[0].toUpperCase() : member.user.username[0].toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium">{member.user.displayName || member.user.username}</p>
                          <p className="text-sm text-gray-500">@{member.user.username}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant={member.role === 'ADMIN' ? 'default' : 'secondary'}>
                          {member.role}
                        </Badge>
                        {member.user.isOnline && (
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
          <MessageBubble
            key={message.id}
            message={message}
            currentUserId={currentUser.id}
            currentUserLanguage={currentUser.systemLanguage}
            onTranslate={handleTranslate}
            onEdit={handleEdit}
            onToggleOriginal={handleToggleOriginal}
          />
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

      {/* Model Setup Modal */}
      <ModelSetupModal 
        isOpen={showModelSetup} 
        onOpenChange={setShowModelSetup} 
        onComplete={() => setHasCheckedModels(true)}
      />
    </div>
  );
}
