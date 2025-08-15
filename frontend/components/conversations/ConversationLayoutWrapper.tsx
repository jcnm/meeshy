'use client';

import { useUser } from '@/context/AppContext';
import { ConversationLayoutResponsive } from './ConversationLayoutResponsive';

interface ConversationLayoutWrapperProps {
  selectedConversationId?: string;
}

export function ConversationLayoutWrapper({ selectedConversationId }: ConversationLayoutWrapperProps) {
  const { user, isAuthChecking } = useUser();

  // Si on est en train de vérifier l'authentification, afficher un loader
  if (isAuthChecking) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Vérification de l'authentification...</p>
        </div>
      </div>
    );
  }

  // Si pas d'utilisateur après vérification, ne rien afficher
  if (!user) {
    return null;
  }

  // Une fois l'utilisateur confirmé, rendre le composant principal
  return <ConversationLayoutResponsive selectedConversationId={selectedConversationId} />;
}
