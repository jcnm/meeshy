/**
 * Paramètres de chiffrement et sécurité MLS
 * Permet à l'utilisateur de configurer ses préférences de chiffrement
 */

'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Lock, Shield, Info, AlertCircle } from 'lucide-react';
import { useEncryptionPreferences, type EncryptionMode } from '@/hooks/use-encryption-preferences';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

const ENCRYPTION_MODE_INFO = {
  none: {
    icon: '🔓',
    title: 'Aucun chiffrement',
    description: 'Traduction instantanée, compatibilité maximale. Pas de chiffrement E2E.',
    recommended: false,
  },
  hybrid: {
    icon: '🔐',
    title: 'Chiffrement hybride (Recommandé)',
    description: 'Privacy + Traduction serveur. Le serveur peut déchiffrer temporairement pour traduire.',
    recommended: true,
  },
  e2e_only: {
    icon: '🔒',
    title: 'Chiffrement E2E pur',
    description: 'Privacy maximale. Le serveur ne peut jamais déchiffrer. Pas de traduction serveur.',
    recommended: false,
  },
} as const;

export function EncryptionSettings() {
  const { preferences, loading, updatePreferences } = useEncryptionPreferences();

  const handleModeChange = async (mode: EncryptionMode) => {
    try {
      await updatePreferences({ defaultEncryptionMode: mode });
    } catch (error) {
      // Error already handled by hook
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Chiffrement et sécurité
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Chargement...</p>
        </CardContent>
      </Card>
    );
  }

  const isServerTranslationEnabled = preferences?.allowServerSideTranslationAt !== null;
  const defaultMode = preferences?.defaultEncryptionMode || 'hybrid';

  return (
    <div className="space-y-4 sm:space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <Lock className="h-4 w-4 sm:h-5 sm:w-5" />
            Chiffrement et sécurité
          </CardTitle>
          <CardDescription className="text-sm sm:text-base">
            Configurez vos préférences de chiffrement pour les nouvelles conversations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Autorisation traduction serveur - Coché par défaut, NON MODIFIABLE */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-4 border rounded-lg bg-muted/50">
            <div className="space-y-1 flex-1">
              <Label className="text-sm sm:text-base flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Autoriser traduction serveur
              </Label>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Permet au serveur de déchiffrer temporairement pour traduire vos messages (mode hybride)
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                ℹ️ Cette fonctionnalité sera activable après l'implémentation des traductions côté client
              </p>
            </div>
            <Switch
              checked={true}
              disabled={true}
              className="opacity-50 cursor-not-allowed"
            />
          </div>

          {/* Info DMA */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-xs sm:text-sm">
              <strong>Conformité DMA (Digital Markets Act)</strong><br />
              Meeshy implémente le chiffrement de bout en bout (E2E) pour assurer l'interopérabilité
              avec WhatsApp, Messenger et iMessage tout en respectant votre vie privée.
            </AlertDescription>
          </Alert>

          {/* Sélection mode de chiffrement par défaut */}
          <div className="space-y-4">
            <div>
              <Label className="text-base font-semibold">Mode de chiffrement par défaut</Label>
              <p className="text-sm text-muted-foreground mt-1">
                Choisissez le niveau de chiffrement pour vos nouvelles conversations
              </p>
            </div>

            <RadioGroup
              value={defaultMode}
              onValueChange={(value) => handleModeChange(value as EncryptionMode)}
              className="space-y-3"
            >
              {(Object.keys(ENCRYPTION_MODE_INFO) as EncryptionMode[]).map((mode) => {
                const info = ENCRYPTION_MODE_INFO[mode];
                return (
                  <div
                    key={mode}
                    className={`flex items-start space-x-3 p-4 border rounded-lg cursor-pointer transition-all ${
                      defaultMode === mode
                        ? 'border-primary bg-primary/5'
                        : 'hover:border-muted-foreground/50'
                    }`}
                    onClick={() => handleModeChange(mode)}
                  >
                    <RadioGroupItem value={mode} id={mode} className="mt-1" />
                    <div className="flex-1 space-y-1">
                      <Label
                        htmlFor={mode}
                        className="flex items-center gap-2 font-medium cursor-pointer"
                      >
                        <span className="text-xl">{info.icon}</span>
                        {info.title}
                        {info.recommended && (
                          <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                            Recommandé
                          </span>
                        )}
                      </Label>
                      <p className="text-sm text-muted-foreground">{info.description}</p>
                    </div>
                  </div>
                );
              })}
            </RadioGroup>
          </div>

          {/* Warning pour E2E pur */}
          {defaultMode === 'e2e_only' && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs sm:text-sm">
                <strong>Attention:</strong> En mode E2E pur, le serveur ne pourra pas traduire vos messages.
                Vous devrez gérer la traduction manuellement côté client.
              </AlertDescription>
            </Alert>
          )}

          {/* Info mode hybride */}
          {defaultMode === 'hybrid' && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="text-xs sm:text-sm">
                <strong>Mode hybride:</strong> Vos messages sont chiffrés de bout en bout (E2E),
                puis re-chiffrés avec une clé serveur. Le serveur peut déchiffrer temporairement
                pour traduire, puis supprime le plaintext de la mémoire (secure wipe).
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
