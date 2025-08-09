'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useConversations } from '@/context/AppContext';
import { useMessaging } from '@/hooks/use-messaging';
import { Conversation, Message } from '@/types';
import { conversationsService } from '@/services/conversations.service';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  LoadingState,
  ErrorBoundary
} from '@/components/common';
import { ConversationList, ConversationView, CreateConversationModal } from './index';
import { Plus, MessageSquare, Users } from 'lucide-react';
import { toast } from 'sonner';

interface ConversationLayoutProps {
  selectedConversationId?: string;
}

export function ConversationLayout({ selectedConversationId }: ConversationLayoutProps) {
  const { user } = useUser();
  const { conversations, setConversations } = useConversations();
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const lastLoadTimeRef = useRef<number>(0); // Utiliser useRef pour éviter les dépendances circulaires
  const shouldScrollToBottomRef = useRef<boolean>(false); // Flag pour indiquer si on doit scroller après envoi
  const router = useRouter();

  // Hook de messagerie unifié
  const messaging = useMessaging({
    conversationId: selectedConversation?.id,
    currentUser: user || undefined,
    onNewMessage: (message: Message) => {
      // Ajouter le nouveau message à la liste - optimisé pour éviter les re-rendus
      setMessages(prev => {
        // Vérifier si le message existe déjà
        if (prev.some(m => m.id === message.id)) {
          return prev;
        }
        // Ajouter le message et maintenir l'ordre chronologique
        return [...prev, message].sort((a, b) => 
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
      });
      
      // Forcer le scroll si c'est notre propre message ou si on vient d'envoyer
      if (message.senderId === user?.id || shouldScrollToBottomRef.current) {
        shouldScrollToBottomRef.current = false; // Reset le flag
        console.log('🔽 Scroll forcé vers le bas après nouveau message WebSocket');
      }
    }
  });

  // Envoyer un message
  const handleSendMessage = useCallback(async () => {
    if (!newMessage.trim() || !selectedConversation || !user || isSending) {
      return;
    }

    setIsSending(true);
    shouldScrollToBottomRef.current = true; // Marquer qu'on vient d'envoyer un message

    try {
      console.log('📤 ConversationLayout: Envoi du message via hook unifié:', newMessage);
      
      // Utiliser le hook unifié pour envoyer le message
      const success = await messaging.sendMessage(newMessage.trim());
      
      if (success) {
        setNewMessage('');
        toast.success('Message envoyé');
        console.log('✅ ConversationLayout: Message envoyé avec succès');
      } else {
        throw new Error('Échec de l\'envoi du message');
      }
      
    } catch (error) {
      console.error('❌ ConversationLayout: Erreur lors de l\'envoi du message:', error);
      toast.error('Erreur lors de l\'envoi du message');
    } finally {
      setIsSending(false);
    }
  }, [newMessage, selectedConversation, user, isSending, messaging]);

  // Gérer la touche Entrée
  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);

  // Charger les conversations (optimisé pour éviter les boucles)
  const loadConversations = useCallback(async () => {
    if (!user) return;

    // Protection contre les requêtes trop fréquentes (debounce)
    const now = Date.now();
    if (now - lastLoadTimeRef.current < 2000) { // Minimum 2 secondes entre les appels
      console.log('⏳ Requête ignorée (trop récente)');
      return;
    }
    lastLoadTimeRef.current = now;

    try {
      setIsLoading(true);
      console.log('📥 Chargement des conversations...');
      
      const conversations = await conversationsService.getConversations();
      setConversations(conversations);
      console.log(`✅ ${conversations.length} conversations chargées`);
    } catch (error) {
      console.error('Erreur:', error);
      setConversations([]);
    } finally {
      setIsLoading(false);
    }
  }, [user, setConversations]);
  
  // Sélectionner conversation depuis URL (optimisé pour éviter les re-rendus)
  useEffect(() => {
    if (selectedConversationId && conversations.length > 0) {
      const conversation = conversations.find(c => c.id === selectedConversationId);
      if (conversation && conversation.id !== selectedConversation?.id) {
        console.log(`🔄 Changement de conversation vers ${conversation.id}`);
        setSelectedConversation(conversation);
        // Charger les messages directement sans dépendance sur loadMessages
        if (user && conversation.id) {
          conversationsService.getMessages(conversation.id)
            .then(response => {
              const newMessages = response.messages || [];
              setMessages(newMessages);
              console.log(`✅ ${newMessages.length} messages chargés pour ${conversation.id}`);
            })
            .catch(error => {
              console.error('Erreur lors du chargement des messages:', error);
              setMessages([]);
            });
        }
      } else if (!conversation && conversations.length > 0) {
        // ID de conversation non trouvé, rediriger vers /conversations
        console.log(`❌ Conversation ${selectedConversationId} non trouvée, redirection vers /conversations`);
        router.push('/conversations');
      }
    } else if (!selectedConversationId && conversations.length > 0) {
      // Pas d'ID fourni, rediriger vers /conversations
      console.log(`❌ Aucun ID de conversation fourni, redirection vers /conversations`);
      router.push('/conversations');
    }
  }, [selectedConversationId, conversations, selectedConversation?.id, user, router]);

  // Charger les conversations au montage
  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  if (isLoading) {
    return (
      <DashboardLayout title="Conversations">
        <div className="flex items-center justify-center min-h-[400px]">
          <LoadingState message="Chargement des conversations..." />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <ErrorBoundary>
      <DashboardLayout title="Conversations">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Liste des conversations */}
            <div className="lg:col-span-1">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center space-x-2">
                      <MessageSquare className="h-5 w-5" />
                      <span>Conversations</span>
                    </CardTitle>
                    <Button
                      size="sm"
                      onClick={() => setIsCreateModalOpen(true)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Nouvelle
                    </Button>
                  </div>
                  <p className="text-sm text-gray-600">
                    {conversations.length} conversation{conversations.length > 1 ? 's' : ''}
                  </p>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="max-h-[600px] overflow-y-auto">
                    {conversations.length > 0 ? (
                      <ConversationList
                        conversations={conversations}
                        selectedConversation={selectedConversation}
                        expandedGroupId={null}
                        groupConversations={{}}
                        unreadCounts={{}}
                        searchQuery=""
                        onSearchChange={() => {}}
                        onConversationClick={(conversation: Conversation) => {
                          // Éviter de naviguer si on est déjà sur cette conversation
                          if (conversation.id === selectedConversation?.id) {
                            return;
                          }
                          
                          console.log(`👆 Clic sur conversation ${conversation.id}`);
                          setSelectedConversation(conversation);
                          
                          // La gestion des join/leave est automatique via useMessaging
                          
                          // NE PAS charger les messages ici - c'est fait dans useEffect
                          
                          // Naviguer seulement si nécessaire
                          const currentPath = `/conversations/${conversation.id}`;
                          if (window.location.pathname !== currentPath) {
                            router.push(currentPath);
                          }
                        }}
                        onOpenConversation={(conversationId: string) => {
                          router.push(`/conversations/${conversationId}`);
                        }}
                        currentUser={user!}
                      />
                    ) : (
                      <div className="p-6 text-center">
                        <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500 text-sm mb-4">Aucune conversation</p>
                        <Button 
                          size="sm"
                          onClick={() => setIsCreateModalOpen(true)}
                        >
                          Créer une conversation
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Zone de conversation */}
            <div className="lg:col-span-2">
              {selectedConversation ? (
                <Card className="h-[700px] flex flex-col">
                  <CardHeader className="border-b">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          {selectedConversation.type === 'GROUP' ? (
                            <Users className="h-5 w-5 text-blue-600" />
                          ) : (
                            <MessageSquare className="h-5 w-5 text-blue-600" />
                          )}
                        </div>
                        <div>
                          <h3 className="font-semibold">{selectedConversation.name}</h3>
                          <p className="text-sm text-gray-500">
                            {selectedConversation.type === 'GROUP' ? 'Groupe' : 'Conversation privée'}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="lg:hidden"
                        onClick={() => setSelectedConversation(null)}
                      >
                        ← Retour
                      </Button>
                    </div>
                  </CardHeader>
                  <div className="flex-1 overflow-hidden">
                    <ConversationView 
                      conversation={selectedConversation}
                      messages={messages}
                      newMessage={newMessage}
                      onNewMessageChange={setNewMessage}
                      onSendMessage={handleSendMessage}
                      onKeyPress={handleKeyPress}
                      currentUser={user!}
                      typingUsers={[]}
                      onNewMessage={(message: Message) => {
                        // Callback appelé quand un nouveau message est détecté
                        // Forcer le scroll si c'est notre propre message ou si on vient d'envoyer
                        if (message.senderId === user?.id || shouldScrollToBottomRef.current) {
                          shouldScrollToBottomRef.current = false; // Reset le flag
                          console.log('🔽 Scroll forcé vers le bas après nouveau message');
                        }
                      }}
                    />
                  </div>
                </Card>
              ) : (
                <Card className="h-[700px]">
                  <CardContent className="flex items-center justify-center h-full">
                    <div className="text-center text-gray-500">
                      <MessageSquare className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                      <h3 className="text-lg font-medium mb-2">Sélectionnez une conversation</h3>
                      <p className="mb-4">Choisissez une conversation dans la liste pour commencer à discuter</p>
                      <Button onClick={() => setIsCreateModalOpen(true)}>
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

        {/* Modal de création */}
        <CreateConversationModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          currentUser={user!}
          onConversationCreated={(conversationId: string) => {
            // Recharger les conversations pour inclure la nouvelle
            loadConversations();
            // Fermer le modal
            setIsCreateModalOpen(false);
            // Rediriger vers la nouvelle conversation
            router.push(`/conversations/${conversationId}`);
          }}
        />
      </DashboardLayout>
    </ErrorBoundary>
  );
}
