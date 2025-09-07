'use client';

import { useUser } from '@/context/AppContext';
import { ConversationLayoutResponsive } from './ConversationLayoutResponsive';
import { useEffect } from 'react';
import { useTranslations } from '@/hooks/useTranslations';

interface ConversationLayoutWrapperProps {
  selectedConversationId?: string;
}

export function ConversationLayoutWrapper({ selectedConversationId }: ConversationLayoutWrapperProps) {
  const { user, isAuthChecking } = useUser();
  const { t } = useTranslations('conversationWrapper');

  // Logs de débogage
  useEffect(() => {
    console.log('[CONVERSATION_WRAPPER] État actuel:', {
      user: user ? { id: user.id, username: user.username } : null,
      isAuthChecking,
      selectedConversationId
    });
  }, [user, isAuthChecking, selectedConversationId]);

  // Si on est en train de vérifier l'authentification, afficher un loader
  if (isAuthChecking) {
    console.log('[CONVERSATION_WRAPPER] Affichage du loader de vérification');
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">{t('authChecking')}</p>
        </div>
      </div>
    );
  }

  // Si pas d'utilisateur après vérification, ne rien afficher
  if (!user) {
    console.log('[CONVERSATION_WRAPPER] Aucun utilisateur trouvé, affichage null');
    return null;
  }

  // Une fois l'utilisateur confirmé, rendre le composant principal
  console.log('[CONVERSATION_WRAPPER] Utilisateur confirmé, rendu du ConversationLayoutResponsive');
  return <ConversationLayoutResponsive selectedConversationId={selectedConversationId} />;
}
