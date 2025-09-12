/**
 * Composant de vue de conversation avec optimisations responsive
 * Affiche les détails d'une conversation et permet l'interaction
 */

import React, { useState } from 'react';
import { 
  Users, 
  Settings, 
  Share, 
  MoreHorizontal, 
  MessageSquare, 
  Phone, 
  Video,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Send,
  Paperclip,
  Smile
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Message {
  id: string;
  content: string;
  sender: {
    id: string;
    name: string;
    avatar?: string;
  };
  timestamp: string;
  isOwn: boolean;
  translations?: Array<{
    language: string;
    content: string;
  }>;
}

interface Participant {
  id: string;
  name: string;
  avatar?: string;
  role: 'admin' | 'moderator' | 'member';
  isOnline: boolean;
  lastSeen?: string;
}

interface ConversationViewProps {
  conversation: {
    id: string;
    title: string;
    description?: string;
    type: 'public' | 'private' | 'group';
    memberCount: number;
    participants: Participant[];
  };
  messages: Message[];
  currentUser: {
    id: string;
    name: string;
    avatar?: string;
  };
  onSendMessage: (content: string) => void;
  onJoinCall?: () => void;
  onLeaveConversation?: () => void;
  className?: string;
}

export function ConversationView({
  conversation,
  messages,
  currentUser,
  onSendMessage,
  onJoinCall,
  onLeaveConversation,
  className = ''
}: ConversationViewProps) {
  const [newMessage, setNewMessage] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [activeTab, setActiveTab] = useState('messages');

  const handleSendMessage = () => {
    if (newMessage.trim()) {
      onSendMessage(newMessage.trim());
      setNewMessage('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800';
      case 'moderator':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* En-tête de la conversation */}
      <Card className="rounded-none border-b">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={conversation.avatar} />
                <AvatarFallback>
                  <MessageSquare className="h-5 w-5" />
                </AvatarFallback>
              </Avatar>
              <div>
                <CardTitle className="text-lg">{conversation.title}</CardTitle>
                <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span>{conversation.memberCount} membres</span>
                  <Badge variant="secondary" className="text-xs">
                    {conversation.type}
                  </Badge>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              {onJoinCall && (
                <Button variant="outline" size="sm">
                  <Phone className="h-4 w-4" />
                </Button>
              )}
              <Button variant="outline" size="sm">
                <Video className="h-4 w-4" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>
                    <Settings className="mr-2 h-4 w-4" />
                    Paramètres
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Share className="mr-2 h-4 w-4" />
                    Partager
                  </DropdownMenuItem>
                  {onLeaveConversation && (
                    <DropdownMenuItem 
                      className="text-destructive"
                      onClick={onLeaveConversation}
                    >
                      Quitter la conversation
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Contenu principal */}
      <div className="flex-1 flex overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="messages">Messages</TabsTrigger>
            <TabsTrigger value="participants">Participants</TabsTrigger>
          </TabsList>
          
          <TabsContent value="messages" className="flex-1 flex flex-col mt-0">
            {/* Zone des messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Aucun message</h3>
                    <p className="text-muted-foreground">
                      Commencez la conversation en envoyant un message
                    </p>
                  </div>
                </div>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.isOwn ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`flex space-x-2 max-w-[80%] ${message.isOwn ? 'flex-row-reverse space-x-reverse' : ''}`}>
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={message.sender.avatar} />
                        <AvatarFallback>
                          {message.sender.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className={`space-y-1 ${message.isOwn ? 'text-right' : ''}`}>
                        <div className={`rounded-lg px-3 py-2 ${
                          message.isOwn 
                            ? 'bg-primary text-primary-foreground' 
                            : 'bg-muted'
                        }`}>
                          <p className="text-sm">{message.content}</p>
                        </div>
                        <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                          <span>{message.sender.name}</span>
                          <span>•</span>
                          <span>{message.timestamp}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            
            {/* Zone de saisie */}
            <div className="border-t p-4">
              <div className="flex items-end space-x-2">
                <Button variant="outline" size="sm">
                  <Paperclip className="h-4 w-4" />
                </Button>
                <div className="flex-1">
                  <Textarea
                    placeholder="Tapez votre message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    className="min-h-[40px] max-h-[120px] resize-none"
                    rows={1}
                  />
                </div>
                <Button variant="outline" size="sm">
                  <Smile className="h-4 w-4" />
                </Button>
                <Button onClick={handleSendMessage} disabled={!newMessage.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="participants" className="flex-1 mt-0">
            <div className="p-4 space-y-4">
              <h3 className="text-lg font-semibold">Participants ({conversation.participants.length})</h3>
              <div className="space-y-2">
                {conversation.participants.map((participant) => (
                  <div key={participant.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center space-x-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={participant.avatar} />
                        <AvatarFallback>
                          {participant.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-medium">{participant.name}</span>
                          <div className={`w-2 h-2 rounded-full ${participant.isOnline ? 'bg-green-500' : 'bg-gray-400'}`} />
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {participant.isOnline ? 'En ligne' : `Vu ${participant.lastSeen}`}
                        </p>
                      </div>
                    </div>
                    <Badge variant="secondary" className={getRoleColor(participant.role)}>
                      {participant.role}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
