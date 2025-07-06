'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUser } from '@/context/AppContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { CardHeader, CardTitle } from '@/components/ui/card';
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
  ArrowLeft,
  Search
} from 'lucide-react';
import { toast } from 'sonner';
import { Conversation, Message, TranslatedMessage } from '@/types';
import { conversationsService } from '@/services/conversationsService';
import { MessageBubble } from './message-bubble';
import { useOptimizedMessageTranslation } from '@/hooks/use-optimized-message-translation';
import { CreateLinkModal } from './create-link-modal';
import { CreateConversationModal } from './create-conversation-modal';
import { cn } from '@/lib/utils';

interface ConversationLayoutResponsiveProps {
  selectedConversationId?: string;
}

export function ConversationLayoutResponsive({ selectedConversationId }: ConversationLayoutResponsiveProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useUser();
  
  // États principaux
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [translatedMessages, setTranslatedMessages] = useState<TranslatedMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  
  // États UI responsive
  const [showConversationList, setShowConversationList] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  
  // États modaux
  const [isCreateLinkModalOpen, setIsCreateLinkModalOpen] = useState(false);
  const [isCreateConversationModalOpen, setIsCreateConversationModalOpen] = useState(false);
  
  // Hook de traduction
  const { translateMessages, translateMessage } = useOptimizedMessageTranslation(user);

  // Détecter si on est sur mobile
  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);
    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

  // Gérer l'affichage responsive
  useEffect(() => {
    if (isMobile) {
      // Sur mobile, montrer la liste si aucune conversation sélectionnée
      setShowConversationList(!selectedConversation);
    } else {
      // Sur desktop, toujours montrer la liste
      setShowConversationList(true);
    }
  }, [isMobile, selectedConversation]);

  // Handlers pour MessageBubble
  const handleTranslate = async (messageId: string, targetLanguage: string) => {
    const message = messages.find(m => m.id === messageId);
    if (!message) return;
    
    try {
      const translatedMessage = await translateMessage(message, targetLanguage);
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
    console.log('Edit message:', messageId, 'New content:', newContent);
    toast.info('Édition de message bientôt disponible');
  };

  const handleToggleOriginal = (messageId: string) => {
    console.log('Toggle original for message:', messageId);
  };

  // Charger les messages d'une conversation
  const loadMessages = useCallback(async (conversationId: string) => {
    if (!user) return;

    try {
      console.log(`📬 Chargement des messages pour la conversation ${conversationId}`);
      const messagesData = await conversationsService.getMessages(conversationId);
      const rawMessages = messagesData.messages;
      
      setMessages(rawMessages);

      if (user.autoTranslateEnabled && rawMessages.length > 0) {
        try {
          const translated = await translateMessages(rawMessages, user.systemLanguage);
          setTranslatedMessages(translated);
        } catch (error) {
          console.error('❌ Erreur lors de la traduction des messages:', error);
          const convertedMessages = rawMessages.map(msg => convertToTranslatedMessage(msg));
          setTranslatedMessages(convertedMessages);
        }
      } else {
        const convertedMessages = rawMessages.map(msg => convertToTranslatedMessage(msg));
        setTranslatedMessages(convertedMessages);
      }
    } catch (error) {
      console.error('❌ Erreur lors du chargement des messages:', error);
      toast.error('Erreur lors du chargement des messages');
      
      // Messages mock pour le développement
      const mockMessages = createMockMessages(conversationId);
      setMessages(mockMessages);
      const convertedMockMessages = mockMessages.map(msg => convertToTranslatedMessage(msg));
      setTranslatedMessages(convertedMockMessages);
    }
  }, [user, translateMessages]);

  // Fonction utilitaire pour convertir Message en TranslatedMessage
  const convertToTranslatedMessage = (msg: Message): TranslatedMessage => ({
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
    sender: msg.sender || createDefaultSender(msg.senderId)
  });

  // Créer un sender par défaut
  const createDefaultSender = (senderId: string) => ({
    id: senderId,
    username: 'unknown',
    firstName: 'Utilisateur',
    lastName: 'Inconnu',
    email: 'unknown@example.com',
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
    systemLanguage: 'fr',
    regionalLanguage: 'fr',
    autoTranslateEnabled: false,
    translateToSystemLanguage: false,
    translateToRegionalLanguage: false,
    useCustomDestination: false,
    isOnline: false,
    createdAt: new Date(),
    lastActiveAt: new Date(),
  });

  // Créer des messages mock
  const createMockMessages = (conversationId: string): Message[] => [
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
        lastName: conversationId === '1' ? 'Martin' : 'Dubois',
        email: conversationId === '1' ? 'marie@example.com' : 'alex@example.com',
        role: 'USER',
        permissions: createDefaultSender('').permissions,
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
    {
      id: '2',
      conversationId,
      senderId: user?.id || 'current-user',
      content: conversationId === '1' ? 'Ça va bien ! Et toi ?' : 'Parfait ! Je le regarde tout de suite.',
      originalLanguage: 'fr',
      isEdited: false,
      createdAt: new Date(Date.now() - 30 * 60 * 1000),
      updatedAt: new Date(Date.now() - 30 * 60 * 1000),
      sender: user || createDefaultSender('current-user'),
    },
  ];

  // Charger les données initiales
  const loadData = useCallback(async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      console.log('🔄 Chargement des conversations...');
      
      const conversationsData = await conversationsService.getConversations();
      
      setConversations(conversationsData);
      console.log(`✅ ${conversationsData.length} conversations chargées`);

      // Sélectionner une conversation par défaut ou depuis l'URL
      const conversationIdFromUrl = searchParams.get('id') || selectedConversationId;
      if (conversationIdFromUrl) {
        const conversation = conversationsData.find(c => c.id === conversationIdFromUrl);
        if (conversation) {
          setSelectedConversation(conversation);
          await loadMessages(conversation.id);
        }
      } else if (conversationsData.length > 0) {
        // Sélectionner la première conversation par défaut
        const firstConversation = conversationsData[0];
        setSelectedConversation(firstConversation);
        await loadMessages(firstConversation.id);
      }
    } catch (error) {
      console.error('❌ Erreur lors du chargement des conversations:', error);
      toast.error('Erreur lors du chargement des conversations');
      
      // Conversations mock pour le développement
      const mockConversations: Conversation[] = [
        {
          id: '1',
          name: 'Marie Dubois',
          type: 'PRIVATE',
          isGroup: false,
          isActive: true,
          participants: [
            { 
              id: 'p1',
              conversationId: '1',
              userId: 'user1', 
              joinedAt: new Date(), 
              role: 'MEMBER',
              user: {
                id: 'user1',
                username: 'marie',
                displayName: 'Marie Dubois',
                email: 'marie@example.com',
                role: 'USER',
                permissions: { canAccessAdmin: false, canManageUsers: false, canManageGroups: false, canManageConversations: false, canViewAnalytics: false, canModerateContent: false, canViewAuditLogs: false, canManageNotifications: false, canManageTranslations: false },
                systemLanguage: 'fr',
                regionalLanguage: 'fr',
                autoTranslateEnabled: true,
                translateToSystemLanguage: true,
                translateToRegionalLanguage: false,
                useCustomDestination: false,
                isOnline: true,
                createdAt: new Date(),
                lastActiveAt: new Date()
              }
            },
            { 
              id: 'p2',
              conversationId: '1',
              userId: user?.id || 'current-user', 
              joinedAt: new Date(), 
              role: 'MEMBER',
              user: user || {
                id: 'current-user',
                username: 'current',
                displayName: 'Utilisateur',
                email: 'user@example.com',
                role: 'USER',
                permissions: { canAccessAdmin: false, canManageUsers: false, canManageGroups: false, canManageConversations: false, canViewAnalytics: false, canModerateContent: false, canViewAuditLogs: false, canManageNotifications: false, canManageTranslations: false },
                systemLanguage: 'fr',
                regionalLanguage: 'fr',
                autoTranslateEnabled: true,
                translateToSystemLanguage: true,
                translateToRegionalLanguage: false,
                useCustomDestination: false,
                isOnline: true,
                createdAt: new Date(),
                lastActiveAt: new Date()
              }
            }
          ],
          createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
          updatedAt: new Date(Date.now() - 60 * 60 * 1000),
          lastMessage: {
            id: 'last1',
            conversationId: '1',
            senderId: 'user1',
            content: 'Salut ! Comment ça va ?',
            originalLanguage: 'fr',
            isEdited: false,
            createdAt: new Date(Date.now() - 60 * 60 * 1000),
            updatedAt: new Date(Date.now() - 60 * 60 * 1000),
            sender: {
              id: 'user1',
              username: 'marie',
              displayName: 'Marie Dubois',
              email: 'marie@example.com',
              role: 'USER',
              permissions: { canAccessAdmin: false, canManageUsers: false, canManageGroups: false, canManageConversations: false, canViewAnalytics: false, canModerateContent: false, canViewAuditLogs: false, canManageNotifications: false, canManageTranslations: false },
              systemLanguage: 'fr',
              regionalLanguage: 'fr',
              autoTranslateEnabled: true,
              translateToSystemLanguage: true,
              translateToRegionalLanguage: false,
              useCustomDestination: false,
              isOnline: true,
              createdAt: new Date(),
              lastActiveAt: new Date()
            }
          },
          unreadCount: 0,
        },
        {
          id: '2',
          name: 'Équipe Design',
          type: 'GROUP',
          isGroup: true,
          isActive: true,
          participants: [
            { 
              id: 'p3',
              conversationId: '2',
              userId: 'user2', 
              joinedAt: new Date(), 
              role: 'ADMIN',
              user: {
                id: 'user2',
                username: 'design_lead',
                displayName: 'Design Lead',
                email: 'design@example.com',
                role: 'USER',
                permissions: { canAccessAdmin: false, canManageUsers: false, canManageGroups: false, canManageConversations: false, canViewAnalytics: false, canModerateContent: false, canViewAuditLogs: false, canManageNotifications: false, canManageTranslations: false },
                systemLanguage: 'fr',
                regionalLanguage: 'fr',
                autoTranslateEnabled: true,
                translateToSystemLanguage: true,
                translateToRegionalLanguage: false,
                useCustomDestination: false,
                isOnline: true,
                createdAt: new Date(),
                lastActiveAt: new Date()
              }
            },
            { 
              id: 'p4',
              conversationId: '2',
              userId: user?.id || 'current-user', 
              joinedAt: new Date(), 
              role: 'MEMBER',
              user: user || {
                id: 'current-user',
                username: 'current',
                displayName: 'Utilisateur',
                email: 'user@example.com',
                role: 'USER',
                permissions: { canAccessAdmin: false, canManageUsers: false, canManageGroups: false, canManageConversations: false, canViewAnalytics: false, canModerateContent: false, canViewAuditLogs: false, canManageNotifications: false, canManageTranslations: false },
                systemLanguage: 'fr',
                regionalLanguage: 'fr',
                autoTranslateEnabled: true,
                translateToSystemLanguage: true,
                translateToRegionalLanguage: false,
                useCustomDestination: false,
                isOnline: true,
                createdAt: new Date(),
                lastActiveAt: new Date()
              }
            }
          ],
          createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
          updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
          lastMessage: {
            id: 'last2',
            conversationId: '2',
            senderId: 'user2',
            content: 'Le nouveau mockup est prêt !',
            originalLanguage: 'fr',
            isEdited: false,
            createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
            updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
            sender: {
              id: 'user2',
              username: 'design_lead',
              displayName: 'Design Lead',
              email: 'design@example.com',
              role: 'USER',
              permissions: { canAccessAdmin: false, canManageUsers: false, canManageGroups: false, canManageConversations: false, canViewAnalytics: false, canModerateContent: false, canViewAuditLogs: false, canManageNotifications: false, canManageTranslations: false },
              systemLanguage: 'fr',
              regionalLanguage: 'fr',
              autoTranslateEnabled: true,
              translateToSystemLanguage: true,
              translateToRegionalLanguage: false,
              useCustomDestination: false,
              isOnline: true,
              createdAt: new Date(),
              lastActiveAt: new Date()
            }
          },
          unreadCount: 1,
        },
      ];
      
      setConversations(mockConversations);
      
      if (mockConversations.length > 0) {
        const firstConversation = mockConversations[0];
        setSelectedConversation(firstConversation);
        await loadMessages(firstConversation.id);
      }
    } finally {
      setIsLoading(false);
    }
  }, [user, searchParams, selectedConversationId, loadMessages]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Sélectionner une conversation
  const handleSelectConversation = (conversation: Conversation) => {
    setSelectedConversation(conversation);
    loadMessages(conversation.id);
    
    // Sur mobile, masquer la liste pour afficher les messages
    if (isMobile) {
      setShowConversationList(false);
    }
    
    // Mettre à jour l'URL
    router.push(`/conversations?id=${conversation.id}`, { scroll: false });
  };

  // Retour à la liste (mobile uniquement)
  const handleBackToList = () => {
    if (isMobile) {
      setShowConversationList(true);
      setSelectedConversation(null);
      router.push('/conversations', { scroll: false });
    }
  };

  // Envoyer un message
  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || !user) {
      return;
    }

    setIsSending(true);

    try {
      console.log('📤 Envoi du message:', newMessage);
      
      const response = await conversationsService.sendMessage(selectedConversation.id, {
        content: newMessage.trim(),
        originalLanguage: user.systemLanguage,
      });

      console.log('✅ Message envoyé:', response);
      setNewMessage('');
      
      // Recharger les messages
      await loadMessages(selectedConversation.id);
      toast.success('Message envoyé');
      
    } catch (error) {
      console.error('❌ Erreur lors de l\'envoi du message:', error);
      toast.error('Erreur lors de l\'envoi du message');
    } finally {
      setIsSending(false);
    }
  };

  // Gérer Entrée pour envoyer
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Format de date pour les conversations
  const formatDate = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'À l\'instant';
    if (diffMins < 60) return `${diffMins}min`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}j`;
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex h-full items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Chargement des conversations...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex h-full bg-background">
        {/* Liste des conversations */}
        <div className={cn(
          "flex flex-col border-r bg-background",
          isMobile ? (showConversationList ? "w-full" : "hidden") : "w-1/3 min-w-[300px] max-w-[400px]"
        )}>
          {/* En-tête de la liste */}
          <CardHeader className="border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Conversations
              </CardTitle>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsCreateLinkModalOpen(true)}
                >
                  <Link2 className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsCreateConversationModalOpen(true)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>

          {/* Liste scrollable */}
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {conversations.map((conversation) => (
                <div
                  key={conversation.id}
                  className={cn(
                    "flex items-center p-3 rounded-lg cursor-pointer transition-colors hover:bg-accent",
                    selectedConversation?.id === conversation.id && "bg-accent"
                  )}
                  onClick={() => handleSelectConversation(conversation)}
                >
                  <Avatar className="h-10 w-10 mr-3">
                    <AvatarImage />
                    <AvatarFallback>
                      {conversation.isGroup ? (
                        <Users className="h-5 w-5" />
                      ) : (
                        (conversation.name || conversation.title || 'U').slice(0, 2).toUpperCase()
                      )}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="font-medium truncate">{conversation.name || conversation.title || 'Conversation sans nom'}</p>
                      {conversation.lastMessage && (
                        <span className="text-xs text-muted-foreground">
                          {formatDate(conversation.lastMessage.createdAt)}
                        </span>
                      )}
                    </div>
                    {conversation.lastMessage && (
                      <p className="text-sm text-muted-foreground truncate">
                        {conversation.lastMessage.content}
                      </p>
                    )}
                  </div>
                  
                  {(conversation.unreadCount || 0) > 0 && (
                    <div className="ml-2 bg-primary text-primary-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center">
                      {conversation.unreadCount}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Zone de messages */}
        <div className={cn(
          "flex flex-col",
          isMobile ? (showConversationList ? "hidden" : "w-full") : "flex-1"
        )}>
          {selectedConversation ? (
            <>
              {/* En-tête de la conversation */}
              <CardHeader className="border-b">
                <div className="flex items-center gap-3">
                  {isMobile && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleBackToList}
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                  )}
                  <Avatar className="h-8 w-8">
                    <AvatarImage />
                    <AvatarFallback>
                      {selectedConversation.isGroup ? (
                        <Users className="h-4 w-4" />
                      ) : (
                        (selectedConversation.name || selectedConversation.title || 'U').slice(0, 2).toUpperCase()
                      )}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <CardTitle className="text-base">{selectedConversation.name || selectedConversation.title || 'Conversation sans nom'}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {selectedConversation.isGroup 
                        ? `${selectedConversation.participants?.length || 0} participants`
                        : 'En ligne'
                      }
                    </p>
                  </div>
                  <Button size="sm" variant="ghost">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>

              {/* Messages */}
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
              <div className="border-t p-4">
                <div className="flex gap-2">
                  <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Tapez votre message..."
                    disabled={isSending}
                    className="flex-1"
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={!newMessage.trim() || isSending}
                    size="sm"
                  >
                    {isSending ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            // État vide (desktop uniquement)
            !isMobile && (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium">Sélectionnez une conversation</h3>
                  <p className="text-muted-foreground">
                    Choisissez une conversation pour commencer à discuter
                  </p>
                </div>
              </div>
            )
          )}
        </div>
      </div>

      {/* Modales */}
      <CreateLinkModal
        isOpen={isCreateLinkModalOpen}
        onClose={() => setIsCreateLinkModalOpen(false)}
        onLinkCreated={() => {
          console.log('Lien créé');
          loadData();
        }}
      />
      
      {user && (
        <CreateConversationModal
          isOpen={isCreateConversationModalOpen}
          onClose={() => setIsCreateConversationModalOpen(false)}
          currentUser={user}
          onConversationCreated={() => {
            console.log('Conversation créée');
            loadData();
          }}
        />
      )}
    </DashboardLayout>
  );
}
