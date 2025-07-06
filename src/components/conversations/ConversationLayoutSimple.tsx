'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUser } from '@/context/AppContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  MessageSquare, 
  Users, 
  Plus, 
  Send,
  MoreVertical,
  Link2,
  ArrowLeft
} from 'lucide-react';
import { toast } from 'sonner';
import { Conversation, Message, TranslatedMessage } from '@/types';
import { conversationsService } from '@/services/conversationsService';
import { MessageBubble } from './message-bubble';
import { useSimpleTranslation } from '@/hooks/use-simple-translation';
import { CreateLinkModal } from './create-link-modal';
import { CreateConversationModal } from './create-conversation-modal';

interface ConversationLayoutProps {
  selectedConversationId?: string;
}

export function ConversationLayout({ selectedConversationId }: ConversationLayoutProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useUser(); // Utiliser l'utilisateur du contexte
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isCreateLinkModalOpen, setIsCreateLinkModalOpen] = useState(false);
  const [isCreateConversationModalOpen, setIsCreateConversationModalOpen] = useState(false);
  
  // Hook de traduction
  const { translate } = useSimpleTranslation();

  // Fonction pour convertir Message en TranslatedMessage
  const convertToTranslatedMessage = (message: Message): TranslatedMessage => {
    return {
      ...message,
      originalContent: message.content,
      translatedContent: undefined,
      targetLanguage: undefined,
      isTranslated: false,
      isTranslating: false,
      showingOriginal: true,
      translationError: undefined,
      translationFailed: false,
      translations: [],
      sender: message.sender || {
        id: message.senderId,
        username: 'unknown',
        firstName: 'Utilisateur',
        lastName: 'Inconnu',
        email: 'unknown@example.com',
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
        systemLanguage: 'fr',
        regionalLanguage: 'fr',
        autoTranslateEnabled: false,
        translateToSystemLanguage: false,
        translateToRegionalLanguage: false,
        useCustomDestination: false,
        isOnline: false,
        createdAt: new Date(),
        lastActiveAt: new Date(),
      }
    };
  };

  // Handlers pour MessageBubble
  const handleTranslate = async (messageId: string, targetLanguage: string) => {
    const message = messages.find(m => m.id === messageId);
    if (!message) return;
    
    try {
      const translatedText = await translate(message.content, message.originalLanguage, targetLanguage);
      if (translatedText && translatedText !== message.content) {
        // Mettre à jour le message avec la traduction
        setMessages(prev => prev.map(m => 
          m.id === messageId ? {
            ...m,
            // On peut stocker la traduction dans les métadonnées du message
          } : m
        ));
        toast.success('Message traduit');
      } else {
        toast.error('Échec de la traduction');
      }
    } catch (error) {
      console.error('Erreur de traduction:', error);
      toast.error('Erreur lors de la traduction');
    }
  };

  const handleEdit = async (messageId: string, newContent: string) => {
    // TODO: Implémenter l'édition de message
    console.log('Edit message:', messageId, 'New content:', newContent);
    toast.info('Édition de message bientôt disponible');
  };

  const handleToggleOriginal = (messageId: string) => {
    // TODO: Implémenter le basculement original/traduit
    console.log('Toggle original for message:', messageId);
  };

  // Charger les conversations (l'utilisateur est déjà géré par ProtectedRoute et AppContext)
  const loadData = useCallback(async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token || !user) {
        // Si pas de token ou d'utilisateur, ne rien faire car ProtectedRoute s'en charge
        setIsLoading(false);
        return;
      }

      // Charger les conversations réelles depuis l'API
      const realConversations = await conversationsService.getConversations();
      setConversations(realConversations);

      // Sélectionner conversation depuis URL
      const conversationId = selectedConversationId || searchParams.get('id');
      if (conversationId && realConversations.length > 0) {
        const conversation = realConversations.find(c => c.id === conversationId);
        if (conversation) {
          setSelectedConversation(conversation);
          loadMessages(conversationId);
        }
      }

    } catch (error) {
      console.error('Erreur lors du chargement:', error);
      toast.error('Erreur lors du chargement des conversations');
      
      // En cas d'erreur, afficher des données mockées pour le développement
      const mockConversations: Conversation[] = [
        {
          id: '1',
          name: 'Marie Dubois',
          type: 'DIRECT',
          lastMessage: {
            id: '1',
            conversationId: '1',
            senderId: 'user1',
            content: 'Salut ! Comment ça va ?',
            originalLanguage: 'fr',
            isEdited: false,
            createdAt: new Date(),
            updatedAt: new Date(),
            sender: {
              id: 'user1',
              username: 'marie',
              firstName: 'Marie',
              lastName: 'Dubois',
              email: 'marie@example.com',
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
              systemLanguage: 'fr',
              regionalLanguage: 'fr',
              autoTranslateEnabled: false,
              translateToSystemLanguage: false,
              translateToRegionalLanguage: false,
              useCustomDestination: false,
              isOnline: true,
              createdAt: new Date(),
              lastActiveAt: new Date(),
            }
          },
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: '2',
          name: 'Équipe Design',
          type: 'GROUP',
          lastMessage: {
            id: '2',
            conversationId: '2',
            senderId: 'user2',
            content: 'Le nouveau mockup est prêt !',
            originalLanguage: 'fr',
            isEdited: false,
            createdAt: new Date(Date.now() - 30 * 60 * 1000),
            updatedAt: new Date(Date.now() - 30 * 60 * 1000),
            sender: {
              id: 'user2',
              username: 'alex',
              firstName: 'Alex',
              lastName: 'Martin',
              email: 'alex@example.com',
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
              systemLanguage: 'fr',
              regionalLanguage: 'fr',
              autoTranslateEnabled: false,
              translateToSystemLanguage: false,
              translateToRegionalLanguage: false,
              useCustomDestination: false,
              isOnline: false,
              createdAt: new Date(),
              lastActiveAt: new Date(Date.now() - 60 * 60 * 1000),
            }
          },
          isActive: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      ];

      setConversations(mockConversations);

      // Sélectionner conversation depuis URL
      const conversationId = selectedConversationId || searchParams.get('id');
      if (conversationId) {
        const conversation = mockConversations.find(c => c.id === conversationId);
        if (conversation) {
          setSelectedConversation(conversation);
          loadMessages(conversationId);
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, [selectedConversationId, searchParams, user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const loadMessages = async (conversationId: string) => {
    // Mock messages
    const mockMessages: Message[] = [
      {
        id: '1',
        conversationId,
        senderId: conversationId === '1' ? 'user1' : 'user2',
        content: conversationId === '1' ? 'Salut ! Comment ça va ?' : 'Le nouveau mockup est prêt !',
        originalLanguage: 'fr',
        isEdited: false,
        createdAt: new Date(Date.now() - 60 * 60 * 1000),
        updatedAt: new Date(Date.now() - 60 * 60 * 1000),
        sender: {
          id: conversationId === '1' ? 'user1' : 'user2',
          username: conversationId === '1' ? 'marie' : 'alex',
          firstName: conversationId === '1' ? 'Marie' : 'Alex',
          lastName: conversationId === '1' ? 'Dubois' : 'Martin',
          email: conversationId === '1' ? 'marie@example.com' : 'alex@example.com',
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
          systemLanguage: 'fr',
          regionalLanguage: 'fr',
          autoTranslateEnabled: false,
          translateToSystemLanguage: false,
          translateToRegionalLanguage: false,
          useCustomDestination: false,
          isOnline: true,
          createdAt: new Date(),
          lastActiveAt: new Date(),
        }
      }
    ];
    setMessages(mockMessages);
  };

  const handleSelectConversation = (conversation: Conversation) => {
    setSelectedConversation(conversation);
    loadMessages(conversation.id);
    router.push(`/conversations/${conversation.id}`);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedConversation || !user) return;

    setIsSending(true);
    try {
      // Mock envoi de message
      const newMsg: Message = {
        id: Date.now().toString(),
        conversationId: selectedConversation.id,
        senderId: user.id,
        content: newMessage,
        originalLanguage: 'fr',
        isEdited: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        sender: user
      };

      setMessages(prev => [...prev, newMsg]);
      setNewMessage('');
      toast.success('Message envoyé');
    } catch (error) {
      console.error('Erreur envoi message:', error);
      toast.error('Erreur lors de l\'envoi');
    } finally {
      setIsSending(false);
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('fr-FR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  if (isLoading) {
    return (
      <DashboardLayout title="Conversations">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Chargement des conversations...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Conversations">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col lg:grid lg:grid-cols-3 gap-6 h-screen lg:h-[700px]">
          {/* Liste des conversations - toujours visible en desktop, conditionnelle en mobile */}
          <div className={`lg:col-span-1 ${selectedConversation ? 'hidden lg:block' : 'block'}`}>
            <Card className="h-full">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center space-x-2">
                    <MessageSquare className="h-5 w-5" />
                    <span>Conversations</span>
                  </CardTitle>
                  <div className="flex items-center space-x-2">
                    <Button size="sm" variant="outline" onClick={() => setIsCreateLinkModalOpen(true)}>
                      <Link2 className="h-4 w-4 mr-2" />
                      
                    </Button>
                    <Button size="sm" onClick={() => setIsCreateConversationModalOpen(true)}>
                      <MessageSquare className="h-4 w-4 mr-2" />
                      
                    </Button>
                  </div>
                </div>
                <p className="text-sm text-gray-600">
                  {conversations.length} conversation{conversations.length > 1 ? 's' : ''}
                </p>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[560px]">
                  <div className="space-y-1 p-4">
                    {conversations.map((conversation) => (
                      <div
                        key={conversation.id}
                        onClick={() => handleSelectConversation(conversation)}
                        className={`flex items-center space-x-3 p-3 rounded-lg cursor-pointer transition-colors ${
                          selectedConversation?.id === conversation.id
                            ? 'bg-blue-50 border border-blue-200'
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        <Avatar className="h-10 w-10">
                          <AvatarImage src="" />
                          <AvatarFallback>
                            {conversation.type === 'GROUP' ? (
                              <Users className="h-5 w-5" />
                            ) : (
                              (conversation.name || 'C').slice(0, 2).toUpperCase()
                            )}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {conversation.name}
                            </p>
                            <div className="flex items-center space-x-2">
                              {conversation.isActive && (
                                <div className="h-2 w-2 bg-green-400 rounded-full"></div>
                              )}
                              <p className="text-xs text-gray-500">
                                {conversation.lastMessage && 
                                  formatTime(new Date(conversation.lastMessage.createdAt))
                                }
                              </p>
                            </div>
                          </div>
                          <p className="text-sm text-gray-500 truncate">
                            {conversation.lastMessage?.content}
                          </p>
                        </div>
                      </div>
                    ))}

                    {conversations.length === 0 && !isLoading && (
                      <div className="text-center py-8">
                        <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500 text-sm mb-2">Aucune conversation</p>
                        <p className="text-gray-400 text-xs mb-4">Commencez une nouvelle conversation avec vos contacts</p>
                        <Button size="sm" onClick={() => setIsCreateConversationModalOpen(true)}>
                          <Plus className="h-4 w-4 mr-2" />
                          Nouvelle conversation
                        </Button>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Zone de conversation */}
          <div className={`w-full lg:col-span-2 ${selectedConversation ? 'block' : 'hidden lg:block'}`}>
            {selectedConversation ? (
              <Card className="h-full flex flex-col">
                <CardHeader className="border-b">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {/* Bouton retour mobile */}
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="lg:hidden"
                        onClick={() => {
                          setSelectedConversation(null);
                          router.push('/conversations');
                        }}
                      >
                        <ArrowLeft className="h-4 w-4" />
                      </Button>
                      <Avatar className="h-10 w-10">
                        <AvatarImage src="" />
                        <AvatarFallback>
                          {selectedConversation.type === 'GROUP' ? (
                            <Users className="h-5 w-5" />
                          ) : (
                            (selectedConversation.name || 'C').slice(0, 2).toUpperCase()
                          )}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="font-semibold">{selectedConversation.name}</h3>
                        <p className="text-sm text-gray-500">
                          {selectedConversation.type === 'GROUP' ? 'Groupe' : 'Conversation privée'}
                        </p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>

                {/* Messages */}
                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-4">
                    {messages.map((message) => (
                      <MessageBubble
                        key={message.id}
                        message={convertToTranslatedMessage(message)}
                        currentUserId={user?.id || ''}
                        currentUserLanguage={user?.systemLanguage || 'fr'}
                        onTranslate={handleTranslate}
                        onEdit={handleEdit}
                        onToggleOriginal={handleToggleOriginal}
                      />
                    ))}
                  </div>
                </ScrollArea>

                {/* Zone de saisie */}
                <div className="border-t p-4">
                  <form onSubmit={handleSendMessage} className="flex space-x-2">
                    <Input
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Tapez votre message..."
                      disabled={isSending}
                      className="flex-1"
                    />
                    <Button type="submit" disabled={isSending || !newMessage.trim()}>
                      <Send className="h-4 w-4" />
                    </Button>
                  </form>
                </div>
              </Card>
            ) : (
              <Card className="h-full">
                <CardContent className="flex items-center justify-center h-full">
                  <div className="text-center text-gray-500">
                    <MessageSquare className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                    <h3 className="text-lg font-medium mb-2">Sélectionnez une conversation</h3>
                    <p className="mb-4">Choisissez une conversation dans la liste pour commencer à discuter</p>
                    <Button onClick={() => setIsCreateConversationModalOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Nouvelle conversation
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Modal de création de lien */}
      <CreateLinkModal 
        isOpen={isCreateLinkModalOpen} 
        onClose={() => setIsCreateLinkModalOpen(false)} 
        onLinkCreated={() => {
          setIsCreateLinkModalOpen(false);
          toast.success('Lien de conversation créé avec succès !');
        }}
      />

      {/* Modal de création de conversation */}
      {user && (
        <CreateConversationModal 
          isOpen={isCreateConversationModalOpen} 
          onClose={() => setIsCreateConversationModalOpen(false)} 
          currentUser={user}
          onConversationCreated={(conversationId) => {
            // Recharger les conversations pour inclure la nouvelle
            loadData();
            // Sélectionner la nouvelle conversation
            setSelectedConversation(null);
            router.push(`/conversations?id=${conversationId}`);
            setIsCreateConversationModalOpen(false);
            toast.success('Conversation créée avec succès !');
          }}
        />
      )}
    </DashboardLayout>
  );
}
