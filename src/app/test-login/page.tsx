'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/context/AppContext';

export default function TestLoginPage() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const { setUser, user } = useUser();
  const router = useRouter();

  // Auto-login au chargement si pas d'utilisateur
  useEffect(() => {
    if (!user && !loading) {
      login();
    }
  }, [user, loading]);

  const login = async () => {
    setLoading(true);
    setMessage('Connexion automatique...');

    try {
      const response = await fetch('http://localhost:3000/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username: 'Alice Martin',
          password: 'password123'
        })
      });

      const data = await response.json();

      if (data.access_token) {
        localStorage.setItem('auth_token', data.access_token);
        localStorage.setItem('user', JSON.stringify(data.user));
        setUser(data.user);
        setMessage('Connexion réussie! Redirection vers les conversations...');
        
        setTimeout(() => {
          router.push('/conversations');
        }, 1000);
      } else {
        setMessage('Erreur de connexion: ' + JSON.stringify(data));
      }
    } catch (error) {
      setMessage('Erreur: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
    setUser(null);
    setMessage('Déconnecté');
  };

  const checkAuth = () => {
    const token = localStorage.getItem('auth_token');
    const storedUser = localStorage.getItem('user');
    setMessage(`Token: ${token ? 'Présent' : 'Absent'} | User: ${storedUser ? 'Présent' : 'Absent'} | Context User: ${user ? user.username : 'Absent'}`);
  };

  const goToConversations = () => {
    router.push('/conversations');
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full">
        <h1 className="text-2xl font-bold mb-6 text-center">Test Authentification Meeshy</h1>
        
        {user && (
          <div className="mb-4 p-3 bg-green-100 rounded text-sm">
            Connecté en tant que: {user.username}
          </div>
        )}
        
        <div className="space-y-4">
          <button 
            onClick={login} 
            disabled={loading}
            className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
          >
            {loading ? 'Connexion...' : 'Se connecter en tant qu&apos;Alice Martin'}
          </button>
          
          <button 
            onClick={logout}
            className="w-full px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          >
            Se déconnecter
          </button>
          
          <button 
            onClick={checkAuth}
            className="w-full px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Vérifier l&apos;état d&apos;authentification
          </button>
          
          <button 
            onClick={goToConversations}
            className="w-full px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            Aller aux conversations
          </button>
        </div>
        
        {message && (
          <div className="mt-4 p-3 bg-gray-100 rounded text-sm">
            {message}
          </div>
        )}
      </div>
    </div>
  );
}
