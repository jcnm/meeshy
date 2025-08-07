/**
 * Composant de sélection de police pour les paramètres utilisateur
 */

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Palette, RotateCcw, Check } from "lucide-react";
import { useFontPreference } from '@/hooks/use-font-preference';
import { availableFonts, FontFamily, getRecommendedFonts } from '@/lib/fonts';

interface FontSelectorProps {
  className?: string;
}

export function FontSelector({ className }: FontSelectorProps) {
  const { 
    currentFont, 
    changeFontFamily, 
    resetToDefault, 
    isLoading, 
    error, 
    fontConfig 
  } = useFontPreference();

  const recommendedFonts = getRecommendedFonts();
  const otherFonts = availableFonts.filter(font => !font.recommended);

  const handleFontChange = (fontId: FontFamily) => {
    changeFontFamily(fontId);
  };

  const FontCard = ({ font }: { font: typeof availableFonts[0] }) => {
    const isSelected = currentFont === font.id;
    
    return (
      <Card 
        className={`cursor-pointer transition-all duration-200 hover:shadow-md ${
          isSelected ? 'ring-2 ring-primary shadow-md' : 'hover:ring-1 hover:ring-muted-foreground'
        }`}
        onClick={() => handleFontChange(font.id)}
      >
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className={`font-medium ${font.cssClass}`} style={{ fontFamily: `var(${font.variable})` }}>
              {font.name}
            </h4>
            {isSelected && <Check className="h-4 w-4 text-primary" />}
          </div>
          
          <p className={`text-sm text-muted-foreground mb-3 ${font.cssClass}`} 
             style={{ fontFamily: `var(${font.variable})` }}>
            {font.description}
          </p>
          
          <div className="flex flex-wrap gap-1 mb-3">
            <Badge variant={font.category === 'friendly' ? 'default' : 'secondary'} className="text-xs">
              {font.category === 'modern' && '🚀 Moderne'}
              {font.category === 'friendly' && '😊 Amical'}
              {font.category === 'professional' && '💼 Pro'}
              {font.category === 'educational' && '📚 Éducatif'}
              {font.category === 'technical' && '⚡ Tech'}
            </Badge>
            
            <Badge variant="outline" className="text-xs">
              {font.ageGroup === 'kids' && '👶 Enfants'}
              {font.ageGroup === 'teens' && '🧑‍🎓 Ados'}
              {font.ageGroup === 'adults' && '👨‍💼 Adultes'}
              {font.ageGroup === 'all' && '👥 Tous'}
            </Badge>
            
            {font.accessibility === 'high' && (
              <Badge variant="outline" className="text-xs text-green-600">
                ♿ Accessible
              </Badge>
            )}
          </div>
          
          {/* Exemple de texte avec la police */}
          <div className={`text-lg ${font.cssClass}`} 
               style={{ fontFamily: `var(${font.variable})` }}>
            <p>Bonjour ! Hello! ¡Hola!</p>
            <p className="text-sm text-muted-foreground mt-1">
              Les messages se traduisent automatiquement
            </p>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            <CardTitle>Police d'affichage</CardTitle>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={resetToDefault}
            className="flex items-center gap-1"
          >
            <RotateCcw className="h-3 w-3" />
            Par défaut
          </Button>
        </div>
        <CardDescription>
          Choisissez la police qui s'affiche dans toute l'application. 
          Police actuelle : <span className="font-medium">{fontConfig?.name}</span>
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {error && (
          <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
            {error}
          </div>
        )}

        {/* Polices recommandées */}
        <div>
          <Label className="text-base font-medium mb-3 block">
            🌟 Polices recommandées
          </Label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recommendedFonts.map((font) => (
              <FontCard key={font.id} font={font} />
            ))}
          </div>
        </div>

        {/* Autres polices */}
        <div>
          <Label className="text-base font-medium mb-3 block">
            📝 Autres polices disponibles
          </Label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {otherFonts.map((font) => (
              <FontCard key={font.id} font={font} />
            ))}
          </div>
        </div>

        {/* Info */}
        <div className="p-4 rounded-lg bg-muted/50">
          <p className="text-sm text-muted-foreground">
            💡 <strong>Astuce :</strong> Les polices marquées "Accessible" sont optimisées pour la lisibilité.
            Les polices "Amical" sont parfaites pour les jeunes utilisateurs.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
