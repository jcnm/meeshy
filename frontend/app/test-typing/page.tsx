'use client';

import { useState, useEffect } from 'react';
import { useTypingIndicator } from '@/hooks/use-typing-indicator';
import { useMessaging } from '@/hooks/use-messaging';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Keyboard, Users, Wifi, WifiOff } from 'lucide-react';

/**
 * Page de test pour les indicateurs de frappe unifiés
 * Permet de tester le système de typing indicators en temps réel
 */
export default function TestTypingPage() {
  const [conversationId, setConversationId] = useState('test-conversation-1');
  const [currentUserId, setCurrentUserId] = useState('user-1');
  const [messageInput, setMessageInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  // Hooks unifiés
  const messaging = useMessaging({
    conversationId,
    // Pour le test, on peut passer undefined et le hook utilisera des valeurs par défaut
    currentUser: undefined,
  });

  const typingIndicator = useTypingIndicator(conversationId, currentUserId);

  // Simuler la frappe avec debounce
  useEffect(() => {
    let typingTimeout: NodeJS.Timeout | undefined;

    if (messageInput.length > 0 && !isTyping) {
      setIsTyping(true);
      typingIndicator.startTyping();
    }

    if (messageInput.length > 0) {
      if (typingTimeout) {
        clearTimeout(typingTimeout);
      }
      typingTimeout = setTimeout(() => {
        setIsTyping(false);
        typingIndicator.stopTyping();
      }, 1000); // Arrêter de taper après 1 seconde d'inactivité
    } else if (isTyping) {
      setIsTyping(false);
      typingIndicator.stopTyping();
    }

    return () => {
      if (typingTimeout) {
        clearTimeout(typingTimeout);
      }
    };
  }, [messageInput, isTyping, typingIndicator]);

  const handleSendMessage = async () => {
    if (messageInput.trim()) {
      const success = await messaging.sendMessage(messageInput);
      if (success) {
        setMessageInput('');
        setIsTyping(false);
        typingIndicator.stopTyping();
      }
    }
  };

  const switchUser = (userId: string) => {
    if (isTyping) {
      typingIndicator.stopTyping();
      setIsTyping(false);
    }
    setCurrentUserId(userId);
  };

  const switchConversation = (convId: string) => {
    if (isTyping) {
      typingIndicator.stopTyping();
      setIsTyping(false);
    }
    setConversationId(convId);
  };

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <div className="space-y-6">
        {/* En-tête */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Keyboard className="h-5 w-5" />
              Test des Indicateurs de Frappe
            </CardTitle>
            <CardDescription>
              Testez le système unifié de typing indicators en temps réel
            </CardDescription>
          </CardHeader>
        </Card>

        {/* État de connexion */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {messaging.connectionStatus.isConnected ? (
                <Wifi className="h-5 w-5 text-green-600" />
              ) : (
                <WifiOff className="h-5 w-5 text-red-600" />
              )}
              État de la Connexion
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <strong>Statut:</strong> 
                <Badge className={`ml-2 ${messaging.connectionStatus.isConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                  {messaging.connectionStatus.isConnected ? 'Connecté' : 'Déconnecté'}
                </Badge>
              </div>
              <div>
                <strong>Socket:</strong> 
                <Badge className={`ml-2 ${messaging.connectionStatus.hasSocket ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>
                  {messaging.connectionStatus.hasSocket ? 'Actif' : 'Inactif'}
                </Badge>
              </div>
              <div>
                <strong>Utilisateur:</strong> 
                <Badge variant="outline" className="ml-2">
                  {messaging.connectionStatus.currentUser}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contrôles de test */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Changer d&apos;Utilisateur</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {['user-1', 'user-2', 'user-3'].map((userId) => (
                  <Button
                    key={userId}
                    variant={currentUserId === userId ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => switchUser(userId)}
                  >
                    {userId}
                  </Button>
                ))}
              </div>
              <p className="text-sm text-gray-600 mt-2">
                Utilisateur actuel: <strong>{currentUserId}</strong>
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Changer de Conversation</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {['test-conversation-1', 'test-conversation-2'].map((convId) => (
                  <Button
                    key={convId}
                    variant={conversationId === convId ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => switchConversation(convId)}
                  >
                    {convId.split('-')[2]}
                  </Button>
                ))}
              </div>
              <p className="text-sm text-gray-600 mt-2">
                Conversation actuelle: <strong>{conversationId}</strong>
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Zone de frappe et indicateurs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Indicateurs de Frappe
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Indicateurs actifs */}
              <div>
                <h4 className="font-medium mb-2">Utilisateurs en train de taper:</h4>
                {typingIndicator.typingUsers.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {typingIndicator.typingUsers.map((user) => (
                      <Badge key={user.userId} className="bg-blue-100 text-blue-800">
                        <Keyboard className="h-3 w-3 mr-1" />
                        {user.username} (dans {user.conversationId})
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 italic">Aucun utilisateur ne tape pour le moment</p>
                )}
              </div>

              {/* Votre statut */}
              <div>
                <h4 className="font-medium mb-2">Votre statut:</h4>
                <Badge className={`${isTyping ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                  {isTyping ? 'En train de taper...' : 'Inactif'}
                </Badge>
              </div>

              {/* Zone de saisie */}
              <div className="space-y-2">
                <h4 className="font-medium">Tapez un message:</h4>
                <div className="flex gap-2">
                  <Input
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    placeholder="Tapez votre message ici..."
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  />
                  <Button onClick={handleSendMessage} disabled={!messageInput.trim()}>
                    Envoyer
                  </Button>
                </div>
                <p className="text-sm text-gray-600">
                  Les indicateurs de frappe se déclenchent automatiquement
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle>Instructions de Test</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal list-inside space-y-2 text-sm">
              <li>Vérifiez que la connexion WebSocket est active (statut vert)</li>
              <li>Tapez dans la zone de saisie pour déclencher l&apos;indicateur de frappe</li>
              <li>Changez d&apos;utilisateur pour simuler plusieurs utilisateurs</li>
              <li>Changez de conversation pour tester l&apos;isolation par conversation</li>
              <li>Ouvrez plusieurs onglets avec différents utilisateurs pour voir les indicateurs en temps réel</li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
