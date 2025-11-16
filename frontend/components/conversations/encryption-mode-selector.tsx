/**
 * Sélecteur de mode de chiffrement pour la création de conversations
 * Utilisé dans le modal de création de conversation
 */

'use client';

import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Info } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { EncryptionMode } from '@/hooks/use-encryption-preferences';

interface EncryptionModeSelectorProps {
  value: EncryptionMode;
  onChange: (mode: EncryptionMode) => void;
  disabled?: boolean;
}

const MODE_INFO = {
  none: {
    icon: '🔓',
    title: 'Aucun chiffrement',
    description: 'Traduction instantanée, compatibilité maximale',
    color: 'text-gray-600',
  },
  hybrid: {
    icon: '🔐',
    title: 'Chiffrement hybride',
    description: 'Privacy + Traduction serveur (Recommandé)',
    color: 'text-blue-600',
  },
  e2e_only: {
    icon: '🔒',
    title: 'Chiffrement E2E pur',
    description: 'Privacy maximale, pas de traduction serveur',
    color: 'text-green-600',
  },
} as const;

export function EncryptionModeSelector({
  value,
  onChange,
  disabled = false,
}: EncryptionModeSelectorProps) {
  return (
    <div className="space-y-3">
      <div>
        <Label className="text-sm font-medium">Mode de chiffrement</Label>
        <p className="text-xs text-muted-foreground mt-1">
          Le mode de chiffrement ne pourra plus être modifié après la création
        </p>
      </div>

      <RadioGroup
        value={value}
        onValueChange={(val) => onChange(val as EncryptionMode)}
        disabled={disabled}
        className="space-y-2"
      >
        {(Object.keys(MODE_INFO) as EncryptionMode[]).map((mode) => {
          const info = MODE_INFO[mode];
          const isSelected = value === mode;

          return (
            <div
              key={mode}
              className={`flex items-start space-x-3 p-3 border rounded-md cursor-pointer transition-all ${
                isSelected
                  ? 'border-primary bg-primary/5'
                  : 'hover:border-muted-foreground/50'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              onClick={() => !disabled && onChange(mode)}
            >
              <RadioGroupItem value={mode} id={`mode-${mode}`} className="mt-0.5" />
              <div className="flex-1 space-y-1">
                <Label
                  htmlFor={`mode-${mode}`}
                  className="flex items-center gap-2 text-sm font-medium cursor-pointer"
                >
                  <span className="text-base">{info.icon}</span>
                  <span className={isSelected ? info.color : ''}>{info.title}</span>
                  {mode === 'hybrid' && (
                    <span className="text-xs bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full">
                      Recommandé
                    </span>
                  )}
                </Label>
                <p className="text-xs text-muted-foreground">{info.description}</p>
              </div>
            </div>
          );
        })}
      </RadioGroup>

      {value === 'hybrid' && (
        <Alert className="py-2">
          <Info className="h-3 w-3" />
          <AlertDescription className="text-xs">
            Mode hybride: Double chiffrement E2E + serveur. Le serveur peut traduire automatiquement.
          </AlertDescription>
        </Alert>
      )}

      {value === 'e2e_only' && (
        <Alert className="py-2" variant="destructive">
          <Info className="h-3 w-3" />
          <AlertDescription className="text-xs">
            Mode E2E pur: Aucune traduction serveur. Traduction client-side uniquement.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
