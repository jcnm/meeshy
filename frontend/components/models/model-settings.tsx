'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function ModelSettings() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>⚙️ Paramètres de Modèles</CardTitle>
        <CardDescription>Configuration en cours de mise à jour</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">
          Cette interface sera bientôt mise à jour pour utiliser la nouvelle architecture unifiée des modèles.
        </p>
      </CardContent>
    </Card>
  );
}
