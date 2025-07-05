'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              {filteredMessages.map(message => (
                <MessageBubble key={message.id} message={message} />
              ))}
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
                  placeholder="Tapez votre message..."TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Send, 
  Languages, 
  RotateCcw, 
  Settings, 
  Users,
  Loader2,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { Message, User, SUPPORTED_LANGUAGES } from '@/types';
import { UserSettingsModal } from './user-settings-modal';
import { TypingIndicator } from './typing-indicator';
import { useTypingIndicator } from '@/hooks/use-typing-indicator';
import { ModelsStatus } from './models-status';

interface TranslatedMessage extends Message {
  translatedContent?: string;
  isTranslated?: boolean;
  isTranslating?: boolean;
  translationError?: string;
}

interface ChatInterfaceProps {
  currentUser: User;
  onlineUsers: User[];
  messages: Message[];
  onSendMessage: (recipientId: string, content: string, originalLanguage: string) => Promise<void>;
  onToggleTranslation: (messageId: string) => void;
  onRetranslateMessage: (messageId: string) => void;
  getMessageContent: (messageId: string) => string;
  getDisplayedMessage: (messageId: string) => TranslatedMessage | undefined;
  isTranslationAvailable: boolean;
  onLogout: () => void;
}

export function ChatInterface({
  currentUser,
  onlineUsers,
  messages,
  onSendMessage,
  onToggleTranslation,
  onRetranslateMessage,
  getMessageContent,
  getDisplayedMessage,
  isTranslationAvailable,
  onLogout,
}: ChatInterfaceProps) {
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [messageContent, setMessageContent] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { startTyping, stopTyping } = useTypingIndicator();

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
      await onSendMessage(selectedUser.id, messageContent, currentUser.systemLanguage);
      setMessageContent('');
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

  const filteredMessages = selectedUser 
    ? messages.filter(msg => 
        (msg.senderId === currentUser.id && msg.recipientId === selectedUser.id) ||
        (msg.senderId === selectedUser.id && msg.recipientId === currentUser.id)
      )
    : [];

  const MessageBubble = ({ message }: { message: Message }) => {
    const isOwn = message.senderId === currentUser.id;
    const displayedMessage = getDisplayedMessage(message.id);
    const content = getMessageContent(message.id);

    return (
      <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-4`}>
        <div className={`max-w-xs lg:max-w-md ${isOwn ? 'order-2' : 'order-1'}`}>
          <div className={`rounded-lg px-4 py-2 ${
            isOwn 
              ? 'bg-primary text-primary-foreground' 
              : 'bg-muted text-muted-foreground'
          }`}>
            <div className="flex items-start gap-2">
              <div className="flex-1">
                <p className="text-sm">{content}</p>
                
                {/* Indicateurs de traduction */}
                {displayedMessage && (
                  <div className="flex items-center gap-2 mt-2">
                    {displayedMessage.isTranslating && (
                      <div className="flex items-center gap-1 text-xs">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span>Traduction...</span>
                      </div>
                    )}
                    
                    {displayedMessage.translationError && (
                      <div className="flex items-center gap-1 text-xs text-red-500">
                        <AlertCircle className="h-3 w-3" />
                        <span>Erreur</span>
                      </div>
                    )}
                    
                    {displayedMessage.translatedContent && !displayedMessage.isTranslating && (
                      <div className="flex items-center gap-1 text-xs">
                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                        <span>Traduit</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              {/* Actions de traduction */}
              {!isOwn && isTranslationAvailable && (
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onToggleTranslation(message.id)}
                    className="h-6 w-6 p-0"
                  >
                    <Languages className="h-3 w-3" />
                  </Button>
                  
                  {displayedMessage?.translationError && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onRetranslateMessage(message.id)}
                      className="h-6 w-6 p-0"
                    >
                      <RotateCcw className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              )}
            </div>
            
            <div className="text-xs opacity-70 mt-1">
              {new Date(message.timestamp).toLocaleTimeString()}
            </div>
          </div>
        </div>
      </div>
    );
  };

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
            <ScrollArea className="h-[calc(100vh-8rem)]">
              <div className="p-4 space-y-2">
                {onlineUsers
                  .filter(user => user.id !== currentUser.id)
                  .map(user => (
                    <Card
                      key={user.id}
                      className={`cursor-pointer transition-colors ${
                        selectedUser?.id === user.id 
                          ? 'bg-primary/10 border-primary' 
                          : 'hover:bg-muted/50'
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
            <ModelsStatus />
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
                <Avatar>
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
              {filteredMessages.map(message => (
                <MessageBubble key={message.id} message={message} />
              ))}
              <div ref={messagesEndRef} />
            </ScrollArea>

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
