'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUser } from '@/context/AppContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
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
  Link2
} from 'lucide-react';
import { toast } from 'sonner';
import { Conversation, Message, TranslatedMessage } from '@/types';
import { conversationsService } from '@/services/conversationsService';
import { MessageBubble } from './message-bubble';
import { useOptimizedMessageTranslation } from '@/hooks/use-optimized-message-translation';
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
  const [translatedMessages, setTranslatedMessages] = useState<TranslatedMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isCreateLinkModalOpen, setIsCreateLinkModalOpen] = useState(false);
  const [isCreateConversationModalOpen, setIsCreateConversationModalOpen] = useState(false);
  
  // Hooks de traduction
  const { translateMessages, translateMessage } = useOptimizedMessageTranslation(user);

  // Handlers pour MessageBubble
  const handleTranslate = async (messageId: string, targetLanguage: string) => {
    const message = messages.find(m => m.id === messageId);
    if (!message) return;
    
    try {
      const translatedMessage = await translateMessage(message, targetLanguage);
      
      // Mettre à jour la liste des messages traduits
      setTranslatedMessages(prev => prev.map(m => 
        m.id === messageId ? translatedMessage : m
      ));
      
      toast.success('Message traduit');
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

  // Charger les messages d'une conversation spécifique
  const loadMessages = useCallback(async (conversationId: string) => {
    if (!user) return;

    try {
      console.log(`📬 Chargement des messages pour la conversation ${conversationId}`);
      
      // Charger les messages depuis l'API
      const messagesData = await conversationsService.getMessages(conversationId);
      const rawMessages = messagesData.messages;
      
      console.log(`📬 ${rawMessages.length} messages chargés`);
      setMessages(rawMessages);

      // Traduire les messages si la traduction automatique est activée
      if (user.autoTranslateEnabled && rawMessages.length > 0) {
        console.log(`🌍 Traduction automatique activée, traduction vers ${user.systemLanguage}`);
        
        try {
          const translated = await translateMessages(rawMessages, user.systemLanguage);
          setTranslatedMessages(translated);
          console.log(`✅ ${translated.length} messages traduits`);
        } catch (error) {
          console.error('❌ Erreur lors de la traduction des messages:', error);
          // En cas d'erreur de traduction, utiliser les messages originaux convertis
          const convertedMessages = rawMessages.map(msg => ({
            ...msg,
            originalContent: msg.content,
            translatedContent: undefined,
            targetLanguage: undefined,
            isTranslated: false,
            isTranslating: false,
            showingOriginal: true,
            translationError: undefined,
            translationFailed: false,
            translations: [],
            sender: msg.sender || {
              id: msg.senderId,
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
          })) as TranslatedMessage[];
          setTranslatedMessages(convertedMessages);
        }
      } else {
        // Pas de traduction automatique, convertir les messages sans traduction
        const convertedMessages = rawMessages.map(msg => ({
          ...msg,
          originalContent: msg.content,
          translatedContent: undefined,
          targetLanguage: undefined,
          isTranslated: false,
          isTranslating: false,
          showingOriginal: true,
          translationError: undefined,
          translationFailed: false,
          translations: [],
          sender: msg.sender || {
            id: msg.senderId,
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
        })) as TranslatedMessage[];
        setTranslatedMessages(convertedMessages);
      }

    } catch (error) {
      console.error('❌ Erreur lors du chargement des messages:', error);
      toast.error('Erreur lors du chargement des messages');
      
      // En cas d'erreur API, utiliser des messages mock pour le développement
      console.log('🔧 Utilisation de messages mock pour le développement');
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
            isOnline: false,
            createdAt: new Date(),
            lastActiveAt: new Date(),
          },
        },
        {
          id: '2',
          conversationId,
          senderId: user?.id || 'current-user',
          content: conversationId === '1' ? 'Ça va bien ! Et toi ?' : 'Parfait ! Je le regarde tout de suite.',
          originalLanguage: 'fr',
          isEdited: false,
          createdAt: new Date(Date.now() - 30 * 60 * 1000),
          updatedAt: new Date(Date.now() - 30 * 60 * 1000),
          sender: user || {
            id: 'current-user',
            username: 'current',
            firstName: 'Utilisateur',
            lastName: 'Actuel',
            email: 'current@example.com',
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
          },
        },
      ];
      
      setMessages(mockMessages);
      
      // Convertir les messages mock en TranslatedMessage
      const convertedMockMessages = mockMessages.map(msg => ({
        ...msg,
        originalContent: msg.content,
        translatedContent: undefined,
        targetLanguage: undefined,
        isTranslated: false,
        isTranslating: false,
        showingOriginal: true,
        translationError: undefined,
        translationFailed: false,
        translations: [],
      })) as TranslatedMessage[];
      setTranslatedMessages(convertedMockMessages);
    }
  }, [user, translateMessages]);

  // Charger les données initiales
  const loadData = useCallback(async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      
      // Charger la liste des conversations
      console.log('🔄 Chargement des conversations...');
      const conversationsData = await conversationsService.getConversations();
      console.log(`📚 ${conversationsData.length} conversations chargées`);
      setConversations(conversationsData);

      // Si une conversation spécifique est demandée, la sélectionner
      const targetConversationId = selectedConversationId || searchParams.get('id');
      if (targetConversationId) {
        const conversation = conversationsData.find((c: Conversation) => c.id === targetConversationId);
        if (conversation) {
          setSelectedConversation(conversation);
          await loadMessages(targetConversationId);
        }
      }

    } catch (error) {
      console.error('❌ Erreur lors du chargement des données:', error);
      toast.error('Erreur lors du chargement des données');
      
      // Messages mock en cas d'erreur
      const mockConversations: Conversation[] = [
        {
          id: '1',
          name: 'Marie Dubois',
          type: 'DIRECT',
          isGroup: false,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          participants: []
        },
        {
          id: '2',
          name: 'Équipe Design',
          type: 'GROUP',
          isGroup: true,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          participants: []
        }
      ];
      
      setConversations(mockConversations);
    } finally {
      setIsLoading(false);
    }
  }, [user, selectedConversationId, searchParams, loadMessages]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSelectConversation = (conversation: Conversation) => {
    setSelectedConversation(conversation);
    
    // Navigation mobile : rediriger vers la page de conversation
    if (window.innerWidth < 768) {
      router.push(`/conversations/${conversation.id}`);
    } else {
      // Desktop : charger les messages dans la vue actuelle
      loadMessages(conversation.id);
      router.push(`/conversations?id=${conversation.id}`);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || !user || isSending) return;

    setIsSending(true);
    
    try {
      const messageData = {
        content: newMessage.trim(),
        originalLanguage: user.systemLanguage || 'fr',
      };

      console.log(`📤 Envoi du message: "${messageData.content}"`);
      
      const newMsg = await conversationsService.sendMessage(selectedConversation.id, messageData);
      
      // Ajouter le nouveau message à la liste
      setMessages(prev => [...prev, newMsg]);
      
      // Créer la version TranslatedMessage du message envoyé
      const translatedMsg: TranslatedMessage = {
        ...newMsg,
        originalContent: newMsg.content,
        translatedContent: undefined,
        targetLanguage: undefined,
        isTranslated: false,
        isTranslating: false,
        showingOriginal: true,
        translationError: undefined,
        translationFailed: false,
        translations: [],
      };
      
      setTranslatedMessages(prev => [...prev, translatedMsg]);
      setNewMessage('');
      
      console.log('✅ Message envoyé avec succès');
      toast.success('Message envoyé !');
      
    } catch (error) {
      console.error('❌ Erreur lors de l\'envoi du message:', error);
      toast.error('Erreur lors de l\'envoi du message');
    } finally {
      setIsSending(false);
    }
  };

  const handleCreateConversation = () => {
    setIsCreateConversationModalOpen(true);
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-600">Chargement des conversations...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex h-full max-h-[calc(100vh-4rem)]">
        {/* Panel de gauche - Liste des conversations */}
        <div className="w-1/3 border-r border-gray-200 flex flex-col">
          <CardHeader className="flex-none">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Conversations
              </CardTitle>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCreateLinkModalOpen(true)}
                  className="flex items-center gap-2"
                >
                  <Link2 className="h-4 w-4" />
                  Lien
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCreateConversation}
                  className="flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Nouvelle
                </Button>
              </div>
            </div>
          </CardHeader>
          
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-2">
              {conversations.map((conversation) => (
                <div
                  key={conversation.id}
                  className={`p-3 rounded-lg cursor-pointer transition-colors ${
                    selectedConversation?.id === conversation.id
                      ? 'bg-blue-50 border-blue-200 border'
                      : 'hover:bg-gray-50 border border-transparent'
                  }`}
                  onClick={() => handleSelectConversation(conversation)}
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${conversation.name}`} />
                      <AvatarFallback>
                        {conversation.isGroup ? (
                          <Users className="h-4 w-4" />
                        ) : (
                          (conversation.name || 'Conversation').slice(0, 2).toUpperCase()
                        )}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium truncate">{conversation.name || 'Conversation'}</h3>
                        <span className="text-xs text-gray-500">
                          {conversation.lastMessage?.createdAt ? 
                            new Date(conversation.lastMessage.createdAt).toLocaleTimeString('fr-FR', {
                              hour: '2-digit',
                              minute: '2-digit'
                            }) : 
                            ''
                          }
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 truncate">
                        {conversation.isGroup ? 
                          `${conversation.participants?.length || 0} membres` : 
                          'Conversation privée'
                        }
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Panel de droite - Conversation sélectionnée */}
        <div className="flex-1 flex flex-col">
          {selectedConversation ? (
            <>
              {/* En-tête de conversation */}
              <CardHeader className="flex-none border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedConversation.name}`} />
                      <AvatarFallback>
                        {selectedConversation.isGroup ? (
                          <Users className="h-4 w-4" />
                        ) : (
                          (selectedConversation.name || 'Conversation').slice(0, 2).toUpperCase()
                        )}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h2 className="font-semibold">{selectedConversation.name || 'Conversation'}</h2>
                      <p className="text-sm text-gray-600">
                        {selectedConversation.isGroup ? 
                          `${selectedConversation.participants?.length || 0} membres` : 
                          'En ligne'
                        }
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>

              {/* Zone des messages */}
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {translatedMessages.map((message) => (
                    <MessageBubble
                      key={message.id}
                      message={message}
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
              <div className="flex-none p-4 border-t border-gray-200">
                <div className="flex gap-2">
                  <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Tapez votre message..."
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    disabled={isSending}
                  />
                  <Button 
                    onClick={handleSendMessage}
                    disabled={!newMessage.trim() || isSending}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-gray-500">
                <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">Sélectionnez une conversation</h3>
                <p>Choisissez une conversation pour commencer à discuter</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modales */}
      {isCreateLinkModalOpen && (
        <CreateLinkModal
          isOpen={isCreateLinkModalOpen}
          onClose={() => setIsCreateLinkModalOpen(false)}
          onLinkCreated={() => {
            setIsCreateLinkModalOpen(false);
            toast.success('Lien créé avec succès !');
          }}
        />
      )}

      {isCreateConversationModalOpen && user && (
        <CreateConversationModal
          isOpen={isCreateConversationModalOpen}
          onClose={() => setIsCreateConversationModalOpen(false)}
          currentUser={user}
          onConversationCreated={() => {
            setIsCreateConversationModalOpen(false);
            toast.success('Conversation créée avec succès !');
            loadData(); // Recharger la liste des conversations
          }}
        />
      )}
    </DashboardLayout>
  );
}
