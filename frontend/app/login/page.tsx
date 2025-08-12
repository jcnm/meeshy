'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageSquare, LogIn, Eye, EyeOff } from 'lucide-react';
import { buildApiUrl, API_ENDPOINTS } from '@/lib/config';

export default function QuickLoginPage() {
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  // Utilisateurs de test prédéfinis (correspondant aux seeds)
  const testUsers = [
    { username: 'alice@meeshy.com', name: 'Alice Dubois (Admin - Français)' },
    { username: 'bob@meeshy.com', name: 'Bob Johnson (Anglais)' },
    { username: 'carlos@meeshy.com', name: 'Carlos García (Espagnol)' },
    { username: 'dieter@meeshy.com', name: 'Dieter Schmidt (Allemand)' },
    { username: 'li@meeshy.com', name: 'Li Wei (Chinois)' },
    { username: 'yuki@meeshy.com', name: 'Yuki Tanaka (Japonais)' },
    { username: 'maria@meeshy.com', name: 'Maria Silva (Portugais)' }
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.username.trim() || !formData.password.trim()) {
      toast.error('Veuillez remplir tous les champs');
      return;
    }

    setIsLoading(true);
    try {
      console.log('Tentative de connexion:', { username: formData.username });
      
      const response = await fetch(buildApiUrl(API_ENDPOINTS.AUTH.LOGIN), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: formData.username.trim(),
          password: formData.password.trim(),
        }),
      });

      console.log('Statut de la réponse:', response.status);
      const result = await response.json();
      console.log('Résultat de la connexion:', result);

      if (response.ok && result.user && result.access_token) {
        localStorage.setItem('auth_token', result.access_token);
        toast.success(`Connexion réussie ! Bienvenue ${result.user.firstName}`);
        router.push('/dashboard');
      } else {
        toast.error(result.message || 'Erreur de connexion');
      }
    } catch (error) {
      console.error('Erreur de connexion:', error);
      toast.error('Erreur de connexion au serveur');
    } finally {
      setIsLoading(false);
    }
  };

  const quickLogin = async (username: string) => {
    setFormData({ username, password: 'password123' });
    setIsLoading(true);
    
    try {
      const response = await fetch(buildApiUrl(API_ENDPOINTS.AUTH.LOGIN), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username,
          password: 'password123',
        }),
      });

      const result = await response.json();

      if (response.ok && result.user && result.access_token) {
        localStorage.setItem('auth_token', result.access_token);
        toast.success(`Connecté en tant que ${result.user.firstName} !`);
        router.push('/dashboard');
      } else {
        toast.error(result.message || 'Erreur de connexion');
      }
    } catch (error) {
      console.error('Erreur login rapide:', error);
      toast.error('Erreur de connexion');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
              <MessageSquare className="h-6 w-6 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Meeshy</h1>
          <p className="text-gray-600 mt-2">Connectez-vous à votre compte</p>
        </div>

        {/* Informations des comptes de test */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">🧪 Comptes de Test</CardTitle>
            <CardDescription>
              Utilisez ces comptes pour tester Meeshy. Mot de passe pour tous : <code className="bg-gray-100 px-1 rounded text-xs">password123</code>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-gray-600 space-y-1">
              <p><strong>Alice (Admin)</strong> - alice@meeshy.com - Français</p>
              <p><strong>Bob</strong> - bob@meeshy.com - Anglais</p>
              <p><strong>Carlos</strong> - carlos@meeshy.com - Espagnol</p>
              <p><strong>Dieter</strong> - dieter@meeshy.com - Allemand</p>
              <p><strong>Li</strong> - li@meeshy.com - Chinois</p>
              <p><strong>Yuki</strong> - yuki@meeshy.com - Japonais</p>
              <p><strong>Maria</strong> - maria@meeshy.com - Portugais</p>
            </div>
          </CardContent>
        </Card>

        {/* Formulaire de connexion */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <LogIn className="h-5 w-5" />
              <span>Connexion</span>
            </CardTitle>
            <CardDescription>
              Entrez vos identifiants ou utilisez un compte de test
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
                  Nom d&apos;utilisateur ou email
                </label>
                <Input
                  id="username"
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  placeholder="alice@meeshy.com, bob@meeshy.com..."
                  disabled={isLoading}
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Utilisez l'email complet ou cliquez sur "Connexion rapide" ci-dessous
                </p>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  Mot de passe
                </label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="password123"
                    disabled={isLoading}
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Mot de passe de test : <code className="bg-gray-100 px-1 rounded">password123</code>
                </p>
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Connexion...</span>
                  </div>
                ) : (
                  'Se connecter'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Connexion rapide */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Connexion rapide</CardTitle>
            <CardDescription>
              Cliquez sur un utilisateur pour vous connecter automatiquement
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-2">
              {testUsers.map((user) => (
                <Button
                  key={user.username}
                  variant="outline"
                  onClick={() => quickLogin(user.username)}
                  disabled={isLoading}
                  className="justify-start h-auto p-3"
                >
                  <div className="text-left w-full">
                    <p className="font-medium">{user.name}</p>
                    <p className="text-sm text-gray-500">Email: {user.username}</p>
                    <p className="text-xs text-blue-600">Username: {user.username.split('@')[0]}</p>
                  </div>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Info debug */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Info de debug</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-gray-600 space-y-1">
              <p><strong>Backend URL:</strong> {buildApiUrl('')}</p>
              <p><strong>Login endpoint:</strong> {buildApiUrl(API_ENDPOINTS.AUTH.LOGIN)}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
