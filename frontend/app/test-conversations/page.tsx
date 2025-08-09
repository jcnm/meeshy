'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface User {
  id: string;
  username: string;
  displayName: string | null;
  email: string;
}

interface Conversation {
  id: string;
  title: string;
  description?: string;
  type: string;
  unreadCount?: number;
}

export default function ConversationsTestPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function testAuth() {
      try {
        console.log('🧪 Test d\'authentification...');
        
        // 1. Vérifier localStorage
        const savedUser = localStorage.getItem('user');
        const token = localStorage.getItem('auth_token');
        
        console.log('💾 LocalStorage - User:', savedUser ? 'présent' : 'absent');
        console.log('💾 LocalStorage - Token:', token ? 'présent' : 'absent');
        
        if (!token) {
          // Authentification automatique
          console.log('🔐 Authentification automatique...');
          
          const authResponse = await fetch('http://localhost:3000/auth/login', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              email: 'admin@meeshy.com',
              password: 'password123'
            })
          });

          const authData = await authResponse.json();
          
          if (authData.success && authData.access_token) {
            console.log('✅ Authentification réussie');
            localStorage.setItem('auth_token', authData.access_token);
            localStorage.setItem('user', JSON.stringify(authData.user));
            setUser(authData.user);
          } else {
            throw new Error('Échec authentification: ' + authData.message);
          }
        } else {
          // Utiliser le token existant
          if (savedUser) {
            setUser(JSON.parse(savedUser));
          }
        }
        
        // 2. Récupérer les conversations
        console.log('📥 Récupération des conversations...');
        
        const currentToken = localStorage.getItem('auth_token');
        const convResponse = await fetch('http://localhost:3000/conversations', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${currentToken}`
          }
        });

        const convData = await convResponse.json();
        
        if (convData.success && convData.data) {
          console.log(`✅ ${convData.data.length} conversations récupérées`);
          setConversations(convData.data);
        } else {
          throw new Error('Échec récupération conversations: ' + convData.message);
        }
        
      } catch (err) {
        console.error('❌ Erreur:', err);
        setError(err instanceof Error ? err.message : 'Erreur inconnue');
      } finally {
        setLoading(false);
      }
    }
    
    testAuth();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement des conversations...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-red-600 text-lg font-semibold">Erreur</div>
          <p className="mt-2 text-gray-600">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Test Conversations</h1>
      
      {user && (
        <div className="mb-6 p-4 bg-green-100 rounded">
          <h2 className="font-semibold">Utilisateur connecté:</h2>
          <p>{user.displayName || user.username} ({user.email})</p>
        </div>
      )}
      
      <div className="mb-4">
        <h2 className="text-xl font-semibold">Conversations ({conversations.length})</h2>
      </div>
      
      {conversations.length === 0 ? (
        <p className="text-gray-600">Aucune conversation trouvée.</p>
      ) : (
        <div className="space-y-4">
          {conversations.map((conv) => (
            <div key={conv.id} className="p-4 border rounded-lg hover:shadow-md cursor-pointer"
                 onClick={() => router.push(`/conversations/${conv.id}`)}>
              <h3 className="font-semibold">{conv.title}</h3>
              <p className="text-sm text-gray-600">{conv.description || 'Pas de description'}</p>
              <div className="text-xs text-gray-500 mt-2">
                Type: {conv.type} | Messages non lus: {conv.unreadCount || 0}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
