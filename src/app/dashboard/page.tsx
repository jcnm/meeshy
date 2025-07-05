'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { 
  Plus, 
  MessageSquare, 
  Users, 
  Settings,
  LogOut,
  Link2,
  Copy,
  Globe,
  Clock
} from 'lucide-react';
import { User, Conversation, ConversationLink } from '@/types';
import { toast } from 'sonner';

export default function DashboardPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationLinks, setConversationLinks] = useState<ConversationLink[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingConversation, setIsCreatingConversation] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        if (!token) {
          router.push('/');
          return;
        }

        // Vérifier le token et récupérer les données utilisateur
        const response = await fetch('http://localhost:3002/auth/me', {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (response.ok) {
          const userData = await response.json();
          setCurrentUser(userData);
          await loadUserData(userData.id, token);
        } else {
          localStorage.removeItem('auth_token');
          router.push('/');
        }
      } catch (error) {
        console.error('Erreur auth:', error);
        router.push('/');
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  const loadUserData = async (userId: string, token: string) => {
    try {
      // Charger les conversations
      const conversationsResponse = await fetch(`http://localhost:3002/conversation/user/${userId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (conversationsResponse.ok) {
        const conversationsData = await conversationsResponse.json();
        setConversations(conversationsData);
      }

      // Charger les liens de conversation
      const linksResponse = await fetch(`http://localhost:3002/conversation/links/user/${userId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (linksResponse.ok) {
        const linksData = await linksResponse.json();
        setConversationLinks(linksData);
      }
    } catch (error) {
      console.error('Erreur chargement données:', error);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    setCurrentUser(null);
    router.push('/');
  };

  const createNewConversation = async () => {
    if (!currentUser) return;

    setIsCreatingConversation(true);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('http://localhost:3002/conversation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: `Nouvelle conversation ${new Date().toLocaleDateString()}`,
          isGroup: false,
          isPrivate: false,
        }),
      });

      if (response.ok) {
        const newConversation = await response.json();
        setConversations(prev => [newConversation, ...prev]);
        toast.success('Conversation créée !');
        router.push(`/chat/${newConversation.id}`);
      } else {
        toast.error('Erreur lors de la création de la conversation');
      }
    } catch (error) {
      console.error('Erreur création conversation:', error);
      toast.error('Erreur de connexion');
    } finally {
      setIsCreatingConversation(false);
    }
  };

  const copyLinkToClipboard = (linkId: string) => {
    const fullLink = `${window.location.origin}/join/${linkId}`;
    navigator.clipboard.writeText(fullLink);
    toast.success('Lien copié !');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!currentUser) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="h-8 w-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
              <MessageSquare className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Meeshy</h1>
              <p className="text-sm text-gray-600">Bienvenue, {currentUser.firstName} !</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button variant="ghost" size="sm">
              <Settings className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Actions principales */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>Actions rapides</CardTitle>
                <CardDescription>
                  Commencez une nouvelle conversation ou rejoignez-en une
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button 
                  onClick={createNewConversation}
                  disabled={isCreatingConversation}
                  className="w-full flex items-center space-x-2"
                >
                  <Plus className="h-4 w-4" />
                  <span>{isCreatingConversation ? 'Création...' : 'Nouvelle conversation'}</span>
                </Button>
                
                <Button 
                  variant="outline"
                  onClick={() => router.push('/groups')}
                  className="w-full flex items-center space-x-2"
                >
                  <Users className="h-4 w-4" />
                  <span>Gérer les groupes</span>
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Conversations */}
          <div className="lg:col-span-2">
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Mes conversations</h2>
                {conversations.length > 0 ? (
                  <div className="grid gap-4">
                    {conversations.map((conversation) => (
                      <Card key={conversation.id} className="hover:shadow-md transition-shadow cursor-pointer">
                        <CardHeader 
                          className="pb-3"
                          onClick={() => router.push(`/chat/${conversation.id}`)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                                {conversation.isGroup ? (
                                  <Users className="h-5 w-5 text-blue-600" />
                                ) : (
                                  <MessageSquare className="h-5 w-5 text-blue-600" />
                                )}
                              </div>
                              <div>
                                <CardTitle className="text-lg">
                                  {conversation.name || 'Conversation sans nom'}
                                </CardTitle>
                                <CardDescription>
                                  {conversation.members.length} participant(s)
                                  {conversation.lastMessage && (
                                    <span className="ml-2">
                                      • Dernier message il y a {/* Calculate time */}
                                    </span>
                                  )}
                                </CardDescription>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              {conversation.isGroup && (
                                <Badge variant="secondary">
                                  <Users className="h-3 w-3 mr-1" />
                                  Groupe
                                </Badge>
                              )}
                              {conversation.isPrivate && (
                                <Badge variant="outline">Privé</Badge>
                              )}
                            </div>
                          </div>
                        </CardHeader>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <Card>
                    <CardContent className="py-8 text-center">
                      <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        Aucune conversation
                      </h3>
                      <p className="text-gray-600 mb-4">
                        Créez votre première conversation pour commencer à discuter !
                      </p>
                      <Button onClick={createNewConversation} disabled={isCreatingConversation}>
                        <Plus className="h-4 w-4 mr-2" />
                        Créer une conversation
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Liens de conversation */}
              {conversationLinks.length > 0 && (
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">Liens de partage</h2>
                  <div className="grid gap-4">
                    {conversationLinks.map((link) => (
                      <Card key={link.id}>
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <div className="h-10 w-10 bg-green-100 rounded-full flex items-center justify-center">
                                <Link2 className="h-5 w-5 text-green-600" />
                              </div>
                              <div>
                                <CardTitle className="text-lg">
                                  {link.conversation.name || 'Conversation sans nom'}
                                </CardTitle>
                                <CardDescription>
                                  {link.currentUses}/{link.maxUses || '∞'} utilisations
                                  {link.expiresAt && (
                                    <span className="ml-2">
                                      • Expire le {new Date(link.expiresAt).toLocaleDateString()}
                                    </span>
                                  )}
                                </CardDescription>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Badge variant={link.isActive ? "default" : "secondary"}>
                                {link.isActive ? 'Actif' : 'Inactif'}
                              </Badge>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => copyLinkToClipboard(link.linkId)}
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
