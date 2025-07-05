'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Palette, Monitor, Sun, Moon } from 'lucide-react';
import { toast } from 'sonner';

interface ThemeConfig {
  theme: 'light' | 'dark' | 'system';
  accentColor: string;
  fontSize: 'small' | 'medium' | 'large';
  compactMode: boolean;
  animationsEnabled: boolean;
}

export function ThemeSettings() {
  const [config, setConfig] = useState<ThemeConfig>({
    theme: 'system',
    accentColor: 'blue',
    fontSize: 'medium',
    compactMode: false,
    animationsEnabled: true,
  });

  useEffect(() => {
    const savedConfig = localStorage.getItem('meeshy-theme-config');
    if (savedConfig) {
      setConfig(JSON.parse(savedConfig));
    }
  }, []);

  const handleConfigChange = (key: keyof ThemeConfig, value: string | boolean) => {
    const newConfig = { ...config, [key]: value };
    setConfig(newConfig);
    localStorage.setItem('meeshy-theme-config', JSON.stringify(newConfig));
    toast.success('Thème mis à jour');
  };

  const accentColors = [
    { value: 'blue', label: 'Bleu', color: 'bg-blue-500' },
    { value: 'green', label: 'Vert', color: 'bg-green-500' },
    { value: 'purple', label: 'Violet', color: 'bg-purple-500' },
    { value: 'red', label: 'Rouge', color: 'bg-red-500' },
    { value: 'orange', label: 'Orange', color: 'bg-orange-500' },
    { value: 'pink', label: 'Rose', color: 'bg-pink-500' },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Thème et couleurs
          </CardTitle>
          <CardDescription>
            Personnalisez l&apos;apparence de l&apos;application
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Mode d&apos;affichage</Label>
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant={config.theme === 'light' ? 'default' : 'outline'}
                onClick={() => handleConfigChange('theme', 'light')}
                className="flex items-center gap-2"
              >
                <Sun className="h-4 w-4" />
                Clair
              </Button>
              <Button
                variant={config.theme === 'dark' ? 'default' : 'outline'}
                onClick={() => handleConfigChange('theme', 'dark')}
                className="flex items-center gap-2"
              >
                <Moon className="h-4 w-4" />
                Sombre
              </Button>
              <Button
                variant={config.theme === 'system' ? 'default' : 'outline'}
                onClick={() => handleConfigChange('theme', 'system')}
                className="flex items-center gap-2"
              >
                <Monitor className="h-4 w-4" />
                Système
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Couleur d&apos;accent</Label>
            <div className="grid grid-cols-3 gap-2">
              {accentColors.map((color) => (
                <Button
                  key={color.value}
                  variant={config.accentColor === color.value ? 'default' : 'outline'}
                  onClick={() => handleConfigChange('accentColor', color.value)}
                  className="flex items-center gap-2"
                >
                  <div className={`w-3 h-3 rounded-full ${color.color}`} />
                  {color.label}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Interface utilisateur</CardTitle>
          <CardDescription>
            Options d&apos;affichage et de comportement
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Taille de police</Label>
            <Select
              value={config.fontSize}
              onValueChange={(value) => handleConfigChange('fontSize', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="small">Petite</SelectItem>
                <SelectItem value="medium">Moyenne</SelectItem>
                <SelectItem value="large">Grande</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>Mode compact</Label>
              <p className="text-sm text-muted-foreground">
                Réduit l&apos;espacement pour afficher plus de contenu
              </p>
            </div>
            <Switch
              checked={config.compactMode}
              onCheckedChange={(checked) => handleConfigChange('compactMode', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>Animations</Label>
              <p className="text-sm text-muted-foreground">
                Active les transitions et animations de l&apos;interface
              </p>
            </div>
            <Switch
              checked={config.animationsEnabled}
              onCheckedChange={(checked) => handleConfigChange('animationsEnabled', checked)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Aperçu</CardTitle>
          <CardDescription>
            Prévisualisation des paramètres appliqués
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="p-4 border rounded-lg bg-muted/50">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className={`font-medium ${config.fontSize === 'small' ? 'text-sm' : config.fontSize === 'large' ? 'text-lg' : 'text-base'}`}>
                  Exemple de message
                </span>
                <span className="text-xs text-muted-foreground">12:34</span>
              </div>
              <p className={`text-muted-foreground ${config.fontSize === 'small' ? 'text-xs' : config.fontSize === 'large' ? 'text-base' : 'text-sm'}`}>
                Ceci est un aperçu de l&apos;apparence des messages avec vos paramètres actuels.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
