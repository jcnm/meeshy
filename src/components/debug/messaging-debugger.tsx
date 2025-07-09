/**
 * Composant de test pour vérifier l'architecture messaging unifiée
 * À utiliser en mode développement pour débugger
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { messagingService } from '@/services/messaging.service';
import { useMessaging } from '@/hooks/use-messaging';
import type { Message, User } from '@/types';
import { toast } from 'sonner';

// Utilisateur de test
const TEST_USER: Partial<User> = {
  id: 'test-user-123',
  username: 'testuser',
  email: 'test@test.com',
  displayName: 'Utilisateur Test',
  systemLanguage: 'fr'
} as User;

// Conversation de test
const TEST_CONVERSATION_ID = 'test-conversation-456';

export function MessagingDebugger() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessageContent, setNewMessageContent] = useState('');
  const [logs, setLogs] = useState<string[]>([]);

  // Utiliser le hook unifié
  const {
    sendMessage,
    editMessage,
    deleteMessage,
    connectionStatus,
    startTyping,
    stopTyping
  } = useMessaging({
    conversationId: TEST_CONVERSATION_ID,
    currentUser: TEST_USER as User,
    onNewMessage: (message) => {
      addLog(`✅ MESSAGE REÇU: ${message.id} - ${message.content?.substring(0, 50)}...`);
      setMessages(prev => [...prev, message]);
    },
    onMessageEdited: (message) => {
      addLog(`✏️ MESSAGE MODIFIÉ: ${message.id}`);
      setMessages(prev => prev.map(m => m.id === message.id ? message : m));
    },
    onMessageDeleted: (messageId) => {
      addLog(`🗑️ MESSAGE SUPPRIMÉ: ${messageId}`);
      setMessages(prev => prev.filter(m => m.id !== messageId));
    }
  });

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [`[${timestamp}] ${message}`, ...prev.slice(0, 19)]);
  };

  const handleSendMessage = async () => {
    if (!newMessageContent.trim()) return;

    addLog(`📤 ENVOI: "${newMessageContent}"`);
    const success = await sendMessage(newMessageContent);
    
    if (success) {
      setNewMessageContent('');
      addLog(`✅ ENVOI RÉUSSI`);
    } else {
      addLog(`❌ ÉCHEC ENVOI`);
    }
  };

  const handleTestEdit = async () => {
    if (messages.length === 0) {
      toast.error('Aucun message à modifier');
      return;
    }

    const lastMessage = messages[messages.length - 1];
    const newContent = `${lastMessage.content} [MODIFIÉ]`;
    
    addLog(`✏️ MODIFICATION: ${lastMessage.id}`);
    const success = await editMessage(lastMessage.id, newContent);
    
    addLog(success ? `✅ MODIFICATION RÉUSSIE` : `❌ ÉCHEC MODIFICATION`);
  };

  const handleTestDelete = async () => {
    if (messages.length === 0) {
      toast.error('Aucun message à supprimer');
      return;
    }

    const lastMessage = messages[messages.length - 1];
    
    addLog(`🗑️ SUPPRESSION: ${lastMessage.id}`);
    const success = await deleteMessage(lastMessage.id);
    
    addLog(success ? `✅ SUPPRESSION RÉUSSIE` : `❌ ÉCHEC SUPPRESSION`);
  };

  const clearLogs = () => setLogs([]);

  const clearMessages = () => setMessages([]);

  useEffect(() => {
    addLog(`🔧 DÉMARRAGE DEBUGGER`);
    addLog(`👤 UTILISATEUR: ${TEST_USER.displayName}`);
    addLog(`💬 CONVERSATION: ${TEST_CONVERSATION_ID}`);
  }, []);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>🐛 Debugger Messaging Unifié</CardTitle>
          <CardDescription>
            Test de l'architecture unifiée de messagerie Meeshy
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Statut de connexion */}
      <Card>
        <CardHeader>
          <CardTitle>📡 Statut de Connexion</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-2">
              <Badge variant={connectionStatus.isConnected ? 'default' : 'destructive'}>
                {connectionStatus.isConnected ? '✅ Connecté' : '❌ Déconnecté'}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={connectionStatus.hasSocket ? 'default' : 'secondary'}>
                {connectionStatus.hasSocket ? '🔌 Socket Actif' : '🔌 Pas de Socket'}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">
                👤 {connectionStatus.currentUser}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Interface d'envoi */}
      <Card>
        <CardHeader>
          <CardTitle>📤 Envoi de Messages</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Tapez votre message de test..."
              value={newMessageContent}
              onChange={(e) => setNewMessageContent(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
            />
            <Button onClick={handleSendMessage} disabled={!newMessageContent.trim()}>
              Envoyer
            </Button>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => startTyping()}>
              ⌨️ Start Typing
            </Button>
            <Button variant="outline" onClick={() => stopTyping()}>
              🛑 Stop Typing
            </Button>
            <Button variant="outline" onClick={handleTestEdit}>
              ✏️ Modifier Dernier
            </Button>
            <Button variant="outline" onClick={handleTestDelete}>
              🗑️ Supprimer Dernier
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Messages reçus */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>📨 Messages ({messages.length})</CardTitle>
              <Button variant="outline" size="sm" onClick={clearMessages}>
                Vider
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {messages.length === 0 ? (
                <p className="text-gray-500 text-sm">Aucun message reçu</p>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className="p-3 border rounded-lg bg-gray-50"
                  >
                    <div className="text-sm font-mono text-gray-600">
                      ID: {message.id}
                    </div>
                    <div className="text-sm mt-1">
                      {message.content}
                    </div>
                    <div className="text-xs text-gray-400 mt-2">
                      {new Date(message.createdAt).toLocaleTimeString()}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Logs d'activité */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>📋 Logs d'Activité ({logs.length})</CardTitle>
              <Button variant="outline" size="sm" onClick={clearLogs}>
                Vider
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {logs.length === 0 ? (
                <p className="text-gray-500 text-sm">Aucun log</p>
              ) : (
                logs.map((log, index) => (
                  <div
                    key={index}
                    className="text-xs font-mono bg-gray-100 p-2 rounded"
                  >
                    {log}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>📖 Instructions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm space-y-2">
            <p><strong>1.</strong> Vérifiez que le statut de connexion est vert</p>
            <p><strong>2.</strong> Tapez un message et cliquez "Envoyer"</p>
            <p><strong>3.</strong> Le message devrait apparaître dans la liste</p>
            <p><strong>4.</strong> Testez la modification/suppression</p>
            <p><strong>5.</strong> Surveillez les logs pour le debug</p>
            <Separator className="my-2" />
            <p className="text-gray-600">
              <strong>Note:</strong> Ce debugger utilise un utilisateur et une conversation fictifs.
              Pour tester avec plusieurs utilisateurs, ouvrez plusieurs onglets.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
