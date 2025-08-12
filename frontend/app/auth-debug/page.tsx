'use client';

import { useState, useEffect } from 'react';
import { buildApiUrl } from '@/lib/runtime-urls';

export default function AuthDebugPage() {
  const [status, setStatus] = useState<string>('Initializing...');
  const [userFromStorage, setUserFromStorage] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);
  const [apiResponse, setApiResponse] = useState<any>(null);

  useEffect(() => {
    async function debugAuth() {
      try {
        // 1. Check localStorage
        const savedUser = localStorage.getItem('user');
        const savedToken = localStorage.getItem('auth_token');
        
        setStatus('Checking localStorage...');
        setUserFromStorage(savedUser ? JSON.parse(savedUser) : null);
        setToken(savedToken);
        
        if (!savedToken) {
          setStatus('No token found, attempting auto-login...');
          
          // Automatic login
          const loginResponse = await fetch(buildApiUrl('/auth/login'), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              username: 'alice@meeshy.com',
              password: 'password123'
            })
          });

          const loginData = await loginResponse.json();
          
          if (loginData.success && loginData.access_token) {
            localStorage.setItem('auth_token', loginData.access_token);
            localStorage.setItem('user', JSON.stringify(loginData.user));
            setToken(loginData.access_token);
            setUserFromStorage(loginData.user);
            setStatus('Auto-login successful');
          } else {
            setStatus('Auto-login failed: ' + loginData.message);
            return;
          }
        }

        // 2. Test /auth/me endpoint
        setStatus('Testing /auth/me endpoint...');
        const currentToken = localStorage.getItem('auth_token');
        
        const meResponse = await fetch(buildApiUrl('/auth/me'), {
          headers: {
            'Authorization': `Bearer ${currentToken}`
          }
        });

        const meData = await meResponse.json();
        setApiResponse(meData);
        
        if (meResponse.ok) {
          setStatus('✅ Authentication working correctly');
        } else {
          setStatus('❌ /auth/me failed: ' + meData.message);
        }

      } catch (error) {
        setStatus('❌ Error: ' + (error instanceof Error ? error.message : 'Unknown error'));
      }
    }

    debugAuth();
  }, []);

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">Authentication Debug</h1>
      
      <div className="space-y-4">
        <div className="p-4 border rounded">
          <h2 className="font-semibold">Status</h2>
          <p>{status}</p>
        </div>

        <div className="p-4 border rounded">
          <h2 className="font-semibold">Token</h2>
          <p className="break-all">{token || 'None'}</p>
        </div>

        <div className="p-4 border rounded">
          <h2 className="font-semibold">User from localStorage</h2>
          <pre className="text-sm overflow-auto">
            {userFromStorage ? JSON.stringify(userFromStorage, null, 2) : 'None'}
          </pre>
        </div>

        <div className="p-4 border rounded">
          <h2 className="font-semibold">/auth/me Response</h2>
          <pre className="text-sm overflow-auto">
            {apiResponse ? JSON.stringify(apiResponse, null, 2) : 'None'}
          </pre>
        </div>

        <div className="space-x-4">
          <button 
            onClick={() => window.location.href = '/conversations'}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Go to Conversations
          </button>

          <button 
            onClick={() => {
              localStorage.clear();
              window.location.reload();
            }}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Clear Storage & Reload
          </button>
        </div>
      </div>
    </div>
  );
}
