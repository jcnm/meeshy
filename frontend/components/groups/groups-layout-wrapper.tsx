'use client';

import { useUser } from '@/context/UnifiedProvider';
import { GroupsLayoutResponsive } from './groups-layout-responsive';
import { useEffect } from 'react';

interface GroupsLayoutWrapperProps {
  selectedGroupIdentifier?: string;
}

export function GroupsLayoutWrapper({ selectedGroupIdentifier }: GroupsLayoutWrapperProps) {
  const { user, isAuthChecking } = useUser();

  // Logs de débogage
  useEffect(() => {
    console.log('[GROUPS_WRAPPER] État actuel:', {
      user: user ? { id: user.id, username: user.username } : null,
      isAuthChecking,
      selectedGroupIdentifier
    });
  }, [user, isAuthChecking, selectedGroupIdentifier]);

  // Si on est en train de vérifier l'authentification, afficher un loader
  if (isAuthChecking) {
    console.log('[GROUPS_WRAPPER] Affichage du loader de vérification');
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
    console.log('[GROUPS_WRAPPER] Aucun utilisateur trouvé, affichage null');
    return null;
  }

  // Une fois l'utilisateur confirmé, rendre le composant principal
  console.log('[GROUPS_WRAPPER] Utilisateur confirmé, rendu du GroupsLayoutResponsive');
  return <GroupsLayoutResponsive selectedGroupIdentifier={selectedGroupIdentifier} />;
}
