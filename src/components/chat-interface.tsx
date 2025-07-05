'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Send, 
  Languages, 
  Users, 
  Settings,
  Loader2
} from 'lucide-react';
import { User, Message } from '@/types';
import { UserSettingsModal } from './user-settings-modal';
import { TypingIndicator } from './typing-indicator';
import { useTypingIndicator } from '@/hooks/use-typing-indicator';
import { ModelManager } from './model-manager';
import { MessageBubble } from './message-bubble';
import { useTranslation } from '@/hooks/use-translation';
import { detectLanguage } from '@/utils/translation';

const SUPPORTED_LANGUAGES = [
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
];

interface ChatInterfaceProps {
  currentUser: User;
  onlineUsers: User[];
  messages: Message[];
  onSendMessage: (recipientId: string, content: string, originalLanguage: string) => Promise<void>;
  onLogout: () => void;
}

export function ChatInterface({
  currentUser,
  onlineUsers,
  messages,
  onSendMessage,
  onLogout,
}: ChatInterfaceProps) {
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [messageContent, setMessageContent] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { startTyping, stopTyping } = useTypingIndicator();
  
  // Nouveau système de traduction
  const {
    addMessage,
    toggleMessageTranslation,
    retranslateMessage,
    getDisplayedMessage,
  } = useTranslation(currentUser);

  // Traiter les nouveaux messages
  useEffect(() => {
    messages.forEach(message => {
      addMessage(message);
    });
  }, [messages, addMessage]);

  // Auto-scroll vers le bas quand de nouveaux messages arrivent
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Gestion des indicateurs de frappe
  const handleInputChange = (value: string) => {
    setMessageContent(value);
    
    if (selectedUser && value.trim()) {
      startTyping(`${currentUser.id}-${selectedUser.id}`);
    } else if (selectedUser) {
      stopTyping(`${currentUser.id}-${selectedUser.id}`);
    }
  };

  const handleInputBlur = () => {
    if (selectedUser) {
      stopTyping(`${currentUser.id}-${selectedUser.id}`);
    }
  };

  const getLanguageFlag = (languageCode: string): string => {
    const language = SUPPORTED_LANGUAGES.find(lang => lang.code === languageCode);
    return language?.flag || '🌐';
  };

  const getLanguageName = (languageCode: string): string => {
    const language = SUPPORTED_LANGUAGES.find(lang => lang.code === languageCode);
    return language?.name || languageCode;
  };

  const handleSendMessage = async () => {
    if (!messageContent.trim() || !selectedUser || isSending) return;

    setIsSending(true);
    try {
      // Détecter automatiquement la langue du message
      const detectedLanguage = detectLanguage(messageContent);
      
      await onSendMessage(selectedUser.id, messageContent, detectedLanguage);
      setMessageContent('');
      
      // Arrêter l'indicateur de frappe après envoi
      if (selectedUser) {
        stopTyping(`${currentUser.id}-${selectedUser.id}`);
      }
    } catch (error) {
      console.error('Erreur lors de l\'envoi du message:', error);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Filtrer les messages pour la conversation actuelle
  const filteredMessages = selectedUser 
    ? messages.filter(message => 
        (message.senderId === currentUser.id && message.recipientId === selectedUser.id) ||
        (message.senderId === selectedUser.id && message.recipientId === currentUser.id)
      )
    : [];

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div className="w-80 border-r border-border bg-card">
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar>
                <AvatarFallback>
                  {currentUser.username.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <h2 className="font-semibold">{currentUser.username}</h2>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  {getLanguageFlag(currentUser.systemLanguage)}
                  {getLanguageName(currentUser.systemLanguage)}
                </p>
              </div>
            </div>
            
            <div className="flex gap-1">
              <UserSettingsModal 
                user={currentUser} 
                onUserUpdate={(updatedUser) => {
                  // Callback pour mettre à jour les paramètres utilisateur
                  console.log('Paramètres mis à jour:', updatedUser);
                  // TODO: Implémenter la mise à jour via WebSocket
                }}
              >
                <Button size="sm" variant="ghost">
                  <Settings className="h-4 w-4" />
                </Button>
              </UserSettingsModal>
              <Button size="sm" variant="ghost" onClick={onLogout}>
                Déconnexion
              </Button>
            </div>
          </div>
        </div>

        <Tabs defaultValue="users" className="flex-1">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="users">
              <Users className="h-4 w-4 mr-2" />
              Utilisateurs
            </TabsTrigger>
            <TabsTrigger value="translation">
              <Languages className="h-4 w-4 mr-2" />
              Traduction
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="users" className="mt-0">
            <ScrollArea className="h-[calc(100vh-200px)]">
              <div className="p-4 space-y-2">
                {onlineUsers
                  .filter(user => user.id !== currentUser.id)
                  .map(user => (
                    <Card 
                      key={user.id} 
                      className={`cursor-pointer transition-colors hover:bg-accent ${
                        selectedUser?.id === user.id ? 'bg-accent' : ''
                      }`}
                      onClick={() => setSelectedUser(user)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs">
                              {user.username.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <p className="font-medium text-sm">{user.username}</p>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              {getLanguageFlag(user.systemLanguage)}
                              {getLanguageName(user.systemLanguage)}
                            </div>
                          </div>
                          <Badge 
                            variant={user.isOnline ? "default" : "secondary"}
                            className={user.isOnline ? "bg-green-500" : ""}
                          >
                            {user.isOnline ? "En ligne" : "Hors ligne"}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                }
              </div>
            </ScrollArea>
          </TabsContent>
          
          <TabsContent value="translation" className="mt-0 p-4">
            <ModelManager />
          </TabsContent>
        </Tabs>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedUser ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-border bg-card">
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarFallback>
                    {selectedUser.username.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-semibold">{selectedUser.username}</h3>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    {getLanguageFlag(selectedUser.systemLanguage)}
                    {getLanguageName(selectedUser.systemLanguage)}
                    {selectedUser.isOnline && (
                      <Badge variant="default" className="bg-green-500 ml-2">
                        En ligne
                      </Badge>
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              {filteredMessages.map(message => {
                const displayedMessage = getDisplayedMessage(message.id);
                const senderName = onlineUsers.find(u => u.id === message.senderId)?.username || 'Inconnu';
                
                return displayedMessage ? (
                  <MessageBubble
                    key={message.id}
                    message={displayedMessage}
                    isOwn={message.senderId === currentUser.id}
                    senderName={senderName}
                    onToggleTranslation={toggleMessageTranslation}
                    onRetranslate={retranslateMessage}
                    isTranslationAvailable={currentUser.autoTranslateEnabled || false}
                  />
                ) : null;
              })}
              <div ref={messagesEndRef} />
            </ScrollArea>

            {/* Indicateurs de frappe */}
            <TypingIndicator 
              chatId={`${currentUser.id}-${selectedUser.id}`}
              currentUserId={currentUser.id}
              users={onlineUsers}
              className="px-4 py-2 border-t border-border"
            />

            {/* Message Input */}
            <div className="p-4 border-t border-border bg-card">
              <div className="flex gap-2">
                <Input
                  value={messageContent}
                  onChange={(e) => handleInputChange(e.target.value)}
                  onKeyPress={handleKeyPress}
                  onBlur={handleInputBlur}
                  placeholder="Tapez votre message..."
                  disabled={isSending}
                  className="flex-1"
                />
                <Button 
                  onClick={handleSendMessage} 
                  disabled={!messageContent.trim() || isSending}
                  size="icon"
                >
                  {isSending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">Sélectionnez un utilisateur</p>
              <p className="text-sm">Choisissez quelqu&apos;un dans la liste pour commencer à discuter</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
