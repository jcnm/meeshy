'use client';

import { useState, useEffect } from 'react';
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
  Link, 
  Copy, 
  Users, 
  MessageSquare, 
  Settings,
  ExternalLink,
  Clock
} from 'lucide-react';
import { ModelManagerModal } from '@/components/model-manager-modal';
import { User, ConversationLink, Conversation } from '@/types/frontend';
import { toast } from 'sonner';

export default function HomePage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationLinks, setConversationLinks] = useState<ConversationLink[]>([]);
  const [isCreateLinkOpen, setIsCreateLinkOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Charger les données utilisateur depuis localStorage
    const savedUser = localStorage.getItem('meeshy_user');
    if (savedUser) {
      const user = JSON.parse(savedUser);
      setCurrentUser(user);
      loadUserData(user.id);
    }
  }, []);

  const loadUserData = async (userId: string) => {
    try {
      // Charger les conversations
      const conversationsResponse = await fetch(`/api/conversation?userId=${userId}`);
      const conversationsResult = await conversationsResponse.json();
      
      if (conversationsResult.success) {
        setConversations(conversationsResult.data);
      }

      // Charger les liens de conversation
      const linksResponse = await fetch(`/api/conversation/links?userId=${userId}`);
      const linksResult = await linksResponse.json();
      
      if (linksResult.success) {
        setConversationLinks(linksResult.data);
      }
    } catch (error) {
      console.error('Erreur chargement données:', error);
    }
  };

  const createConversationLink = async () => {
    if (!currentUser) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/conversation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: currentUser.id,
          expiresInHours: 24 * 7, // 7 jours
        }),
      });

      const result = await response.json();

      if (result.success) {
        setConversationLinks(prev => [...prev, result.data.link]);
        setIsCreateLinkOpen(false);
        toast.success('Lien de conversation créé !');
      } else {
        toast.error(result.error || 'Erreur lors de la création du lien');
      }
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur de connexion au serveur');
    } finally {
      setIsLoading(false);
    }
  };

  const copyLinkToClipboard = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success('Lien copié dans le presse-papiers !');
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('fr-FR', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(date));
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-md mx-auto">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Meeshy</CardTitle>
            <CardDescription>
              Messagerie multilingue avec traduction automatique
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-4">
                Pour commencer, vous devez rejoindre une conversation via un lien d&apos;invitation.
              </p>
              <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                <h4 className="font-medium mb-2">🌍 Fonctionnalités</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Traduction automatique en temps réel</li>
                  <li>• Confidentialité (traduction locale)</li>
                  <li>• Support de nombreuses langues</li>
                  <li>• Interface moderne et intuitive</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto p-4">
        {/* En-tête */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Bonjour, {currentUser.firstName} 👋
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              Gérez vos conversations et liens d&apos;invitation
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ModelManagerModal>
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4 mr-2" />
                Modèles
              </Button>
            </ModelManagerModal>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Liens de conversation */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Link className="h-5 w-5" />
                    Liens de conversation
                  </CardTitle>
                  <CardDescription>
                    Créez des liens pour inviter d&apos;autres personnes
                  </CardDescription>
                </div>
                <Dialog open={isCreateLinkOpen} onOpenChange={setIsCreateLinkOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Créer un lien
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Créer un lien de conversation</DialogTitle>
                      <DialogDescription>
                        Créez un lien d&apos;invitation pour permettre à d&apos;autres personnes de vous rejoindre.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                        <h4 className="font-medium mb-2">ℹ️ À propos des liens</h4>
                        <ul className="text-sm text-muted-foreground space-y-1">
                          <li>• Le lien expire automatiquement après 7 jours</li>
                          <li>• Les personnes peuvent créer un compte ou se connecter</li>
                          <li>• La traduction automatique est activée par défaut</li>
                        </ul>
                      </div>
                      <Button onClick={createConversationLink} disabled={isLoading} className="w-full">
                        {isLoading ? 'Création...' : 'Créer le lien'}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {conversationLinks.length === 0 ? (
                <div className="text-center py-8">
                  <Link className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">Aucun lien créé</h3>
                  <p className="text-muted-foreground mb-4">
                    Créez votre premier lien pour inviter des personnes
                  </p>
                </div>
              ) : (
                conversationLinks.map((link) => (
                  <div key={link.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant={link.isActive ? 'default' : 'secondary'}>
                          {link.isActive ? 'Actif' : 'Inactif'}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {link.participants.length} participant(s)
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copyLinkToClipboard(link.url || '')}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(link.url, '_blank')}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    
                    <div className="text-sm text-muted-foreground space-y-1">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Créé le {formatDate(link.createdAt)}
                      </div>
                      {link.expiresAt && (
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          Expire le {formatDate(link.expiresAt)}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Conversations actives */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Conversations actives
              </CardTitle>
              <CardDescription>
                Vos conversations récentes
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {conversations.length === 0 ? (
                <div className="text-center py-8">
                  <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">Aucune conversation</h3>
                  <p className="text-muted-foreground">
                    Créez un lien d&apos;invitation pour commencer à discuter
                  </p>
                </div>
              ) : (
                conversations.map((conversation) => (
                  <div key={conversation.id} className="border rounded-lg p-4 hover:bg-muted/50 cursor-pointer">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">
                          {conversation.participants.length} participant(s)
                        </span>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {formatDate(conversation.lastMessageAt)}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {conversation.messages.length} message(s)
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
