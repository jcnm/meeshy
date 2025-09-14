'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { 
  MessageSquare, 
  Send,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { useSocketIOMessaging } from '@/hooks/use-socketio-messaging';
import { useTranslations } from '@/hooks/useTranslations';
import type { User, Message } from '@shared/types';

export interface BubbleStreamPageSimpleProps {
  user: User;
  conversationId?: string;
  isAnonymousMode?: boolean;
  linkId?: string;
  initialParticipants?: any[];
}

export function BubbleStreamPageSimple({ 
  user, 
  conversationId = 'meeshy', 
  isAnonymousMode = false, 
  linkId,
  initialParticipants 
}: BubbleStreamPageSimpleProps) {
  const { t } = useTranslations('bubbleStream');
  const router = useRouter();
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // États principaux
  const [newMessage, setNewMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);

  // Hook de messagerie WebSocket simplifié
  const {
    sendMessage
  } = useSocketIOMessaging({
    conversationId,
    currentUser: user,
    onNewMessage: (message: Message) => {
      setMessages(prev => [...prev, message]);
      scrollToBottom();
    }
  });

  // États de connexion simplifiés
  const [isConnected, setIsConnected] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Fonction pour scroller vers le bas
  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
      }
    }, 100);
  }, []);

  // Envoyer un message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newMessage.trim() || !isConnected) {
      return;
    }

    const messageContent = newMessage.trim();
    setNewMessage('');

    try {
      await sendMessage(messageContent, user.systemLanguage || 'fr');
    } catch (error) {
      console.error('Erreur lors de l\'envoi du message:', error);
      // Restaurer le message en cas d'erreur
      setNewMessage(messageContent);
    }
  };

  // Scroll automatique lors de nouveaux messages
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  return (
    <div className="h-screen max-h-screen flex flex-col bg-gradient-to-br from-blue-50 to-purple-50">
      {/* Header */}
      <div className="bg-white/90 backdrop-blur-sm border-b p-4">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold text-primary">Meeshy</h1>
          </div>
          
          <div className="flex-1" />
          
          {/* Indicateur de connexion */}
          <div className="flex items-center gap-2">
            <div className={cn(
              "w-2 h-2 rounded-full",
              isConnected ? "bg-green-500" : "bg-red-500"
            )} />
            <span className="text-sm text-muted-foreground">
              {isConnected ? t('connected') : t('disconnected')}
            </span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div 
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-4"
      >
        <div className="max-w-4xl mx-auto">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <MessageSquare className="h-16 w-16 text-muted-foreground/50 mb-4 mx-auto" />
                <h3 className="text-lg font-semibold mb-2">{t('noMessages')}</h3>
                <p className="text-muted-foreground">{t('startConversation')}</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex",
                    message.senderId === user?.id ? "justify-end" : "justify-start"
                  )}
                >
                  <div className="flex items-start gap-2 max-w-xs lg:max-w-md">
                    {message.senderId !== user?.id && (
                      <Avatar className="h-8 w-8 flex-shrink-0">
                        <AvatarFallback className="bg-primary/20 text-primary text-xs">
                          {message.sender?.firstName?.charAt(0) || 'U'}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    
                    <div
                      className={cn(
                        "px-4 py-2 rounded-2xl shadow-sm",
                        message.senderId === user?.id
                          ? "bg-primary text-primary-foreground rounded-br-md"
                          : "bg-white border rounded-bl-md"
                      )}
                    >
                      {message.senderId !== user?.id && (
                        <div className="text-xs font-medium mb-1 opacity-70">
                          {message.sender?.username || 'Utilisateur'}
                        </div>
                      )}
                      
                      <p className="text-sm break-words">{message.content}</p>
                      
                      <div className={cn(
                        "text-xs mt-1",
                        message.senderId === user?.id ? "opacity-70" : "text-muted-foreground"
                      )}>
                        {new Date(message.createdAt).toLocaleTimeString('fr-FR', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    </div>
                    
                    {message.senderId === user?.id && (
                      <Avatar className="h-8 w-8 flex-shrink-0">
                        <AvatarFallback className="bg-primary/20 text-primary text-xs">
                          {user.firstName?.charAt(0) || 'M'}
                        </AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Zone de saisie */}
      <div className="bg-white/90 backdrop-blur-sm border-t p-4">
        <div className="max-w-4xl mx-auto">
          {connectionError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <p className="text-red-800 text-sm">{connectionError}</p>
            </div>
          )}
          
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <Input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={t('typeMessage')}
              disabled={!isConnected}
              className="flex-1 rounded-full"
            />
            <Button 
              type="submit" 
              disabled={!newMessage.trim() || !isConnected}
              className="rounded-full px-6"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}