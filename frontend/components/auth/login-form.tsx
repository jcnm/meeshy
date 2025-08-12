'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { User } from '@/types';
import { buildApiUrl, API_ENDPOINTS } from '@/lib/config';

interface LoginFormProps {
  onSuccess: (user: User, token: string) => void;
}

export function LoginForm({ onSuccess }: LoginFormProps) {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.username.trim() || !formData.password.trim()) {
      toast.error('Veuillez remplir tous les champs');
      return;
    }

    setIsLoading(true);
    try {
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

      const result = await response.json();

      if (response.ok && result.user && result.access_token) {
        toast.success('Connexion réussie !');
        onSuccess(result.user, result.access_token);
      } else {
        toast.error(result.message || 'Erreur de connexion');
      }
    } catch (error) {
      console.error('Erreur login:', error);
      toast.error('Erreur de connexion');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="username">Nom d&apos;utilisateur</Label>
        <Input
          id="username"
          type="text"
          placeholder="testuser ou alice.martin@email.com"
          value={formData.username}
          onChange={(e) => setFormData({ ...formData, username: e.target.value })}
          disabled={isLoading}
          required
        />
        <p className="text-xs text-gray-500">
          Comptes de test : alice_fr, bob_en, carlos_es, dieter_de, li_zh, yuki_ja, maria_pt
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Mot de passe</Label>
        <Input
          id="password"
          type="password"
          placeholder="password123"
          value={formData.password}
          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          disabled={isLoading}
          required
        />
        <p className="text-xs text-gray-500">
          Mot de passe pour tous les comptes : <code className="bg-gray-100 px-1 rounded">password123</code>
        </p>
      </div>

      <Button 
        type="submit" 
        className="w-full" 
        disabled={isLoading}
      >
        {isLoading ? 'Connexion...' : 'Se connecter'}
      </Button>
    </form>
  );
}
