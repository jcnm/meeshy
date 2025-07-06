'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useConversations } from '@/context/AppContext';
import { useWebSocket } from '@/hooks/use-websocket';
import { buildApiUrl } from '@/lib/config';
import { Conversation, Message } from '@/types';
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
    emit
  } = useWebSocket();

  // Charger les conversations
  const loadConversations = useCallback(async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      const token = localStorage.getItem('auth_token');
      const response = await fetch(buildApiUrl('/conversations'), {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setConversations(data.conversations || []);
      } else {
        console.error('Erreur lors du chargement des conversations');
        setConversations([]);
      }
    } catch (error) {
      console.error('Erreur:', error);
      setConversations([]);
    } finally {
      setIsLoading(false);
    }
  }, [user, setConversations]);

  // Gestionnaire WebSocket pour les nouveaux messages
  useEffect(() => {
    if (!isConnected) return;

    const handleNewMessage = (data: unknown) => {
      // Validation du type de données reçues
      if (data && typeof data === 'object' && 'id' in data && 'conversationId' in data) {
        const message = data as Message;
        const conversation = conversations.find(c => c.id === message.conversationId);
        if (conversation) {
          updateConversation({ 
            ...conversation,
            lastMessage: message,
            updatedAt: new Date() 
          });
        }
      }
    };

    on('message', handleNewMessage);
    return () => off('message');
  }, [isConnected, on, off, updateConversation, conversations]);

  // Charger les conversations au montage
  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Sélectionner conversation depuis URL
  useEffect(() => {
    if (selectedConversationId && conversations.length > 0) {
      const conversation = conversations.find(c => c.id === selectedConversationId);
      if (conversation && conversation.id !== selectedConversation?.id) {
        setSelectedConversation(conversation);
        emit('join-conversation', conversation.id);
      }
    }
  }, [selectedConversationId, conversations, selectedConversation?.id, emit]);

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
                          setSelectedConversation(conversation);
                          if (selectedConversation?.id) {
                            emit('leave-conversation', selectedConversation.id);
                          }
                          emit('join-conversation', conversation.id);
                          router.push(`/conversations/${conversation.id}`);
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
                      messages={[]}
                      newMessage=""
                      onNewMessageChange={() => {}}
                      onSendMessage={() => {}}
                      onKeyPress={() => {}}
                      currentUser={user!}
                      isConnected={isConnected}
                      typingUsers={[]}
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
