'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { buildApiUrl, API_ENDPOINTS } from '@/lib/config';
import { toast } from 'sonner';
import { Link2, Copy, Calendar, Clock } from 'lucide-react';

interface CreateLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLinkCreated: () => void;
}

export function CreateLinkModal({
  isOpen,
  onClose,
  onLinkCreated
}: CreateLinkModalProps) {
  const [linkTitle, setLinkTitle] = useState('');
  const [expirationDays, setExpirationDays] = useState(7);
  const [isCreating, setIsCreating] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);

  const generateLink = async () => {
    if (!linkTitle.trim()) {
      toast.error('Veuillez saisir un titre pour le lien');
      return;
    }

    setIsCreating(true);
    try {
      const token = localStorage.getItem('auth_token');
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expirationDays);

      const response = await fetch(buildApiUrl(API_ENDPOINTS.CONVERSATION.CREATE_LINK), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          title: linkTitle.trim(),
          expiresAt: expiresAt.toISOString()
        })
      });

      if (response.ok) {
        const data = await response.json();
        const linkUrl = `${window.location.origin}/join/${data.link.token}`;
        setGeneratedLink(linkUrl);
        
        // Copier automatiquement dans le presse-papiers
        await navigator.clipboard.writeText(linkUrl);
        toast.success('Lien généré et copié dans le presse-papiers !');
        
        onLinkCreated();
      } else {
        const error = await response.json();
        toast.error(error.message || 'Erreur lors de la génération du lien');
      }
    } catch (error) {
      console.error('Erreur génération lien:', error);
      toast.error('Erreur lors de la génération du lien');
    } finally {
      setIsCreating(false);
    }
  };

  const copyLink = async () => {
    if (generatedLink) {
      await navigator.clipboard.writeText(generatedLink);
      toast.success('Lien copié dans le presse-papiers');
    }
  };

  const handleClose = () => {
    setLinkTitle('');
    setExpirationDays(7);
    setGeneratedLink(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Générer un lien de conversation</DialogTitle>
          <DialogDescription>
            Créez un lien que d&apos;autres personnes peuvent utiliser pour rejoindre une conversation
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {!generatedLink ? (
            <>
              {/* Titre du lien */}
              <div>
                <Label htmlFor="title" className="text-sm font-medium">
                  Titre de la conversation
                </Label>
                <Input
                  id="title"
                  value={linkTitle}
                  onChange={(e) => setLinkTitle(e.target.value)}
                  placeholder="Ex: Discussion générale, Équipe projet..."
                  className="mt-1"
                />
              </div>
              
              {/* Durée d'expiration */}
              <div>
                <Label htmlFor="expiration" className="text-sm font-medium">
                  Expiration (en jours)
                </Label>
                <div className="flex items-center space-x-2 mt-1">
                  <Calendar className="h-4 w-4 text-gray-500" />
                  <Input
                    id="expiration"
                    type="number"
                    min="1"
                    max="365"
                    value={expirationDays}
                    onChange={(e) => setExpirationDays(parseInt(e.target.value) || 7)}
                    className="flex-1"
                  />
                  <span className="text-sm text-gray-500">jour(s)</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  <Clock className="h-3 w-3 inline mr-1" />
                  Le lien expirera le {new Date(Date.now() + expirationDays * 24 * 60 * 60 * 1000).toLocaleDateString()}
                </p>
              </div>
              
              {/* Action de génération */}
              <div className="flex space-x-3 pt-4">
                <Button
                  onClick={generateLink}
                  disabled={!linkTitle.trim() || isCreating}
                  className="flex-1"
                >
                  <Link2 className="mr-2 h-4 w-4" />
                  {isCreating ? 'Génération...' : 'Générer le lien'}
                </Button>
                <Button
                  onClick={handleClose}
                  variant="outline"
                >
                  Annuler
                </Button>
              </div>
            </>
          ) : (
            <>
              {/* Lien généré */}
              <div className="space-y-3">
                <div>
                  <Label className="text-sm font-medium text-green-700">
                    ✅ Lien généré avec succès !
                  </Label>
                  <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm font-medium text-green-900 mb-2">
                      {linkTitle}
                    </p>
                    <div className="flex items-center space-x-2">
                      <Input
                        value={generatedLink}
                        readOnly
                        className="flex-1 text-xs bg-white"
                      />
                      <Button
                        onClick={copyLink}
                        size="sm"
                        variant="outline"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
                
                <div className="text-sm text-gray-600 space-y-1">
                  <p>• Le lien expire dans {expirationDays} jour(s)</p>
                  <p>• Toute personne avec ce lien peut rejoindre la conversation</p>
                  <p>• Vous pouvez partager ce lien par email, SMS, etc.</p>
                </div>
              </div>
              
              {/* Actions finales */}
              <div className="flex space-x-3 pt-4">
                <Button
                  onClick={copyLink}
                  variant="outline"
                  className="flex-1"
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copier à nouveau
                </Button>
                <Button
                  onClick={handleClose}
                  className="flex-1"
                >
                  Fermer
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
