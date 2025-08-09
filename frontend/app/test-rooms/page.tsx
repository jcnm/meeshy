'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useSocketIOMessaging } from '@/hooks/use-socketio-messaging';
import { toast } from 'sonner';
import type { Message } from '@/types';

export default function TestRoomsPage() {
  const [activeConversation, setActiveConversation] = useState<string>('');
  const [testMessage, setTestMessage] = useState('Message de test');
  const [messages, setMessages] = useState<Message[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  
  const messaging = useSocketIOMessaging({
    conversationId: activeConversation,
    currentUser: undefined,
    onNewMessage: (message: Message) => {
      setMessages(prev => [...prev, message]);
      addLog(`Nouveau message reçu: ${message.content}`);
    },
    onMessageEdited: (message: Message) => {
      setMessages(prev => prev.map(m => m.id === message.id ? message : m));
      addLog(`Message modifié: ${message.content}`);
    },
    onMessageDeleted: (messageId: string) => {
      setMessages(prev => prev.filter(m => m.id !== messageId));
      addLog(`Message supprimé: ${messageId}`);
    }
  });

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [`[${timestamp}] ${message}`, ...prev.slice(0, 49)]);
  };

  const testConversations = [
    'conv_001',
    'conv_002', 
    'conv_003',
    'existing_conversation_id'
  ];

  const handleJoinRoom = (conversationId: string) => {
    setActiveConversation(conversationId);
    addLog(`Rejoindre la conversation: ${conversationId}`);
    toast.success(`Rejoint la conversation ${conversationId}`);
  };

  const handleLeaveRoom = () => {
    if (activeConversation) {
      addLog(`Quitter la conversation: ${activeConversation}`);
      setActiveConversation('');
      setMessages([]);
      toast.info(`Conversation quittée`);
    }
  };

  const handleSendMessage = async () => {
    if (!activeConversation) {
      toast.error('Aucune conversation active');
      return;
    }

    const success = await messaging.sendMessage(testMessage);
    if (success) {
      addLog(`Message envoyé: ${testMessage}`);
      setTestMessage('Message de test');
    }
  };

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Test des Rooms Socket.IO</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Badge variant={messaging.connectionStatus.isConnected ? 'default' : 'destructive'}>
              {messaging.connectionStatus.isConnected ? 'Connecté' : 'Déconnecté'}
            </Badge>
            {messaging.connectionStatus.hasSocket && (
              <Badge variant="secondary">Socket Actif</Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="font-medium">Conversation actuelle:</span>
            {activeConversation ? (
              <Badge variant="outline">{activeConversation}</Badge>
            ) : (
              <span className="text-muted-foreground">Aucune</span>
            )}
          </div>

          <div className="space-y-3">
            <div>
              <h3 className="font-medium mb-2">Rejoindre une conversation</h3>
              <div className="flex flex-wrap gap-2">
                {testConversations.map(conv => (
                  <Button
                    key={conv}
                    variant={activeConversation === conv ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleJoinRoom(conv)}
                    disabled={activeConversation === conv}
                  >
                    {conv}
                  </Button>
                ))}
              </div>
            </div>

            {activeConversation && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleLeaveRoom}
              >
                Quitter la conversation
              </Button>
            )}
          </div>

          {activeConversation && (
            <div className="space-y-2">
              <h3 className="font-medium">Envoyer un message</h3>
              <div className="flex gap-2">
                <Input
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  placeholder="Message de test..."
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                />
                <Button onClick={handleSendMessage}>
                  Envoyer
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Messages reçus ({messages.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {messages.length === 0 ? (
              <p className="text-muted-foreground text-sm">Aucun message reçu</p>
            ) : (
              messages.map((message, index) => (
                <div key={index} className="p-2 bg-muted rounded text-sm">
                  <div className="font-medium">{message.sender?.username || 'Inconnu'}</div>
                  <div>{message.content}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(message.createdAt).toLocaleTimeString()}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Logs ({logs.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1 max-h-60 overflow-y-auto">
            {logs.length === 0 ? (
              <p className="text-muted-foreground text-sm">Aucun log</p>
            ) : (
              logs.map((log, index) => (
                <div key={index} className="text-xs font-mono bg-muted p-1 rounded">
                  {log}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
