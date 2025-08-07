/**
 * Configuration des polices disponibles pour Meeshy
 * Optimisées pour jeunes, enfants d'école multilingue et entreprises multiculturelles
 */

import { 
  Inter, 
  Nunito, 
  Poppins, 
  Open_Sans, 
  Lato,
  Comic_Neue,
  Lexend,
  Roboto,
  Geist,
  Geist_Mono
} from "next/font/google";

// Configuration des polices principales (optimisée pour le build)
export const interFont = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: 'swap',
  preload: true,
});

export const nunitoFont = Nunito({
  subsets: ["latin"],
  variable: "--font-nunito",
  display: 'swap',
  preload: true,
});

export const poppinsFont = Poppins({
  subsets: ["latin"],
  variable: "--font-poppins",
  weight: ["400", "500", "600"],
  display: 'swap',
  preload: false,
});

export const openSansFont = Open_Sans({
  subsets: ["latin"],
  variable: "--font-open-sans",
  display: 'swap',
  preload: false,
});

export const latoFont = Lato({
  subsets: ["latin"],
  variable: "--font-lato",
  weight: ["400", "700"],
  display: 'swap',
  preload: false,
});

export const comicNeueFont = Comic_Neue({
  subsets: ["latin"],
  variable: "--font-comic-neue",
  weight: ["400", "700"],
  display: 'swap',
  preload: false,
});

export const lexendFont = Lexend({
  subsets: ["latin"],
  variable: "--font-lexend",
  display: 'swap',
  preload: false,
});

export const robotoFont = Roboto({
  subsets: ["latin"],
  variable: "--font-roboto",
  weight: ["400", "500", "700"],
  display: 'swap',
  preload: false,
});

// Polices existantes (fallback)
export const geistSansFont = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: 'swap',
  preload: false,
});

export const geistMonoFont = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: 'swap',
  preload: false,
});

// Types et configuration
export type FontFamily = 
  | 'inter'
  | 'nunito'
  | 'poppins'
  | 'open-sans'
  | 'lato'
  | 'comic-neue'
  | 'lexend'
  | 'roboto'
  | 'geist-sans'
  | 'geist-mono';

export interface FontConfig {
  id: FontFamily;
  name: string;
  description: string;
  category: 'modern' | 'friendly' | 'professional' | 'educational' | 'technical';
  variable: string;
  cssClass: string;
  recommended: boolean;
  ageGroup: 'kids' | 'teens' | 'adults' | 'all';
  accessibility: 'high' | 'medium' | 'low';
}

export const availableFonts: FontConfig[] = [
  {
    id: 'inter',
    name: 'Inter',
    description: 'Police moderne et lisible, parfaite pour les interfaces',
    category: 'modern',
    variable: '--font-inter',
    cssClass: 'font-inter',
    recommended: true,
    ageGroup: 'all',
    accessibility: 'high',
  },
  {
    id: 'nunito',
    name: 'Nunito',
    description: 'Police ronde et amicale, idéale pour les jeunes',
    category: 'friendly',
    variable: '--font-nunito',
    cssClass: 'font-nunito',
    recommended: true,
    ageGroup: 'kids',
    accessibility: 'high',
  },
  {
    id: 'poppins',
    name: 'Poppins',
    description: 'Police géométrique moderne très populaire',
    category: 'modern',
    variable: '--font-poppins',
    cssClass: 'font-poppins',
    recommended: true,
    ageGroup: 'teens',
    accessibility: 'high',
  },
  {
    id: 'lexend',
    name: 'Lexend',
    description: 'Optimisée pour la lecture et l\'éducation',
    category: 'educational',
    variable: '--font-lexend',
    cssClass: 'font-lexend',
    recommended: true,
    ageGroup: 'all',
    accessibility: 'high',
  },
  {
    id: 'open-sans',
    name: 'Open Sans',
    description: 'Excellente lisibilité, support multilingue',
    category: 'professional',
    variable: '--font-open-sans',
    cssClass: 'font-open-sans',
    recommended: false,
    ageGroup: 'adults',
    accessibility: 'high',
  },
  {
    id: 'lato',
    name: 'Lato',
    description: 'Police humaniste et chaleureuse',
    category: 'friendly',
    variable: '--font-lato',
    cssClass: 'font-lato',
    recommended: false,
    ageGroup: 'all',
    accessibility: 'medium',
  },
  {
    id: 'comic-neue',
    name: 'Comic Neue',
    description: 'Version moderne et professionnelle de Comic Sans',
    category: 'friendly',
    variable: '--font-comic-neue',
    cssClass: 'font-comic-neue',
    recommended: false,
    ageGroup: 'kids',
    accessibility: 'medium',
  },
  {
    id: 'roboto',
    name: 'Roboto',
    description: 'Police Google, moderne et claire',
    category: 'modern',
    variable: '--font-roboto',
    cssClass: 'font-roboto',
    recommended: false,
    ageGroup: 'all',
    accessibility: 'high',
  },
  {
    id: 'geist-sans',
    name: 'Geist Sans',
    description: 'Police par défaut originale',
    category: 'technical',
    variable: '--font-geist-sans',
    cssClass: 'font-geist-sans',
    recommended: false,
    ageGroup: 'adults',
    accessibility: 'medium',
  }
];

// Police par défaut pour les jeunes
export const defaultFont: FontFamily = 'nunito';

// Fonction pour obtenir la configuration d'une police
export function getFontConfig(fontId: FontFamily): FontConfig | undefined {
  return availableFonts.find(font => font.id === fontId);
}

// Fonction pour obtenir les variables CSS de toutes les polices
export function getAllFontVariables(): string {
  return [
    interFont.variable,
    nunitoFont.variable,
    poppinsFont.variable,
    openSansFont.variable,
    latoFont.variable,
    comicNeueFont.variable,
    lexendFont.variable,
    robotoFont.variable,
    geistSansFont.variable,
    geistMonoFont.variable,
  ].join(' ');
}

// Fonction pour obtenir les polices recommandées par groupe d'âge
export function getRecommendedFonts(ageGroup?: 'kids' | 'teens' | 'adults' | 'all'): FontConfig[] {
  if (!ageGroup) {
    return availableFonts.filter(font => font.recommended);
  }
  
  return availableFonts.filter(font => 
    font.recommended && (font.ageGroup === ageGroup || font.ageGroup === 'all')
  );
}
