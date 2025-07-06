'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function ModelManager() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>🚧 Gestionnaire de Modèles</CardTitle>
        <CardDescription>Interface en cours de mise à jour</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">
          Cette interface sera bientôt mise à jour pour utiliser la nouvelle architecture unifiée des modèles.
          En attendant, les modèles de traduction fonctionnent automatiquement avec fallback API.
        </p>
      </CardContent>
    </Card>
  );
}
