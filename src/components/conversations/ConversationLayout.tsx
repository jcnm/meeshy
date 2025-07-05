'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useConversations } from '@/context/AppContext';
import { useOptimizedWebSocket } from '@/hooks/optimized';
import { buildApiUrl, API_ENDPOINTS } from '@/lib/config';
import { Conversation, Message } from '@/types';
import { 
  ResponsiveLayout, 
  PageHeader, 
  PageContent 
} from '@/components/layout';
import {
  Button,
  Card,
  CardContent,
  LoadingState,
  ErrorBoundary
} from '@/components/common';
import { ConversationList, ConversationView, CreateConversationModal } from './index';
import { Plus, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';

interface ConversationLayoutProps {
  selectedConversationId?: string;
}

export function ConversationLayout({ selectedConversationId }: ConversationLayoutProps) {
  const { user } = useUser();
  const { conversations, setConversations, addConversation, updateConversation } = useConversations();
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // WebSocket pour les mises à jour temps réel
  const { 
    isConnected, 
    on, 
    off, 
    joinConversation, 
    leaveConversation 
  } = useOptimizedWebSocket();

  // Charger les conversations
  const loadConversations = useCallback(async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      const token = localStorage.getItem('token');
      
      const response = await fetch(buildApiUrl(API_ENDPOINTS.CONVERSATION.LIST), {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setConversations(Array.isArray(data) ? data : []);
      } else {
        throw new Error('Erreur lors du chargement des conversations');
      }
    } catch (error) {
      console.error('Erreur chargement conversations:', error);
      toast.error('Impossible de charger les conversations');
    } finally {
      setIsLoading(false);
    }
  }, [user, setConversations]);

  // Sélectionner une conversation
  const handleSelectConversation = useCallback((conversation: Conversation) => {
    // Quitter l'ancienne conversation
    if (selectedConversation) {
      leaveConversation(selectedConversation.id);
    }

    // Rejoindre la nouvelle conversation
    setSelectedConversation(conversation);
    joinConversation(conversation.id);
    
    // Mettre à jour l'URL
    router.push(`/conversations/${conversation.id}`);
  }, [selectedConversation, leaveConversation, joinConversation, router]);

  // Créer une nouvelle conversation
  const handleCreateConversation = useCallback((newConversation: Conversation) => {
    addConversation(newConversation);
    setIsCreateModalOpen(false);
    handleSelectConversation(newConversation);
    toast.success('Conversation créée avec succès !');
  }, [addConversation, handleSelectConversation]);

  // Gérer les messages en temps réel
  useEffect(() => {
    if (!isConnected) return;

    const handleNewMessage = (data: unknown) => {
      const messageData = data as { conversationId: string; message: Message };
      const conversation = conversations.find(c => c.id === messageData.conversationId);
      if (conversation) {
        const updatedConversation = {
          ...conversation,
          messages: [...(conversation.messages || []), messageData.message],
          lastMessageAt: new Date(),
        };
        updateConversation(updatedConversation);
      }
    };

    const handleConversationUpdate = (data: unknown) => {
      const updateData = data as { conversation: Conversation };
      updateConversation(updateData.conversation);
    };

    on('new-message', handleNewMessage);
    on('conversation-updated', handleConversationUpdate);

    return () => {
      off('new-message');
      off('conversation-updated');
    };
  }, [isConnected, conversations, updateConversation, on, off]);

  // Charger les données initiales
  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Sélectionner la conversation depuis l'URL
  useEffect(() => {
    if (selectedConversationId && conversations.length > 0) {
      const conversation = conversations.find(c => c.id === selectedConversationId);
      if (conversation && conversation.id !== selectedConversation?.id) {
        setSelectedConversation(conversation);
        joinConversation(conversation.id);
      }
    }
  }, [selectedConversationId, conversations, selectedConversation?.id, joinConversation]);

  if (isLoading) {
    return (
      <ResponsiveLayout>
        <LoadingState 
          message="Chargement des conversations..." 
          fullScreen 
        />
      </ResponsiveLayout>
    );
  }

  return (
    <ErrorBoundary>
      <ResponsiveLayout>
        <div className="flex h-full">
          {/* Liste des conversations */}
          <div className="w-80 border-r border-border flex flex-col">
            <PageHeader
              title="Conversations"
              description={`${conversations.length} conversation${conversations.length > 1 ? 's' : ''}`}
              actions={
                <Button
                  size="sm"
                  onClick={() => setIsCreateModalOpen(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Nouvelle
                </Button>
              }
            />
            
            <div className="flex-1 overflow-y-auto">
              {conversations.length > 0 ? (
                <ConversationList
                  conversations={conversations}
                  selectedConversation={selectedConversation}
                  expandedGroupId={null}
                  groupConversations={{}}
                  unreadCounts={{}}
                  searchQuery=""
                  onSearchChange={() => {}}
                  onConversationClick={handleSelectConversation}
                  onOpenConversation={(id: string) => handleSelectConversation(conversations.find(c => c.id === id)!)}
                  currentUser={user!}
                />
              ) : (
                <PageContent>
                  <Card>
                    <CardContent className="text-center py-8">
                      <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                      <h3 className="text-lg font-medium mb-2">
                        Aucune conversation
                      </h3>
                      <p className="text-muted-foreground mb-4">
                        Créez votre première conversation pour commencer à discuter
                      </p>
                      <Button onClick={() => setIsCreateModalOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Créer une conversation
                      </Button>
                    </CardContent>
                  </Card>
                </PageContent>
              )}
            </div>
          </div>

          {/* Vue de conversation */}
          <div className="flex-1">
            {selectedConversation && user ? (
              <ConversationView
                conversation={selectedConversation}
                messages={selectedConversation.messages || []}
                newMessage=""
                onNewMessageChange={() => {}}
                onSendMessage={() => {}}
                onKeyPress={() => {}}
                currentUser={user}
                isConnected={true}
                typingUsers={[]}
              />
            ) : (
              <PageContent>
                <Card className="h-full">
                  <CardContent className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <MessageSquare className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                      <h3 className="text-xl font-medium mb-2">
                        Sélectionnez une conversation
                      </h3>
                      <p className="text-muted-foreground">
                        Choisissez une conversation dans la liste pour commencer à discuter
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </PageContent>
            )}
          </div>
        </div>

        {/* Modal de création */}
        {user && (
          <CreateConversationModal
            isOpen={isCreateModalOpen}
            onClose={() => setIsCreateModalOpen(false)}
            onConversationCreated={(conversationId: string) => {
              setIsCreateModalOpen(false);
              // TODO: Navigate to new conversation
            }}
            currentUser={user}
          />
        )}
      </ResponsiveLayout>
    </ErrorBoundary>
  );
}
