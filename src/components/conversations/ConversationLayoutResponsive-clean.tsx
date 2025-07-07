'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUser } from '@/context/AppContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  MessageSquare, 
  Users, 
  Plus, 
  Send,
  ArrowLeft,
  Link2
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
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
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

  // Utilitaires
  const convertToTranslatedMessage = useCallback((message: Message): TranslatedMessage => {
    return {
      ...message,
      translatedContent: message.content,
      targetLanguage: user?.systemLanguage || 'fr',
    };
  }, [user?.systemLanguage]);

  const createMockMessages = useCallback((conversationId: string): Message[] => {
    return [
      {
        id: `mock-${conversationId}-1`,
        content: "Salut ! Comment ça va ?",
        senderId: 'user1',
        conversationId,
        originalLanguage: 'fr',
        isEdited: false,
        createdAt: new Date(Date.now() - 3600000), // 1h ago
        updatedAt: new Date(Date.now() - 3600000),
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
      {
        id: `mock-${conversationId}-2`,
        content: "Très bien ! Et toi ?",
        senderId: user?.id || 'current-user',
        conversationId,
        originalLanguage: 'fr',
        isEdited: false,
        createdAt: new Date(Date.now() - 1800000), // 30min ago
        updatedAt: new Date(Date.now() - 1800000),
        sender: user || {
          id: 'current-user',
          username: 'moi',
          displayName: 'Moi',
          email: 'moi@example.com',
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
    ];
  }, [user]);

  // Charger les messages d'une conversation
  const loadMessages = useCallback(async (conversationId: string) => {
    if (!user) return;

    try {
      setIsLoadingMessages(true);
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
      console.log('🔄 Utilisation des messages mock pour le développement');
      
      // Messages mock pour le développement - ne pas afficher d'erreur
      const mockMessages = createMockMessages(conversationId);
      setMessages(mockMessages);
      const convertedMockMessages = mockMessages.map(msg => convertToTranslatedMessage(msg));
      setTranslatedMessages(convertedMockMessages);
    } finally {
      setIsLoadingMessages(false);
    }
  }, [user, translateMessages, convertToTranslatedMessage, createMockMessages]);

  // Charger les données initiales
  const loadData = useCallback(async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      console.log('🔄 Chargement des conversations...');
      
      const conversationsData = await conversationsService.getConversations();
      
      setConversations(conversationsData);
      console.log(`✅ ${conversationsData.length} conversations chargées`);

      // Sélectionner une conversation seulement si spécifiée dans l'URL
      const conversationIdFromUrl = searchParams.get('id') || selectedConversationId;
      if (conversationIdFromUrl) {
        const conversation = conversationsData.find(c => c.id === conversationIdFromUrl);
        if (conversation) {
          setSelectedConversation(conversation);
          await loadMessages(conversation.id);
        }
      }
      // Ne plus sélectionner automatiquement la première conversation
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
                username: 'moi',
                displayName: 'Moi',
                email: 'moi@example.com',
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
          createdAt: new Date(),
          updatedAt: new Date(),
          lastMessage: {
            id: 'last-msg-1',
            content: 'Salut ! Comment ça va ?',
            senderId: 'user1',
            conversationId: '1',
            originalLanguage: 'fr',
            isEdited: false,
            createdAt: new Date(Date.now() - 3600000),
            updatedAt: new Date(Date.now() - 3600000),
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
          unreadCount: 1
        }
      ];
      setConversations(mockConversations);
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
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
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
      toast.success('Message envoyé !');
    } catch (error) {
      console.error('❌ Erreur lors de l\'envoi du message:', error);
      toast.error('Erreur lors de l\'envoi du message');
    } finally {
      setIsSending(false);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <DashboardLayout title="Conversations">
      {isLoading ? (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Chargement des conversations...</p>
          </div>
        </div>
      ) : (
        <div className="h-[calc(100vh-6rem)] flex bg-transparent">
          {/* Liste des conversations */}
          <div className={cn(
            "flex flex-col bg-white/80 backdrop-blur-sm rounded-l-2xl border border-border/50 shadow-lg",
            isMobile ? (showConversationList ? "w-full" : "hidden") : "w-96"
          )}>
            {/* Header fixe */}
            <div className="flex-shrink-0 p-4 border-b border-border/30">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-foreground">Conversations</h2>
                <div className="relative">
                  <MessageSquare className="h-6 w-6 text-primary" />
                  {conversations.filter(c => (c.unreadCount || 0) > 0).length > 0 && (
                    <div className="absolute -top-2 -right-2 h-5 w-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                      {conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0)}
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Liste scrollable */}
            <div className="flex-1 overflow-y-auto">
              {conversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                  <MessageSquare className="h-16 w-16 text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">Aucune conversation</h3>
                  <p className="text-muted-foreground mb-6">
                    Commencez une nouvelle conversation pour discuter avec vos amis !
                  </p>
                </div>
              ) : (
                <div className="p-2">
                  {conversations.map((conversation) => (
                    <div
                      key={conversation.id}
                      onClick={() => handleSelectConversation(conversation)}
                      className={cn(
                        "flex items-center p-4 rounded-2xl cursor-pointer transition-all mb-2 border-2",
                        selectedConversation?.id === conversation.id
                          ? "bg-primary/20 border-primary/40 shadow-md"
                          : "hover:bg-accent/50 border-transparent hover:border-border/30"
                      )}
                    >
                      <div className="relative">
                        <Avatar className="h-12 w-12 ring-2 ring-primary/20">
                          <AvatarImage />
                          <AvatarFallback className="bg-primary/20 text-primary font-bold">
                            {conversation.isGroup ? (
                              <Users className="h-6 w-6" />
                            ) : (
                              (conversation.name || conversation.title || 'U').slice(0, 2).toUpperCase()
                            )}
                          </AvatarFallback>
                        </Avatar>
                        <div className="absolute -bottom-0 -right-0 h-4 w-4 bg-green-500 rounded-full border-2 border-background"></div>
                      </div>
                      
                      <div className="ml-4 flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h3 className="font-bold text-foreground truncate">
                            {conversation.name || conversation.title || 'Conversation sans nom'}
                          </h3>
                          {conversation.lastMessage && (
                            <span className="text-xs text-muted-foreground ml-2 flex-shrink-0">
                              {new Date(conversation.lastMessage.createdAt).toLocaleTimeString('fr-FR', { 
                                hour: '2-digit', 
                                minute: '2-digit' 
                              })}
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
                        <div className="ml-3 bg-primary text-primary-foreground text-xs rounded-full h-6 w-6 flex items-center justify-center font-bold shadow-sm">
                          {conversation.unreadCount}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {/* Footer fixe avec boutons */}
            <div className="flex-shrink-0 p-4 border-t border-border/30 bg-background/50">
              <div className="flex gap-3">
                <Button
                  className="flex-1 rounded-2xl h-12 bg-primary/10 hover:bg-primary/20 border-0 text-primary font-semibold"
                  onClick={() => setIsCreateLinkModalOpen(true)}
                >
                  <Link2 className="h-5 w-5 mr-2" />
                  Créer un lien
                </Button>
                <Button
                  className="flex-1 rounded-2xl h-12 bg-primary/10 hover:bg-primary/20 border-0 text-primary font-semibold"
                  onClick={() => setIsCreateConversationModalOpen(true)}
                >
                  <Plus className="h-5 w-5 mr-2" />
                  Nouvelle conversation
                </Button>
              </div>
            </div>
          </div>

          {/* Zone de messages */}
          <div className={cn(
            "flex flex-col",
            isMobile ? (showConversationList ? "hidden" : "w-full") : "flex-1"
          )}>
            {selectedConversation ? (
              <>
                {/* En-tête de la conversation */}
                <div className="flex-shrink-0 p-4 border-b border-border/30 bg-white/90 backdrop-blur-sm rounded-tr-2xl">
                  <div className="flex items-center gap-3">
                    {isMobile && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleBackToList}
                        className="rounded-full h-10 w-10 p-0 hover:bg-accent/50"
                      >
                        <ArrowLeft className="h-5 w-5" />
                      </Button>
                    )}
                    <div className="relative">
                      <Avatar className="h-10 w-10 ring-2 ring-primary/20">
                        <AvatarImage />
                        <AvatarFallback className="bg-primary/20 text-primary font-bold">
                          {selectedConversation.isGroup ? (
                            <Users className="h-5 w-5" />
                          ) : (
                            (selectedConversation.name || selectedConversation.title || 'U').slice(0, 2).toUpperCase()
                          )}
                        </AvatarFallback>
                      </Avatar>
                      <div className="absolute -bottom-0 -right-0 h-3 w-3 bg-green-500 rounded-full border-2 border-background"></div>
                    </div>
                    <div className="flex-1">
                      <h2 className="font-bold text-lg text-foreground">
                        {selectedConversation.name || selectedConversation.title || 'Conversation sans nom'}
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        {selectedConversation.isGroup 
                          ? `${selectedConversation.participants?.length || 0} personnes`
                          : 'En ligne'
                        }
                      </p>
                    </div>
                  </div>
                </div>

                {/* Messages scrollables */}
                <div className="flex-1 overflow-y-auto p-4 bg-white/50 backdrop-blur-sm">
                  {isLoadingMessages ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                        <p className="text-muted-foreground">Chargement des messages...</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {translatedMessages.map((message) => (
                        <MessageBubble
                          key={message.id}
                          message={message}
                          currentUserId={user.id}
                          currentUserLanguage={user.systemLanguage}
                          onTranslate={handleTranslate}
                          onEdit={handleEdit}
                          onToggleOriginal={() => {
                            console.log('Toggle original pour le message:', message.id);
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Zone de saisie fixe en bas */}
                <div className="flex-shrink-0 p-4 border-t border-border/30 bg-white/90 backdrop-blur-sm rounded-br-2xl">
                  <form onSubmit={handleSendMessage} className="flex gap-3">
                    <Input
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Écris ton message..."
                      className="flex-1 rounded-2xl h-12 px-4 border-2 border-border/30 focus:border-primary/50 bg-background/50"
                      disabled={isSending}
                    />
                    <Button 
                      type="submit"
                      size="sm"
                      disabled={!newMessage.trim() || isSending}
                      className="rounded-2xl h-12 w-12 p-0 bg-primary hover:bg-primary/90 shadow-md hover:shadow-lg transition-all"
                    >
                      {isSending ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      ) : (
                        <Send className="h-5 w-5" />
                      )}
                    </Button>
                  </form>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-white/50 backdrop-blur-sm rounded-r-2xl">
                <div className="max-w-md">
                  <div className="w-24 h-24 mx-auto mb-6 bg-primary/10 rounded-full flex items-center justify-center">
                    <MessageSquare className="h-12 w-12 text-primary" />
                  </div>
                  
                  {conversations.length > 0 ? (
                    <>
                      <h3 className="text-xl font-bold text-foreground mb-2 text-center">Choisis une conversation !</h3>
                      <p className="text-muted-foreground text-base mb-6 text-center">
                        Clique sur une conversation à gauche pour commencer à discuter
                      </p>
                    </>
                  ) : (
                    <>
                      <h3 className="text-xl font-bold text-foreground mb-2 text-center">Bienvenue ! 🎉</h3>
                      <p className="text-muted-foreground text-base mb-6 text-center">
                        Tu n&apos;as pas encore de conversations. Commence par en créer une !
                      </p>
                    </>
                  )}
                </div>
                
                {/* Boutons d'action dans l'état vide */}
                <div className="flex gap-4 justify-center">
                  <Button
                    onClick={() => setIsCreateConversationModalOpen(true)}
                    className="rounded-2xl px-6 py-3 bg-primary hover:bg-primary/90 text-white font-semibold shadow-md hover:shadow-lg transition-all"
                  >
                    <Plus className="h-5 w-5 mr-2" />
                    Nouvelle conversation
                  </Button>
                  <Button
                    onClick={() => setIsCreateLinkModalOpen(true)}
                    variant="outline"
                    className="rounded-2xl px-6 py-3 border-2 border-primary/20 hover:border-primary/40 font-semibold shadow-md hover:shadow-lg transition-all"
                  >
                    <Link2 className="h-5 w-5 mr-2" />
                    Créer un lien
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modales */}
      <CreateLinkModal
        isOpen={isCreateLinkModalOpen}
        onClose={() => setIsCreateLinkModalOpen(false)}
        onLinkCreated={() => {
          console.log('Lien créé');
          loadData();
        }}
      />
      
      <CreateConversationModal
        isOpen={isCreateConversationModalOpen}
        onClose={() => setIsCreateConversationModalOpen(false)}
        currentUser={user}
        onConversationCreated={() => {
          console.log('Conversation créée');
          loadData();
        }}
      />
    </DashboardLayout>
  );
}
