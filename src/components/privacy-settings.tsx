'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Shield, Eye, Database, Download, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface PrivacyConfig {
  shareOnlineStatus: boolean;
  shareTypingStatus: boolean;
  shareLastSeen: boolean;
  allowDirectMessages: boolean;
  allowGroupInvites: boolean;
  enableReadReceipts: boolean;
  collectAnalytics: boolean;
  shareUsageData: boolean;
}

export function PrivacySettings() {
  const [config, setConfig] = useState<PrivacyConfig>({
    shareOnlineStatus: true,
    shareTypingStatus: true,
    shareLastSeen: true,
    allowDirectMessages: true,
    allowGroupInvites: true,
    enableReadReceipts: true,
    collectAnalytics: false,
    shareUsageData: false,
  });

  useEffect(() => {
    const savedConfig = localStorage.getItem('meeshy-privacy-config');
    if (savedConfig) {
      setConfig(JSON.parse(savedConfig));
    }
  }, []);

  const handleConfigChange = (key: keyof PrivacyConfig, value: boolean) => {
    const newConfig = { ...config, [key]: value };
    setConfig(newConfig);
    localStorage.setItem('meeshy-privacy-config', JSON.stringify(newConfig));
    toast.success('Paramètres de confidentialité mis à jour');
  };

  const exportData = () => {
    // Simulation de l'export des données
    const userData = {
      profile: 'Données de profil...',
      messages: 'Données de messages...',
      translations: 'Cache de traduction...',
      settings: 'Paramètres utilisateur...',
    };
    
    const blob = new Blob([JSON.stringify(userData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'meeshy-data-export.json';
    a.click();
    URL.revokeObjectURL(url);
    
    toast.success('Données exportées avec succès');
  };

  const deleteAllData = () => {
    if (confirm('Êtes-vous sûr de vouloir supprimer toutes vos données ? Cette action est irréversible.')) {
      // Simulation de la suppression
      localStorage.clear();
      toast.success('Toutes les données ont été supprimées');
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Visibilité et statut
          </CardTitle>
          <CardDescription>
            Contrôlez les informations que les autres utilisateurs peuvent voir
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>Statut en ligne</Label>
              <p className="text-sm text-muted-foreground">
                Permet aux autres de voir si vous êtes connecté
              </p>
            </div>
            <Switch
              checked={config.shareOnlineStatus}
              onCheckedChange={(checked) => handleConfigChange('shareOnlineStatus', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>Indicateur de frappe</Label>
              <p className="text-sm text-muted-foreground">
                Affiche quand vous êtes en train d&apos;écrire un message
              </p>
            </div>
            <Switch
              checked={config.shareTypingStatus}
              onCheckedChange={(checked) => handleConfigChange('shareTypingStatus', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>Dernière activité</Label>
              <p className="text-sm text-muted-foreground">
                Partage la date de votre dernière connexion
              </p>
            </div>
            <Switch
              checked={config.shareLastSeen}
              onCheckedChange={(checked) => handleConfigChange('shareLastSeen', checked)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Communications</CardTitle>
          <CardDescription>
            Gérez qui peut vous contacter et comment
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>Messages directs</Label>
              <p className="text-sm text-muted-foreground">
                Permet à tous les utilisateurs de vous envoyer des messages
              </p>
            </div>
            <Switch
              checked={config.allowDirectMessages}
              onCheckedChange={(checked) => handleConfigChange('allowDirectMessages', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>Invitations de groupe</Label>
              <p className="text-sm text-muted-foreground">
                Autorise les autres à vous inviter dans des groupes
              </p>
            </div>
            <Switch
              checked={config.allowGroupInvites}
              onCheckedChange={(checked) => handleConfigChange('allowGroupInvites', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>Accusés de réception</Label>
              <p className="text-sm text-muted-foreground">
                Informe les expéditeurs que vous avez lu leurs messages
              </p>
            </div>
            <Switch
              checked={config.enableReadReceipts}
              onCheckedChange={(checked) => handleConfigChange('enableReadReceipts', checked)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Données et analytiques
          </CardTitle>
          <CardDescription>
            Contrôlez la collecte et l&apos;utilisation de vos données
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>Collecte d&apos;analytiques</Label>
              <p className="text-sm text-muted-foreground">
                Permet de collecter des données anonymes pour améliorer l&apos;application
              </p>
            </div>
            <Switch
              checked={config.collectAnalytics}
              onCheckedChange={(checked) => handleConfigChange('collectAnalytics', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>Partage des données d&apos;usage</Label>
              <p className="text-sm text-muted-foreground">
                Partage des statistiques d&apos;utilisation pour la recherche et développement
              </p>
            </div>
            <Switch
              checked={config.shareUsageData}
              onCheckedChange={(checked) => handleConfigChange('shareUsageData', checked)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Gestion des données
          </CardTitle>
          <CardDescription>
            Exportez ou supprimez vos données personnelles
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Exporter mes données</Label>
            <p className="text-sm text-muted-foreground">
              Téléchargez une copie de toutes vos données (profil, messages, paramètres)
            </p>
            <Button
              variant="outline"
              onClick={exportData}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Exporter les données
            </Button>
          </div>

          <div className="space-y-2">
            <Label className="text-red-600">Supprimer toutes mes données</Label>
            <p className="text-sm text-muted-foreground">
              Supprime définitivement toutes vos données. Cette action est irréversible.
            </p>
            <Button
              variant="destructive"
              onClick={deleteAllData}
              className="flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Supprimer mes données
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Informations légales</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Vos données sont traitées conformément à notre politique de confidentialité.
            Les traductions sont effectuées localement sur votre appareil pour protéger votre vie privée.
          </p>
          <div className="flex gap-2">
            <Button variant="link" size="sm" className="h-auto p-0">
              Politique de confidentialité
            </Button>
            <Button variant="link" size="sm" className="h-auto p-0">
              Conditions d&apos;utilisation
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
