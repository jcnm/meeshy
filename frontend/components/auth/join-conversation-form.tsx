'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { buildApiUrl } from '@/lib/config';

interface JoinConversationFormProps {
  onSuccess: (linkId: string) => void;
}

export function JoinConversationForm({ onSuccess }: JoinConversationFormProps) {
  const [linkId, setLinkId] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!linkId.trim()) {
      toast.error('Veuillez entrer un lien de conversation');
      return;
    }

    setIsLoading(true);
    try {
      // Extraire l'ID du lien s'il s'agit d'une URL complète
      const extractedLinkId = linkId.includes('/') 
        ? linkId.split('/').pop() || linkId
        : linkId.trim();

      // Vérifier si le lien existe
      const response = await fetch(buildApiUrl(`conversation/link/${extractedLinkId}`));
      
      if (response.ok) {
        const result = await response.json();
        if (result && result.id) {
          toast.success('Lien valide ! Redirection...');
          onSuccess(extractedLinkId);
        } else {
          toast.error('Lien de conversation invalide');
        }
      } else {
        toast.error('Lien de conversation invalide ou expiré');
      }
    } catch (error) {
      console.error('Erreur vérification lien:', error);
      toast.error('Erreur de vérification du lien');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="linkId">Lien de conversation</Label>
        <Input
          id="linkId"
          type="text"
          placeholder="Collez le lien ici ou entrez l'ID"
          value={linkId}
          onChange={(e) => setLinkId(e.target.value)}
          disabled={isLoading}
          required
        />
      </div>

      <Button 
        type="submit" 
        className="w-full" 
        disabled={isLoading || !linkId.trim()}
      >
        {isLoading ? 'Vérification...' : 'Rejoindre la conversation'}
      </Button>
    </form>
  );
}
