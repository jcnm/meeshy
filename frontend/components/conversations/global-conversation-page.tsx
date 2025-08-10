'use client';

import { useState, useEffect, useRef } from 'react';
import { useUser } from '@/context/AppContext';
import { useSocketIOMessaging } from '@/hooks/use-socketio-messaging';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  MessageSquare,
  Send,
  Users,
  Globe,
  Languages,
  ArrowUp,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { Message, TranslatedMessage } from '@/types';
import { conversationsService } from '@/services/conversations.service';
import { MessageBubble } from '@/components/conversations/message-bubble';
import { TypingIndicator } from '@/components/conversations/typing-indicator';
import { translationService } from '@/services/translation.service';
import { socketIOUserToUser, createDefaultUser } from '@/utils/user-adapter';
import { cn } from '@/lib/utils';

interface GlobalConversationPageProps {
  user: any;
}

export function GlobalConversationPage({ user }: GlobalConversationPageProps) {
  // États
  const [messages, setMessages] = useState<TranslatedMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [onlineUsers, setOnlineUsers] = useState<number>(0);
  
  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Services
  const { 
    connectionStatus, 
    sendMessage: sendWsMessage,
    startTyping,
    stopTyping,
    reconnect
  } = useSocketIOMessaging();

  // Charger les messages initiaux
  useEffect(() => {
    loadInitialMessages();
  }, []);

  // Auto-scroll vers le bas quand de nouveaux messages arrivent
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Connexion WebSocket
  useEffect(() => {
    if (!connectionStatus.isConnected) {
      reconnect();
    }
  }, [connectionStatus.isConnected, reconnect]);

  // Gestion de la frappe
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    if (newMessage.trim()) {
      startTyping();
      timeoutId = setTimeout(() => {
        stopTyping();
      }, 3000);
    } else {
      stopTyping();
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [newMessage, startTyping, stopTyping]);

  const loadInitialMessages = async () => {
    try {
      setIsLoading(true);
      const response = await conversationsService.getMessages('any');
      
      if (response.messages) {
        const translatedMessages = await Promise.all(
          response.messages.map(async (msg: Message) => {
            const translatedMsg: TranslatedMessage = {
              ...msg,
              sender: msg.sender ? socketIOUserToUser(msg.sender) : createDefaultUser(msg.senderId),
              isTranslated: false,
              isTranslating: false,
              showingOriginal: true,
              translations: []
            };
            
            // Auto-traduire si nécessaire
            if (msg.originalLanguage !== user.systemLanguage && user.autoTranslateEnabled) {
              await translateMessage(translatedMsg);
            }
            
            return translatedMsg;
          })
        );
        
        setMessages(translatedMessages);
        setHasMoreMessages(response.hasMore || false);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des messages:', error);
      toast.error('Erreur lors du chargement des messages');
    } finally {
      setIsLoading(false);
    }
  };

  const loadMoreMessages = async () => {
    if (!hasMoreMessages || isLoadingMore || messages.length === 0) return;
    
    try {
      setIsLoadingMore(true);
      const oldestMessage = messages[0];
      const response = await conversationsService.getMessages('any', 1, 20); // Utiliser page et limit au lieu de before
      
      if (response.messages) {
        const translatedMessages = await Promise.all(
          response.messages.map(async (msg: Message) => {
            const translatedMsg: TranslatedMessage = {
              ...msg,
              sender: msg.sender ? socketIOUserToUser(msg.sender) : createDefaultUser(msg.senderId),
              isTranslated: false,
              isTranslating: false,
              showingOriginal: true,
              translations: []
            };
            
            // Auto-traduire si nécessaire
            if (msg.originalLanguage !== user.systemLanguage && user.autoTranslateEnabled) {
              await translateMessage(translatedMsg);
            }
            
            return translatedMsg;
          })
        );
        
        setMessages(prev => [...translatedMessages, ...prev]);
        setHasMoreMessages(response.hasMore || false);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des messages précédents:', error);
      toast.error('Erreur lors du chargement des messages précédents');
    } finally {
      setIsLoadingMore(false);
    }
  };

  const translateMessage = async (message: TranslatedMessage) => {
    if (!user.autoTranslateEnabled || message.originalLanguage === user.systemLanguage) {
      return;
    }

    try {
      // Marquer comme en cours de traduction
      setMessages(prev => prev.map(msg => 
        msg.id === message.id 
          ? { ...msg, isTranslating: true }
          : msg
      ));

      const response = await translationService.translateText({
        text: message.content,
        sourceLanguage: message.originalLanguage,
        targetLanguage: user.systemLanguage
      });

      if (response.translatedText) {
        setMessages(prev => prev.map(msg => 
          msg.id === message.id 
            ? { 
                ...msg, 
                isTranslating: false,
                isTranslated: true,
                translatedContent: response.translatedText,
                showingOriginal: false,
                translations: [{
                  language: user.systemLanguage,
                  content: response.translatedText,
                  flag: '🌍',
                  createdAt: new Date()
                }] as any
              }
            : msg
        ));
      }
    } catch (error) {
      console.error('Erreur lors de la traduction:', error);
      setMessages(prev => prev.map(msg => 
        msg.id === message.id 
          ? { 
              ...msg, 
              isTranslating: false,
              translationFailed: true,
              translationError: 'Erreur de traduction'
            }
          : msg
      ));
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || isSending) return;

    const messageContent = newMessage.trim();
    setNewMessage('');
    setIsSending(true);
    stopTyping();

    try {
      const response = await conversationsService.sendMessage('any', {
        content: messageContent,
        originalLanguage: user.systemLanguage || 'fr'
      });

      if (response) {
        const newMsg: TranslatedMessage = {
          ...response,
          sender: response.sender ? socketIOUserToUser(response.sender) : createDefaultUser(response.senderId),
          isTranslated: false,
          isTranslating: false,
          showingOriginal: true,
          translations: []
        };

        setMessages(prev => [...prev, newMsg]);
        
        // Envoyer via WebSocket pour notification temps réel
        if (connectionStatus.isConnected) {
          sendWsMessage(messageContent);
        }
        
        toast.success('Message envoyé');
      } else {
        toast.error('Erreur lors de l\'envoi du message');
        setNewMessage(messageContent); // Restaurer le message en cas d'erreur
      }
    } catch (error) {
      console.error('Erreur lors de l\'envoi du message:', error);
      toast.error('Erreur lors de l\'envoi du message');
      setNewMessage(messageContent); // Restaurer le message en cas d'erreur
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const isNearTop = scrollTop < 100;
    
    if (isNearTop && hasMoreMessages && !isLoadingMore) {
      loadMoreMessages();
    }
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200">
          <div className="flex items-center space-x-4">
            <div className="relative">
              <Avatar className="h-12 w-12 ring-2 ring-blue-500/20">
                <AvatarImage src="/meeshy-logo.png" alt="Meeshy" />
                <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold text-lg">
                  M
                </AvatarFallback>
              </Avatar>
              <div className="absolute -bottom-1 -right-1 h-4 w-4 bg-green-500 rounded-full border-2 border-white" />
            </div>
            
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center space-x-2">
                <Globe className="h-6 w-6 text-blue-600" />
                <span>Meeshy</span>
              </h1>
              <p className="text-sm text-gray-600 flex items-center space-x-1">
                <MessageSquare className="h-4 w-4" />
                <span>Conversation globale</span>
                <span>•</span>
                <Languages className="h-4 w-4" />
                <span>Traduction automatique</span>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <Badge variant="secondary" className="flex items-center space-x-1">
              <Users className="h-4 w-4" />
              <span>{onlineUsers} en ligne</span>
            </Badge>
            
            <div className={cn(
              "flex items-center space-x-1 text-sm",
              connectionStatus.isConnected ? "text-green-600" : "text-red-600"
            )}>
              <div className={cn(
                "h-2 w-2 rounded-full",
                connectionStatus.isConnected ? "bg-green-500" : "bg-red-500"
              )} />
              <span>{connectionStatus.isConnected ? "Connecté" : "Déconnecté"}</span>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
                <p className="text-gray-600">Chargement des messages...</p>
              </div>
            </div>
          ) : (
            <ScrollArea 
              className="flex-1 p-4" 
              ref={scrollAreaRef}
              onScrollCapture={handleScroll}
            >
              {/* Bouton charger plus de messages */}
              {hasMoreMessages && (
                <div className="text-center mb-4">
                  <Button
                    variant="ghost"
                    onClick={loadMoreMessages}
                    disabled={isLoadingMore}
                    className="text-sm"
                  >
                    {isLoadingMore ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Chargement...
                      </>
                    ) : (
                      <>
                        <ArrowUp className="h-4 w-4 mr-2" />
                        Charger les messages précédents
                      </>
                    )}
                  </Button>
                </div>
              )}

              {/* Messages */}
              <div className="space-y-4">
                {messages.map((message) => (
                  <div key={message.id} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-2 mb-2">
                      <strong className="text-sm text-gray-900">
                        {message.sender?.displayName || message.sender?.username || 'Anonyme'}
                      </strong>
                      <span className="text-xs text-gray-500">
                        {new Date(message.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-gray-700">
                      {message.translatedContent || message.content}
                    </p>
                  </div>
                ))}
              </div>
              
              {/* Indicateur de frappe */}
              <div className="text-sm text-gray-500 italic">
                {/* TODO: Implémenter TypingIndicator */}
              </div>
              
              <div ref={messagesEndRef} />
            </ScrollArea>
          )}
        </div>

        {/* Zone de saisie */}
        <div className="border-t border-gray-200 p-4 bg-gray-50/50">
          <div className="flex items-end space-x-3">
            <div className="flex-1">
              <Input
                ref={inputRef}
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Tapez votre message..."
                disabled={isSending || !connectionStatus.isConnected}
                className="resize-none border-gray-300 focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            
            <Button
              onClick={handleSendMessage}
              disabled={!newMessage.trim() || isSending || !connectionStatus.isConnected}
              className="px-6 bg-blue-600 hover:bg-blue-700 focus:ring-blue-500"
            >
              {isSending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          
          {!connectionStatus.isConnected && (
            <p className="text-sm text-amber-600 mt-2 flex items-center space-x-1">
              <span>⚠️</span>
              <span>Connexion perdue. Tentative de reconnexion...</span>
            </p>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
