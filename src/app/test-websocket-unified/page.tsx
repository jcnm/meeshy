'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Wifi, 
  WifiOff,
  MessageSquare,
  Users,
  Activity,
  Clock
} from 'lucide-react';
import { useMessaging } from '@/hooks/use-messaging';
import { buildApiUrl, API_ENDPOINTS } from '@/lib/config';
import { User } from '@/types';
import { toast } from 'sonner';

interface TestResult {
  name: string;
  status: 'success' | 'error' | 'warning' | 'pending';
  message: string;
  timestamp: Date;
}

interface WebSocketEvent {
  type: string;
  data: any;
  timestamp: Date;
  direction: 'in' | 'out';
}

export default function WebSocketTestPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [testConversationId] = useState('test-conversation-1');
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [events, setEvents] = useState<WebSocketEvent[]>([]);
  const [testMessage, setTestMessage] = useState('Test message from unified WebSocket');
  const [isRunningTests, setIsRunningTests] = useState(false);

  // Hook de messaging unifié pour les tests
  const messaging = useMessaging({
    conversationId: testConversationId,
    currentUser: currentUser || undefined,
    onNewMessage: (message) => {
      addEvent('newMessage', message, 'in');
      addTestResult('Réception Message', 'success', `Message reçu: "${message.content}"`);
    },
    onMessageEdited: (message) => {
      addEvent('messageEdited', message, 'in');
      addTestResult('Message Modifié', 'success', `Message modifié: "${message.content}"`);
    },
    onMessageDeleted: (messageId) => {
      addEvent('messageDeleted', { messageId }, 'in');
      addTestResult('Message Supprimé', 'success', `Message supprimé: ${messageId}`);
    }
  });

  // Initialisation utilisateur
  useEffect(() => {
    const initUser = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        if (!token) {
          addTestResult('Authentification', 'error', 'Token non trouvé - connectez-vous d\'abord');
          return;
        }

        const response = await fetch(buildApiUrl(API_ENDPOINTS.AUTH.ME), {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (response.ok) {
          const userData = await response.json();
          setCurrentUser(userData);
          addTestResult('Authentification', 'success', `Utilisateur chargé: ${userData.username}`);
        } else {
          addTestResult('Authentification', 'error', 'Token invalide');
        }
      } catch (error) {
        addTestResult('Authentification', 'error', `Erreur: ${error}`);
      }
    };

    initUser();
  }, []);

  // Ajouter un résultat de test
  const addTestResult = (name: string, status: TestResult['status'], message: string) => {
    setTestResults(prev => [...prev, {
      name,
      status,
      message,
      timestamp: new Date()
    }]);
  };

  // Ajouter un événement WebSocket
  const addEvent = (type: string, data: any, direction: 'in' | 'out') => {
    setEvents(prev => [{
      type,
      data,
      timestamp: new Date(),
      direction
    }, ...prev].slice(0, 20)); // Garder seulement les 20 derniers
  };

  // Tests automatisés
  const runAutomatedTests = async () => {
    if (!currentUser) {
      toast.error('Connectez-vous d\'abord');
      return;
    }

    setIsRunningTests(true);
    setTestResults([]);
    setEvents([]);

    try {
      // Test 1: Vérification de la connexion
      await new Promise(resolve => setTimeout(resolve, 1000));
      if (messaging.connectionStatus.isConnected) {
        addTestResult('Connexion WebSocket', 'success', 'Connexion établie');
      } else {
        addTestResult('Connexion WebSocket', 'error', 'Connexion échouée');
      }

      // Test 2: Test d'envoi de message
      await new Promise(resolve => setTimeout(resolve, 500));
      const testMsg = `Test automatisé ${new Date().toLocaleTimeString()}`;
      addEvent('sendMessage', { content: testMsg }, 'out');
      
      try {
        const success = await messaging.sendMessage(testMsg);
        if (success) {
          addTestResult('Envoi Message', 'success', 'Message envoyé avec succès');
        } else {
          addTestResult('Envoi Message', 'error', 'Échec de l\'envoi');
        }
      } catch (error) {
        addTestResult('Envoi Message', 'error', `Erreur: ${error}`);
      }

      // Test 3: Test des indicateurs de frappe
      await new Promise(resolve => setTimeout(resolve, 500));
      try {
        messaging.startTyping();
        addEvent('startTyping', {}, 'out');
        addTestResult('Indicateur Frappe', 'success', 'Indicateur de frappe envoyé');
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        messaging.stopTyping();
        addEvent('stopTyping', {}, 'out');
      } catch (error) {
        addTestResult('Indicateur Frappe', 'error', `Erreur: ${error}`);
      }

      // Test 4: Test de changement de room
      await new Promise(resolve => setTimeout(resolve, 500));
      try {
        messaging.joinConversation('test-room-2');
        addEvent('joinConversation', { conversationId: 'test-room-2' }, 'out');
        addTestResult('Changement Room', 'success', 'Changement de room effectué');
        
        await new Promise(resolve => setTimeout(resolve, 500));
        messaging.leaveConversation('test-room-2');
        addEvent('leaveConversation', { conversationId: 'test-room-2' }, 'out');
      } catch (error) {
        addTestResult('Changement Room', 'error', `Erreur: ${error}`);
      }

      addTestResult('Tests Automatisés', 'success', 'Tous les tests terminés');

    } catch (error) {
      addTestResult('Tests Automatisés', 'error', `Erreur globale: ${error}`);
    } finally {
      setIsRunningTests(false);
    }
  };

  // Test manuel d'envoi de message
  const sendTestMessage = async () => {
    if (!testMessage.trim() || !currentUser) return;

    addEvent('sendMessage', { content: testMessage }, 'out');
    
    try {
      const success = await messaging.sendMessage(testMessage);
      if (success) {
        addTestResult('Test Manuel', 'success', `Message envoyé: "${testMessage}"`);
        setTestMessage('');
      } else {
        addTestResult('Test Manuel', 'error', 'Échec de l\'envoi');
      }
    } catch (error) {
      addTestResult('Test Manuel', 'error', `Erreur: ${error}`);
    }
  };

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'success': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'error': return <XCircle className="h-4 w-4 text-red-600" />;
      case 'warning': return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      default: return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: TestResult['status']) => {
    switch (status) {
      case 'success': return 'bg-green-100 text-green-800';
      case 'error': return 'bg-red-100 text-red-800';
      case 'warning': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* En-tête */}
        <div className="text-center space-y-4">
          <h1 className="text-3xl font-bold text-gray-900">
            🧪 Tests Architecture WebSocket Unifiée
          </h1>
          <p className="text-gray-600">
            Validation complète de l'architecture de messagerie temps réel
          </p>
          
          {/* Status global */}
          <div className="flex items-center justify-center space-x-4">
            <div className="flex items-center space-x-2">
              {messaging.connectionStatus.isConnected ? (
                <Wifi className="h-5 w-5 text-green-600" />
              ) : (
                <WifiOff className="h-5 w-5 text-red-600" />
              )}
              <span className={messaging.connectionStatus.isConnected ? 'text-green-600' : 'text-red-600'}>
                {messaging.connectionStatus.isConnected ? 'Connecté' : 'Déconnecté'}
              </span>
            </div>
            
            {currentUser && (
              <Badge variant="secondary">
                {currentUser.username}
              </Badge>
            )}
            
            <Badge variant="outline">
              Room: {testConversationId}
            </Badge>
          </div>
        </div>

        {/* Interface de test */}
        <Tabs defaultValue="tests" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="tests">Tests</TabsTrigger>
            <TabsTrigger value="events">Événements</TabsTrigger>
            <TabsTrigger value="manual">Tests Manuels</TabsTrigger>
          </TabsList>

          {/* Onglet Tests */}
          <TabsContent value="tests" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Activity className="h-5 w-5" />
                  <span>Tests Automatisés</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button 
                  onClick={runAutomatedTests}
                  disabled={isRunningTests || !currentUser}
                  className="w-full"
                >
                  {isRunningTests ? 'Tests en cours...' : 'Lancer les tests automatisés'}
                </Button>

                {/* Résultats des tests */}
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {testResults.map((result, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-white rounded-lg border">
                      <div className="flex items-center space-x-3">
                        {getStatusIcon(result.status)}
                        <div>
                          <div className="font-medium">{result.name}</div>
                          <div className="text-sm text-gray-600">{result.message}</div>
                        </div>
                      </div>
                      <div className="text-xs text-gray-400">
                        {result.timestamp.toLocaleTimeString()}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Onglet Événements */}
          <TabsContent value="events" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <MessageSquare className="h-5 w-5" />
                  <span>Événements WebSocket</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {events.map((event, index) => (
                    <div key={index} className={`p-3 rounded-lg border ${
                      event.direction === 'in' ? 'bg-blue-50 border-blue-200' : 'bg-green-50 border-green-200'
                    }`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Badge variant={event.direction === 'in' ? 'default' : 'secondary'}>
                            {event.direction === 'in' ? '⬇️ IN' : '⬆️ OUT'}
                          </Badge>
                          <span className="font-medium">{event.type}</span>
                        </div>
                        <span className="text-xs text-gray-500">
                          {event.timestamp.toLocaleTimeString()}
                        </span>
                      </div>
                      <pre className="text-xs mt-2 text-gray-600 overflow-x-auto">
                        {JSON.stringify(event.data, null, 2)}
                      </pre>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Onglet Tests Manuels */}
          <TabsContent value="manual" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Users className="h-5 w-5" />
                  <span>Tests Manuels</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                
                {/* Test d'envoi de message */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Test d'envoi de message:</label>
                  <div className="flex space-x-2">
                    <Input
                      placeholder="Tapez votre message de test..."
                      value={testMessage}
                      onChange={(e) => setTestMessage(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && sendTestMessage()}
                    />
                    <Button onClick={sendTestMessage} disabled={!testMessage.trim()}>
                      Envoyer
                    </Button>
                  </div>
                </div>

                {/* Tests de frappe */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Tests d'indicateurs de frappe:</label>
                  <div className="flex space-x-2">
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        messaging.startTyping();
                        addEvent('startTyping', {}, 'out');
                      }}
                    >
                      Commencer à taper
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        messaging.stopTyping();
                        addEvent('stopTyping', {}, 'out');
                      }}
                    >
                      Arrêter de taper
                    </Button>
                  </div>
                </div>

                {/* Test de navigation entre rooms */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Tests de navigation entre rooms:</label>
                  <div className="flex space-x-2">
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        messaging.joinConversation('test-room-a');
                        addEvent('joinConversation', { conversationId: 'test-room-a' }, 'out');
                      }}
                    >
                      Rejoindre Room A
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        messaging.joinConversation('test-room-b');
                        addEvent('joinConversation', { conversationId: 'test-room-b' }, 'out');
                      }}
                    >
                      Rejoindre Room B
                    </Button>
                  </div>
                </div>

                {/* Informations de debug */}
                <div className="p-4 bg-gray-100 rounded-lg">
                  <h4 className="font-medium mb-2">État de la connexion:</h4>
                  <pre className="text-xs text-gray-600">
                    {JSON.stringify(messaging.connectionStatus, null, 2)}
                  </pre>
                </div>

              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
