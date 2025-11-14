'use client';

import React, { useState } from 'react';
import { usePrivacyMode } from '@/hooks/use-privacy-mode';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff, Shield, AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';

/**
 * Toggle pour activer/désactiver le mode de confidentialité
 * Affiche une confirmation avant de désactiver le mode privacy
 */
export const PrivacyToggle: React.FC = () => {
  const { isPrivacyMode, togglePrivacyMode, setPrivacyMode } = usePrivacyMode();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const handleToggle = () => {
    if (isPrivacyMode) {
      // Demander confirmation avant de désactiver
      setShowConfirmDialog(true);
    } else {
      // Réactiver directement
      togglePrivacyMode();
    }
  };

  const handleConfirmDisable = () => {
    setPrivacyMode(false);
    setShowConfirmDialog(false);
  };

  return (
    <>
      <Button
        variant={isPrivacyMode ? 'default' : 'outline'}
        size="sm"
        onClick={handleToggle}
        className="flex items-center gap-2"
      >
        {isPrivacyMode ? (
          <>
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">Mode sécurisé</span>
          </>
        ) : (
          <>
            <EyeOff className="h-4 w-4" />
            <span className="hidden sm:inline">Données visibles</span>
          </>
        )}
      </Button>

      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Afficher les données sensibles ?
            </DialogTitle>
            <DialogDescription className="space-y-3 pt-4">
              <p>
                Vous êtes sur le point de désactiver le mode de confidentialité.
                Les informations suivantes seront visibles :
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Noms complets des utilisateurs</li>
                <li>Adresses email</li>
                <li>Informations de profil</li>
                <li>Données personnelles identifiables</li>
              </ul>
              <div className="bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800 rounded-lg p-3 mt-4">
                <p className="text-sm text-orange-800 dark:text-orange-200 font-medium">
                  ⚠️ Attention aux captures d'écran
                </p>
                <p className="text-xs text-orange-700 dark:text-orange-300 mt-1">
                  Assurez-vous que personne ne peut voir votre écran et évitez de partager
                  des captures d'écran contenant des données sensibles.
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              Annuler
            </Button>
            <Button variant="default" onClick={handleConfirmDisable}>
              <Eye className="h-4 w-4 mr-2" />
              Afficher les données
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

/**
 * Indicateur visuel du mode privacy (pour la header)
 */
export const PrivacyModeIndicator: React.FC = () => {
  const { isPrivacyMode } = usePrivacyMode();

  return (
    <Badge
      variant={isPrivacyMode ? 'default' : 'outline'}
      className={isPrivacyMode ? 'bg-green-600 hover:bg-green-700' : 'border-orange-300 text-orange-600'}
    >
      {isPrivacyMode ? (
        <>
          <Shield className="h-3 w-3 mr-1" />
          <span className="hidden md:inline">Sécurisé</span>
        </>
      ) : (
        <>
          <AlertTriangle className="h-3 w-3 mr-1" />
          <span className="hidden md:inline">Données visibles</span>
        </>
      )}
    </Badge>
  );
};
