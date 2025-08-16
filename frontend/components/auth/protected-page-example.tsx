'use client';

import { useAuth } from '@/hooks/use-auth';
import { AuthGuard } from '@/components/auth/auth-guard';

/**
 * Exemple de page protégée qui nécessite une authentification complète
 * (pas de sessions anonymes autorisées)
 */
export function ProtectedPageExample() {
  const { user, logout } = useAuth();

  return (
    <AuthGuard requireAuth={true} allowAnonymous={false}>
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow p-6">
            <h1 className="text-2xl font-bold mb-4">Page Protégée</h1>
            
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded">
              <h2 className="font-semibold text-green-800 mb-2">
                Authentification réussie
              </h2>
              <p className="text-green-700">
                Bienvenue, {user?.firstName || user?.displayName || user?.username} !
              </p>
              <p className="text-sm text-green-600 mt-1">
                Cette page nécessite un compte permanent
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="font-medium mb-2">Informations utilisateur :</h3>
                <div className="bg-gray-50 p-3 rounded text-sm">
                  <p><strong>Nom :</strong> {user?.firstName} {user?.lastName}</p>
                  <p><strong>Nom d'utilisateur :</strong> @{user?.username}</p>
                  <p><strong>Email :</strong> {user?.email}</p>
                  <p><strong>Langue :</strong> {user?.systemLanguage}</p>
                </div>
              </div>

              <button
                onClick={logout}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Se déconnecter
              </button>
            </div>
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}

/**
 * Exemple de page qui accepte les sessions anonymes
 */
export function SharedConversationPageExample() {
  const { user, isAnonymous, logout, leaveAnonymousSession } = useAuth();

  const handleLogout = () => {
    if (isAnonymous) {
      leaveAnonymousSession();
    } else {
      logout();
    }
  };

  return (
    <AuthGuard requireAuth={true} allowAnonymous={true}>
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow p-6">
            <h1 className="text-2xl font-bold mb-4">Conversation Partagée</h1>
            
            <div className={`mb-6 p-4 border rounded ${
              isAnonymous 
                ? 'bg-blue-50 border-blue-200' 
                : 'bg-green-50 border-green-200'
            }`}>
              <h2 className={`font-semibold mb-2 ${
                isAnonymous ? 'text-blue-800' : 'text-green-800'
              }`}>
                {isAnonymous ? 'Session Anonyme' : 'Compte Permanent'}
              </h2>
              <p className={isAnonymous ? 'text-blue-700' : 'text-green-700'}>
                Bienvenue, {user?.firstName || user?.displayName || user?.username} !
              </p>
              <p className={`text-sm mt-1 ${
                isAnonymous ? 'text-blue-600' : 'text-green-600'
              }`}>
                {isAnonymous 
                  ? 'Vous participez en tant qu\'invité temporaire'
                  : 'Vous participez avec votre compte permanent'
                }
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="font-medium mb-2">Informations participant :</h3>
                <div className="bg-gray-50 p-3 rounded text-sm">
                  <p><strong>Nom :</strong> {user?.firstName} {user?.lastName}</p>
                  <p><strong>Nom d'utilisateur :</strong> @{user?.username}</p>
                  <p><strong>Type :</strong> {isAnonymous ? 'Invité temporaire' : 'Compte permanent'}</p>
                  {user?.email && (
                    <p><strong>Email :</strong> {user.email}</p>
                  )}
                  <p><strong>Langue :</strong> {user?.systemLanguage}</p>
                </div>
              </div>

              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                {isAnonymous ? 'Quitter la session' : 'Se déconnecter'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}
