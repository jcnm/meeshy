'use client';

import { useUser } from '@/context/AppContext';

export default function AuthStatusPage() {
  const { user, isAuthChecking } = useUser();

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full">
        <h1 className="text-2xl font-bold mb-6 text-center">Statut d&apos;authentification</h1>
        
        <div className="space-y-4">
          <div className="p-4 bg-gray-50 rounded">
            <h3 className="font-semibold">isAuthChecking:</h3>
            <p>{isAuthChecking ? 'true' : 'false'}</p>
          </div>
          
          <div className="p-4 bg-gray-50 rounded">
            <h3 className="font-semibold">User:</h3>
            <p>{user ? JSON.stringify(user, null, 2) : 'null'}</p>
          </div>
          
          <div className="p-4 bg-gray-50 rounded">
            <h3 className="font-semibold">localStorage auth_token:</h3>
            <p>{typeof window !== 'undefined' && localStorage.getItem('auth_token') ? 'Présent' : 'Absent'}</p>
          </div>
          
          <div className="p-4 bg-gray-50 rounded">
            <h3 className="font-semibold">localStorage user:</h3>
            <p>{typeof window !== 'undefined' && localStorage.getItem('user') ? 'Présent' : 'Absent'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
