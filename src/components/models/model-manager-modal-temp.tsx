'use client';

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface ModelManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ModelManagerModal({ isOpen, onClose }: ModelManagerModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>🚧 Gestionnaire de Modèles (En Maintenance)</DialogTitle>
        </DialogHeader>
        <div className="p-4 text-center">
          <p className="text-muted-foreground">
            Cette interface sera bientôt mise à jour pour utiliser la nouvelle architecture unifiée des modèles.
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            En attendant, les modèles de traduction fonctionnent automatiquement avec fallback API.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
