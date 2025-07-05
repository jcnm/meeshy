'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { CreateAccountForm } from '@/components/create-account-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Users, Clock, ExternalLink } from 'lucide-react';
import { ConversationLink, JoinConversationResponse } from '@/types/frontend';

export default function JoinConversationPage() {
  const params = useParams();
  const router = useRouter();
  const linkId = params?.linkId as string;

  const [conversationLink, setConversationLink] = useState<ConversationLink | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConversationLink = useCallback(async () => {
    try {
      const response = await fetch(`/api/conversation/link/${linkId}`);
      const result = await response.json();

      if (result.success) {
        setConversationLink(result.data);
      } else {
        setError(result.error || 'Lien non trouvé');
      }
    } catch (error) {
      console.error('Erreur:', error);
      setError('Erreur de connexion au serveur');
    } finally {
      setLoading(false);
    }
  }, [linkId]);

  useEffect(() => {
    if (linkId) {
      fetchConversationLink();
    }
  }, [linkId, fetchConversationLink]);

  const handleAccountCreated = (data: JoinConversationResponse) => {
    // Sauvegarder les données utilisateur dans le localStorage
    localStorage.setItem('meeshy_user', JSON.stringify(data.user));
    localStorage.setItem('meeshy_current_conversation', JSON.stringify(data.conversation));
    
    // Rediriger vers la conversation
    router.push(`/chat/${data.conversation.id}`);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('fr-FR', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(date));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto" />
          <p className="text-muted-foreground">Chargement du lien de conversation...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md mx-auto">
          <CardHeader>
            <CardTitle className="text-red-600">Erreur</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => router.push('/')}
              className="w-full"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Retour à l&apos;accueil
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!conversationLink) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md mx-auto">
          <CardHeader>
            <CardTitle>Lien introuvable</CardTitle>
            <CardDescription>Ce lien de conversation n&apos;existe pas ou a expiré.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => router.push('/')}
              className="w-full"
            >
              Retour à l&apos;accueil
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="max-w-4xl mx-auto pt-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Meeshy - Messagerie multilingue
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Vous avez été invité à rejoindre une conversation
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Informations sur le lien */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Informations sur la conversation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Créé le:</span>
                <span>{formatDate(conversationLink.createdAt)}</span>
              </div>

              {conversationLink.expiresAt && (
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Expire le:</span>
                  <span>{formatDate(conversationLink.expiresAt)}</span>
                </div>
              )}

              <div className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Participants:</span>
                <span>{conversationLink.participants.length}</span>
              </div>

              <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                <h4 className="font-medium mb-2">🌍 Traduction automatique</h4>
                <p className="text-sm text-muted-foreground">
                  Meeshy traduit automatiquement les messages dans votre langue préférée. 
                  Vous pouvez toujours voir le message original en cliquant dessus.
                </p>
              </div>

              <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                <h4 className="font-medium mb-2">🔒 Confidentialité</h4>
                <p className="text-sm text-muted-foreground">
                  Toute la traduction se fait dans votre navigateur. 
                  Vos messages ne sont jamais envoyés à des services tiers.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Formulaire de création de compte */}
          <CreateAccountForm 
            linkId={linkId} 
            onSuccess={handleAccountCreated}
          />
        </div>
      </div>
    </div>
  );
}
