'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// Désactiver le prerendering pour éviter les erreurs avec localStorage
export const dynamic = 'force-dynamic';

interface ConnectionTest {
  name: string;
  status: 'pending' | 'success' | 'error';
  message: string;
  timestamp: Date;
}

function WebSocketDebugContent() {
  const [tests, setTests] = useState<ConnectionTest[]>([]);
  const [wsInstance, setWsInstance] = useState<WebSocket | null>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const addTest = (test: Omit<ConnectionTest, 'timestamp'>) => {
    setTests(prev => [...prev, { ...test, timestamp: new Date() }]);
  };

  const testWebSocketConnection = () => {
    if (!isClient) return;
    
    addTest({ name: 'Préparation du test', status: 'pending', message: 'Récupération du token...' });
    
    const token = localStorage.getItem('auth_token');
    if (!token) {
      addTest({ name: 'Vérification token', status: 'error', message: 'Aucun token trouvé dans localStorage' });
      return;
    }

    addTest({ name: 'Vérification token', status: 'success', message: `Token trouvé: ${token.substring(0, 20)}...` });

    const wsUrl = `ws://localhost:3000/ws?token=${encodeURIComponent(token)}`;
    addTest({ name: 'URL WebSocket', status: 'pending', message: `Connexion à: ${wsUrl}` });

    try {
      const ws = new WebSocket(wsUrl);
      setWsInstance(ws);

      ws.onopen = () => {
        addTest({ name: 'Connexion WebSocket', status: 'success', message: 'Connexion établie avec succès!' });
        
        // Test d'envoi de message
        const testMessage = {
          type: 'join_conversation',
          conversationId: 'test-conversation',
          data: { userId: 'test-user' }
        };
        
        ws.send(JSON.stringify(testMessage));
        addTest({ name: 'Envoi message test', status: 'success', message: 'Message de test envoyé' });
      };

      ws.onerror = (error) => {
        addTest({ name: 'Erreur WebSocket', status: 'error', message: `Erreur de connexion: ${error}` });
      };

      ws.onclose = (event) => {
        addTest({ 
          name: 'Fermeture WebSocket', 
          status: event.wasClean ? 'success' : 'error', 
          message: `Code: ${event.code}, Raison: ${event.reason}, Propre: ${event.wasClean}` 
        });
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          addTest({ name: 'Message reçu', status: 'success', message: `Type: ${message.type}, Data: ${JSON.stringify(message.data)}` });
        } catch (e) {
          addTest({ name: 'Message reçu', status: 'success', message: `Message brut: ${event.data}` });
        }
      };

    } catch (error) {
      addTest({ name: 'Création WebSocket', status: 'error', message: `Erreur: ${error}` });
    }
  };

  const testHTTPConnection = async () => {
    addTest({ name: 'Test HTTP Gateway', status: 'pending', message: 'Test de connectivité HTTP...' });
    
    try {
      const response = await fetch('http://localhost:3000/health');
      if (response.ok) {
        const data = await response.json();
        addTest({ name: 'Test HTTP Gateway', status: 'success', message: `Serveur accessible: ${JSON.stringify(data)}` });
      } else {
        addTest({ name: 'Test HTTP Gateway', status: 'error', message: `Erreur HTTP: ${response.status}` });
      }
    } catch (error) {
      addTest({ name: 'Test HTTP Gateway', status: 'error', message: `Erreur réseau: ${error}` });
    }
  };

  const testAuthentication = async () => {
    if (!isClient) return;
    
    addTest({ name: 'Test Authentification', status: 'pending', message: 'Vérification du token...' });
    
    const token = localStorage.getItem('auth_token');
    if (!token) {
      addTest({ name: 'Test Authentification', status: 'error', message: 'Aucun token trouvé' });
      return;
    }

    try {
      const response = await fetch('http://localhost:3000/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const userData = await response.json();
        addTest({ name: 'Test Authentification', status: 'success', message: `Utilisateur valide: ${userData.username}` });
      } else {
        addTest({ name: 'Test Authentification', status: 'error', message: `Token invalide: ${response.status}` });
      }
    } catch (error) {
      addTest({ name: 'Test Authentification', status: 'error', message: `Erreur: ${error}` });
    }
  };

  const closeConnection = () => {
    if (wsInstance) {
      wsInstance.close(1000, 'Fermeture manuelle');
      setWsInstance(null);
      addTest({ name: 'Fermeture manuelle', status: 'success', message: 'Connexion fermée par l\'utilisateur' });
    }
  };

  const clearTests = () => {
    setTests([]);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Debug WebSocket</h1>
          <p className="text-gray-600">Outils de diagnostic pour la connexion WebSocket</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Tests de Connexion</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                onClick={testHTTPConnection} 
                className="w-full"
              >
                Test HTTP Gateway
              </Button>
              <Button 
                onClick={testAuthentication} 
                className="w-full"
              >
                Test Authentification
              </Button>
              <Button 
                onClick={testWebSocketConnection} 
                className="w-full"
                disabled={!!wsInstance}
              >
                Test WebSocket
              </Button>
              <Button 
                onClick={closeConnection} 
                variant="destructive"
                className="w-full"
                disabled={!wsInstance}
              >
                Fermer Connexion
              </Button>
              <Button 
                onClick={clearTests} 
                variant="outline"
                className="w-full"
              >
                Effacer Tests
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Informations Système</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div><strong>Frontend:</strong> http://localhost:3100</div>
                <div><strong>Gateway:</strong> http://localhost:3000</div>
                <div><strong>WebSocket:</strong> ws://localhost:3000/ws</div>
                <div><strong>Token présent:</strong> {isClient && localStorage.getItem('auth_token') ? '✅' : '❌'}</div>
                <div><strong>User Agent:</strong> {isClient ? navigator.userAgent : 'N/A'}</div>
                <div><strong>WebSocket Support:</strong> {isClient && window.WebSocket ? '✅' : '❌'}</div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Résultats des Tests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {tests.length === 0 ? (
                <p className="text-gray-500 text-center py-4">Aucun test effectué</p>
              ) : (
                tests.map((test, index) => (
                  <div key={index} className="border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">{test.name}</span>
                      <div className="flex items-center space-x-2">
                        <Badge 
                          variant={
                            test.status === 'success' ? 'default' : 
                            test.status === 'error' ? 'destructive' : 
                            'secondary'
                          }
                        >
                          {test.status === 'success' ? '✅' : test.status === 'error' ? '❌' : '⏳'}
                          {test.status}
                        </Badge>
                        <span className="text-xs text-gray-500">
                          {test.timestamp.toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600">{test.message}</p>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function WebSocketDebugPage() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return (
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-6">Debug WebSocket - Chargement...</h1>
      </div>
    );
  }

  return <WebSocketDebugContent />;
}
