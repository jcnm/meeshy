'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function QuickTestPage() {
  const router = useRouter();

  useEffect(() => {
    // Auto-login et redirection
    const autoLogin = async () => {
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
          
          // Redirection immédiate vers conversations
          window.location.href = '/conversations';
        }
      } catch (error) {
        console.error('Erreur:', error);
      }
    };

    autoLogin();
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500 mx-auto"></div>
        <p className="mt-4 text-lg">Connexion automatique et redirection...</p>
      </div>
    </div>
  );
}
