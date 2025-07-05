'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { 
  Plus, 
  MessageSquare, 
  Users, 
  Settings,
  LogOut,
  Link2,
  Copy
} from 'lucide-react';
import { User, Conversation, ConversationLink } from '@/types';
import { toast } from 'sonner';
import { buildApiUrl, API_ENDPOINTS } from '@/lib/config';
import { formatConversationTitleFromMembers, getUserFirstName } from '@/utils/user';
import { ConfigModal } from '@/components/config-modal';

export default function DashboardPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationLinks, setConversationLinks] = useState<ConversationLink[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingConversation, setIsCreatingConversation] = useState(false);
  
  // États pour la modal de création de conversation
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [conversationTitle, setConversationTitle] = useState('');
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  
  // État pour la modal de configuration
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  
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
        const response = await fetch(buildApiUrl(API_ENDPOINTS.AUTH.ME), {
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
      const conversationsResponse = await fetch(`${buildApiUrl('/conversation/user')}/${userId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (conversationsResponse.ok) {
        const conversationsData = await conversationsResponse.json();
        setConversations(conversationsData);
      }

      // Charger les liens de conversation
      const linksResponse = await fetch(`${buildApiUrl('/conversation/links/user')}/${userId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (linksResponse.ok) {
        const linksData = await linksResponse.json();
        setConversationLinks(linksData);
      }
      
      // Charger les utilisateurs disponibles
      const usersResponse = await fetch(buildApiUrl(API_ENDPOINTS.USER.SEARCH), {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (usersResponse.ok) {
        const users = await usersResponse.json();
        setAvailableUsers(users.filter((user: User) => user.id !== userId));
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
    if (!currentUser || selectedUsers.length === 0) {
      toast.error('Veuillez sélectionner au moins un participant');
      return;
    }

    setIsCreatingConversation(true);
    try {
      const token = localStorage.getItem('auth_token');
      const participantIds = selectedUsers.map(user => user.id);
      
      // Déterminer automatiquement le type selon le nombre de participants
      const type = selectedUsers.length === 1 ? 'direct' : 'group';
      const title = type === 'group' 
        ? (conversationTitle || `Conversation avec ${selectedUsers.map(u => getUserFirstName(u)).join(', ')}`)
        : `Conversation avec ${getUserFirstName(selectedUsers[0])}`;
      
      const response = await fetch(buildApiUrl(API_ENDPOINTS.CONVERSATION.CREATE), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          type,
          title,
          description: `Conversation créée le ${new Date().toLocaleDateString()}`,
          participantIds,
        }),
      });

      if (response.ok) {
        const newConversation = await response.json();
        setConversations(prev => [newConversation, ...prev]);
        toast.success('Conversation créée !');
        
        // Réinitialiser la modal
        setIsCreateModalOpen(false);
        setSelectedUsers([]);
        setConversationTitle('');
        
        router.push(`/chat/${newConversation.id}`);
      } else {
        const errorData = await response.json();
        console.error('Erreur serveur:', errorData);
        toast.error(errorData.message || 'Erreur lors de la création de la conversation');
      }
    } catch (error) {
      console.error('Erreur création conversation:', error);
      toast.error('Erreur de connexion');
    } finally {
      setIsCreatingConversation(false);
    }
  };

  const generateConversationLink = async () => {
    if (!currentUser) return;

    setIsGeneratingLink(true);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(buildApiUrl(API_ENDPOINTS.CONVERSATION.CREATE), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          type: 'group',
          title: `Conversation partagée de ${currentUser.firstName || currentUser.displayName || currentUser.username}`,
          description: 'Conversation créée via lien de partage',
          participantIds: [], // Conversation vide pour l'instant
        }),
      });

      if (response.ok) {
        const newConversation = await response.json();
        
        // Générer un lien unique pour cette conversation
        const linkId = `link-${newConversation.id}-${Date.now()}`;
        
        // Créer le lien de partage (il faudra ajouter cette route au backend)
        const linkResponse = await fetch(buildApiUrl(API_ENDPOINTS.CONVERSATION.CREATE_LINK), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            conversationId: newConversation.id,
            linkId,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 jours
          }),
        });

        if (linkResponse.ok) {
          await linkResponse.json(); // Valider la réponse
          const fullLink = `${window.location.origin}/join/${linkId}`;
          
          await navigator.clipboard.writeText(fullLink);
          toast.success('Lien de conversation copié dans le presse-papiers !');
          
          // Recharger les liens
          if (currentUser.id) {
            const token = localStorage.getItem('auth_token');
            await loadUserData(currentUser.id, token!);
          }
        }
      }
    } catch (error) {
      console.error('Erreur génération lien:', error);
      toast.error('Erreur lors de la génération du lien');
    } finally {
      setIsGeneratingLink(false);
    }
  };

  const copyLinkToClipboard = (linkId: string) => {
    const fullLink = `${window.location.origin}/join/${linkId}`;
    navigator.clipboard.writeText(fullLink);
    toast.success('Lien copié !');
  };

  const handleUserUpdate = (updatedUser: User) => {
    setCurrentUser(updatedUser);
    // TODO: Optionnellement, synchroniser avec le serveur
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
              <p className="text-sm text-gray-600">Bienvenue, {currentUser.firstName || currentUser.displayName || currentUser.username} !</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setIsConfigModalOpen(true)}
            >
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
                  onClick={() => setIsCreateModalOpen(true)}
                  className="w-full flex items-center space-x-2"
                >
                  <Plus className="h-4 w-4" />
                  <span>Nouvelle conversation</span>
                </Button>
                
                <Button 
                  onClick={generateConversationLink}
                  disabled={isGeneratingLink}
                  variant="outline"
                  className="w-full flex items-center space-x-2"
                >
                  <Link2 className="h-4 w-4" />
                  <span>{isGeneratingLink ? 'Génération...' : 'Générer un lien'}</span>
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
                                  {currentUser && conversation.participants 
                                    ? formatConversationTitleFromMembers(conversation.participants, currentUser.id)
                                    : conversation.name || 'Conversation sans nom'}
                                </CardTitle>
                                <CardDescription>
                                  {conversation.participants?.length || 0} participant(s)
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

      {/* Modal de création de conversation */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Nouvelle conversation</DialogTitle>
            <DialogDescription>
              Sélectionnez les participants pour votre conversation
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Titre de la conversation (optionnel pour direct) */}
            {selectedUsers.length > 1 && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Titre du groupe</label>
                <Input
                  placeholder="Nom de votre groupe"
                  value={conversationTitle}
                  onChange={(e) => setConversationTitle(e.target.value)}
                />
              </div>
            )}

            {/* Sélection des participants */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Participants 
                <span className={`ml-2 px-2 py-1 rounded text-sm font-semibold ${
                  selectedUsers.length === 1 
                    ? 'bg-green-100 text-green-800 border border-green-200' 
                    : selectedUsers.length > 1 
                    ? 'bg-orange-100 text-orange-800 border border-orange-200'
                    : 'bg-gray-100 text-gray-800 border border-gray-200'
                }`}>
                  {selectedUsers.length} sélectionné{selectedUsers.length > 1 ? 's' : ''}
                </span>
              </label>
              <div className="max-h-60 overflow-y-auto border rounded-lg p-2 space-y-2">
                {availableUsers.length > 0 ? (
                  availableUsers.map((user) => (
                    <div
                      key={user.id}
                      className={`flex items-center justify-between p-2 rounded-lg border cursor-pointer hover:bg-gray-50 ${
                        selectedUsers.some(u => u.id === user.id) ? 'bg-blue-50 border-blue-200' : ''
                      }`}
                      onClick={() => {
                        setSelectedUsers(prev => 
                          prev.some(u => u.id === user.id)
                            ? prev.filter(u => u.id !== user.id)
                            : [...prev, user]
                        );
                      }}
                    >
                      <div className="flex items-center space-x-3">
                        <div className="h-8 w-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                          <span className="text-white text-sm font-medium">
                            {user.firstName?.[0] || user.username[0]}{user.lastName?.[0] || ''}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium">{user.firstName || user.displayName || user.username} {user.lastName || ''}</p>
                          <p className="text-sm text-gray-500">@{user.username}</p>
                        </div>
                      </div>
                      {selectedUsers.some(u => u.id === user.id) && (
                        <div className="h-5 w-5 bg-blue-500 rounded-full flex items-center justify-center">
                          <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-center text-gray-500 py-4">Aucun utilisateur disponible</p>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end space-x-2 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setIsCreateModalOpen(false);
                  setSelectedUsers([]);
                  setConversationTitle('');
                }}
              >
                Annuler
              </Button>
              <Button
                onClick={createNewConversation}
                disabled={isCreatingConversation || selectedUsers.length === 0}
              >
                {isCreatingConversation ? 'Création...' : 'Créer la conversation'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de configuration */}
      <ConfigModal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        currentUser={currentUser}
        onUserUpdate={handleUserUpdate}
      />
    </div>
  );
}
