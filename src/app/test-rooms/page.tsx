'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useMessaging } from '@/hooks/use-messaging';
import { useAppContext } from '@/context/AppContext';
import { toast } from 'sonner';

/**
 * Page de test pour vérifier le fonctionnement des rooms WebSocket
 * Tests:
 * - Rejoindre/quitter des conversations
 * - Envoi de messages
 * - Réception de messages seulement dans la bonne room
 * - Statut de connexion
 */
export default function TestRoomsPage() {
  const { state } = useAppContext();
  const [activeConversation, setActiveConversation] = useState<string>('');
  const [testMessage, setTestMessage] = useState('Message de test');
  const [logs, setLogs] = useState<string[]>([]);
  
  const messaging = useMessaging({
    conversationId: activeConversation || undefined,
    currentUser: state.user || undefined,
    onNewMessage: (message) => {
      addLog(`📨 Message reçu: ${message.content} (de ${message.senderName}, conv: ${message.conversationId})`);
    },
    onMessageEdited: (message) => {
      addLog(`✏️ Message modifié: ${message.content} (conv: ${message.conversationId})`);
    },
    onMessageDeleted: (messageId) => {
      addLog(`🗑️ Message supprimé: ${messageId}`);
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

  const handleJoinConversation = (conversationId: string) => {
    if (activeConversation && activeConversation !== conversationId) {
      messaging.leaveConversation(activeConversation);
      addLog(`🚪 Quitté conversation: ${activeConversation}`);
    }
    
    setActiveConversation(conversationId);
    messaging.joinConversation(conversationId);
    addLog(`🚪 Rejoint conversation: ${conversationId}`);
  };

  const handleLeaveConversation = () => {
    if (activeConversation) {
      messaging.leaveConversation(activeConversation);
      addLog(`🚪 Quitté conversation: ${activeConversation}`);
      setActiveConversation('');
    }
  };

  const handleSendMessage = async () => {
    if (!activeConversation) {
      toast.error('Aucune conversation active');
      return;
    }

    if (!testMessage.trim()) {
      toast.error('Message vide');
      return;
    }

    addLog(`📤 Envoi message: "${testMessage}" vers conv: ${activeConversation}`);
    
    const success = await messaging.sendMessage(testMessage);
    if (success) {
      addLog(`✅ Message envoyé avec succès`);
      setTestMessage('');
    } else {
      addLog(`❌ Échec envoi message`);
    }
  };

  const clearLogs = () => {
    setLogs([]);
  };

  useEffect(() => {
    addLog('🔌 Test des rooms WebSocket initialisé');
    return () => {
      if (activeConversation) {
        messaging.leaveConversation(activeConversation);
      }
    };
  }, []);

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Test des Rooms WebSocket</h1>
        <p className="text-muted-foreground">
          Vérification du système de rooms conversation:conversationId
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Panel de contrôle */}
        <Card>
          <CardHeader>
            <CardTitle>Contrôles de Test</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Statut de connexion */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Statut de Connexion</label>
              <div className="flex gap-2">
                <Badge variant={messaging.connectionStatus.isConnected ? "default" : "destructive"}>
                  {messaging.connectionStatus.isConnected ? "Connecté" : "Déconnecté"}
                </Badge>
                <Badge variant={messaging.connectionStatus.hasSocket ? "default" : "outline"}>
                  Socket: {messaging.connectionStatus.hasSocket ? "OK" : "KO"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Utilisateur: {messaging.connectionStatus.currentUser}
              </p>
            </div>

            {/* Conversation active */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Conversation Active</label>
              <div className="flex gap-2">
                <Badge variant={activeConversation ? "default" : "outline"}>
                  {activeConversation || "Aucune"}
                </Badge>
                {activeConversation && (
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={handleLeaveConversation}
                  >
                    Quitter
                  </Button>
                )}
              </div>
            </div>

            {/* Rejoindre des conversations de test */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Conversations de Test</label>
              <div className="grid grid-cols-2 gap-2">
                {testConversations.map(convId => (
                  <Button
                    key={convId}
                    size="sm"
                    variant={activeConversation === convId ? "default" : "outline"}
                    onClick={() => handleJoinConversation(convId)}
                  >
                    {convId}
                  </Button>
                ))}
              </div>
            </div>

            {/* Envoi de message */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Test d'Envoi</label>
              <div className="flex gap-2">
                <Input
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  placeholder="Message de test..."
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                />
                <Button 
                  onClick={handleSendMessage}
                  disabled={!activeConversation || !testMessage.trim()}
                >
                  Envoyer
                </Button>
              </div>
            </div>

            <Button variant="outline" onClick={clearLogs} className="w-full">
              Effacer les Logs
            </Button>
          </CardContent>
        </Card>

        {/* Logs d'activité */}
        <Card>
          <CardHeader>
            <CardTitle>Logs d'Activité ({logs.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-96 overflow-y-auto bg-slate-50 dark:bg-slate-900 p-3 rounded-md">
              {logs.length === 0 ? (
                <p className="text-muted-foreground italic">Aucun log pour le moment...</p>
              ) : (
                <div className="space-y-1">
                  {logs.map((log, index) => (
                    <div
                      key={index}
                      className="text-xs font-mono p-1 rounded border-l-2 border-blue-200 bg-white/50 dark:bg-slate-800/50"
                    >
                      {log}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Instructions de Test</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div>
              <h4 className="font-semibold">🔗 Test des Rooms:</h4>
              <ol className="list-decimal list-inside ml-4 space-y-1">
                <li>Cliquer sur une conversation pour la rejoindre</li>
                <li>Vérifier que le statut "Conversation Active" change</li>
                <li>Envoyer un message de test</li>
                <li>Ouvrir un autre onglet avec cette même page</li>
                <li>Dans l'autre onglet, rejoindre la MÊME conversation</li>
                <li>Envoyer un message depuis l'autre onglet</li>
                <li>Vérifier que le message apparaît dans les deux onglets</li>
              </ol>
            </div>
            
            <div>
              <h4 className="font-semibold">🚫 Test d'Isolation:</h4>
              <ol className="list-decimal list-inside ml-4 space-y-1">
                <li>Dans un onglet, rejoindre "conv_001"</li>
                <li>Dans l'autre onglet, rejoindre "conv_002"</li>
                <li>Envoyer des messages depuis chaque onglet</li>
                <li>Vérifier que les messages n'apparaissent QUE dans le bon onglet</li>
              </ol>
            </div>

            <div>
              <h4 className="font-semibold">📋 Logs à Surveiller:</h4>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li>🚪 Messages de join/leave des conversations</li>
                <li>📤 Confirmations d'envoi de messages</li>
                <li>📨 Réception de messages avec ID de conversation</li>
                <li>✅ Succès/échecs des opérations</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
