/**
 * Composant pour l'état vide des conversations
 * Affiche un message et des actions quand aucune conversation n'est disponible
 */

import React from 'react';
import { MessageSquare, Plus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface ConversationEmptyStateProps {
  onCreateConversation?: () => void;
  onJoinConversation?: () => void;
  className?: string;
}

export function ConversationEmptyState({
  onCreateConversation,
  onJoinConversation,
  className = ''
}: ConversationEmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center p-8 text-center ${className}`}>
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <MessageSquare className="h-8 w-8 text-muted-foreground" />
          </div>
          <CardTitle className="text-xl">Aucune conversation</CardTitle>
          <CardDescription>
            Commencez une nouvelle conversation ou rejoignez une conversation existante
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {onCreateConversation && (
            <Button 
              onClick={onCreateConversation}
              className="w-full"
              size="lg"
            >
              <Plus className="mr-2 h-4 w-4" />
              Créer une conversation
            </Button>
          )}
          
          {onJoinConversation && (
            <Button 
              onClick={onJoinConversation}
              variant="outline"
              className="w-full"
              size="lg"
            >
              <Users className="mr-2 h-4 w-4" />
              Rejoindre une conversation
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
