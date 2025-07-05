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
    <div className="space-y-4 sm:space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <Palette className="h-4 w-4 sm:h-5 sm:w-5" />
            Thème et couleurs
          </CardTitle>
          <CardDescription className="text-sm sm:text-base">
            Personnalisez l&apos;apparence de l&apos;application
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 sm:space-y-6">
          <div className="space-y-2">
            <Label className="text-sm sm:text-base">Mode d&apos;affichage</Label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <Button
                variant={config.theme === 'light' ? 'default' : 'outline'}
                onClick={() => handleConfigChange('theme', 'light')}
                className="flex items-center gap-2 justify-center sm:justify-start"
              >
                <Sun className="h-4 w-4" />
                <span className="text-sm sm:text-base">Clair</span>
              </Button>
              <Button
                variant={config.theme === 'dark' ? 'default' : 'outline'}
                onClick={() => handleConfigChange('theme', 'dark')}
                className="flex items-center gap-2 justify-center sm:justify-start"
              >
                <Moon className="h-4 w-4" />
                <span className="text-sm sm:text-base">Sombre</span>
              </Button>
              <Button
                variant={config.theme === 'system' ? 'default' : 'outline'}
                onClick={() => handleConfigChange('theme', 'system')}
                className="flex items-center gap-2 justify-center sm:justify-start"
              >
                <Monitor className="h-4 w-4" />
                <span className="text-sm sm:text-base">Système</span>
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm sm:text-base">Couleur d&apos;accent</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {accentColors.map((color) => (
                <Button
                  key={color.value}
                  variant={config.accentColor === color.value ? 'default' : 'outline'}
                  onClick={() => handleConfigChange('accentColor', color.value)}
                  className="flex items-center gap-2 justify-center sm:justify-start text-sm"
                >
                  <div className={`w-3 h-3 rounded-full ${color.color}`} />
                  <span className="hidden sm:inline">{color.label}</span>
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg sm:text-xl">Interface utilisateur</CardTitle>
          <CardDescription className="text-sm sm:text-base">
            Options d&apos;affichage et de comportement
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 sm:space-y-6">
          <div className="space-y-2">
            <Label className="text-sm sm:text-base">Taille de police</Label>
            <Select
              value={config.fontSize}
              onValueChange={(value) => handleConfigChange('fontSize', value)}
            >
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="small">Petite</SelectItem>
                <SelectItem value="medium">Moyenne</SelectItem>
                <SelectItem value="large">Grande</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1 flex-1">
              <Label className="text-sm sm:text-base">Mode compact</Label>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Réduit l&apos;espacement pour afficher plus de contenu
              </p>
            </div>
            <Switch
              checked={config.compactMode}
              onCheckedChange={(checked) => handleConfigChange('compactMode', checked)}
            />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1 flex-1">
              <Label className="text-sm sm:text-base">Animations</Label>
              <p className="text-xs sm:text-sm text-muted-foreground">
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
          <CardTitle className="text-lg sm:text-xl">Aperçu</CardTitle>
          <CardDescription className="text-sm sm:text-base">
            Prévisualisation des paramètres appliqués
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="p-3 sm:p-4 border rounded-lg bg-muted/50">
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
