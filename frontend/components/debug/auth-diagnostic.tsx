/**
 * Composant de diagnostic pour les problèmes d'authentification Socket.IO
 */

'use client';

import { useEffect } from 'react';
import { useUser } from '@/context/AppContext';
import { meeshySocketIOService } from '@/services/meeshy-socketio.service';

export function AuthDiagnostic() {
  const { user } = useUser();

  useEffect(() => {
    if (user) {
      console.log('🔍 DIAGNOSTIC AUTH - Utilisateur disponible:', {
        id: user.id,
        username: user.username,
        email: user.email
      });

      // Vérifier le token
      const token = localStorage.getItem('auth_token');
      console.log('🔍 DIAGNOSTIC AUTH - Token:', {
        hasToken: !!token,
        tokenLength: token?.length,
        tokenPreview: token ? token.substring(0, 20) + '...' : 'none'
      });

      // Vérifier l'état du service Socket.IO
      const socketStatus = meeshySocketIOService.getConnectionStatus();
      console.log('🔍 DIAGNOSTIC AUTH - État Socket.IO:', socketStatus);

      const diagnostics = meeshySocketIOService.getConnectionDiagnostics();
      console.log('🔍 DIAGNOSTIC AUTH - Diagnostics complets:', diagnostics);

      // Tenter de configurer l'utilisateur
      try {
        meeshySocketIOService.setCurrentUser(user);
        console.log('✅ DIAGNOSTIC AUTH - Utilisateur configuré dans le service');
      } catch (error) {
        console.error('❌ DIAGNOSTIC AUTH - Erreur configuration utilisateur:', error);
      }
    } else {
      console.log('⚠️ DIAGNOSTIC AUTH - Aucun utilisateur disponible');
    }
  }, [user]);

  return null; // Composant invisible
}

export default AuthDiagnostic;
