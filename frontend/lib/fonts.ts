/**
 * Configuration des polices optimisée - Next.js 15 compatible
 * Toutes les polices sont créées au niveau module comme exigé par Next.js
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

// Toutes les instances de polices créées au niveau module
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: 'swap',
  preload: false,
});

const nunito = Nunito({
  subsets: ["latin"],
  variable: "--font-nunito",
  display: 'swap',
  preload: true, // Police par défaut préchargée
});

const poppins = Poppins({
  subsets: ["latin"],
  variable: "--font-poppins",
  weight: ["400", "500", "600"],
  display: 'swap',
  preload: false,
});

const openSans = Open_Sans({
  subsets: ["latin"],
  variable: "--font-open-sans",
  display: 'swap',
  preload: false,
});

const lato = Lato({
  subsets: ["latin"],
  variable: "--font-lato",
  weight: ["400", "700"],
  display: 'swap',
  preload: false,
});

const comicNeue = Comic_Neue({
  subsets: ["latin"],
  variable: "--font-comic-neue",
  weight: ["400", "700"],
  display: 'swap',
  preload: false,
});

const lexend = Lexend({
  subsets: ["latin"],
  variable: "--font-lexend",
  display: 'swap',
  preload: false,
});

const roboto = Roboto({
  subsets: ["latin"],
  variable: "--font-roboto",
  weight: ["400", "500", "700"],
  display: 'swap',
  preload: false,
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: 'swap',
  preload: false,
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: 'swap',
  preload: false,
});

// Police par défaut - Nunito (la plus utilisée pour les jeunes)
export const defaultFont = nunito;

// Map des polices pour accès facile
const fontInstances = {
  'inter': inter,
  'nunito': nunito,
  'poppins': poppins,
  'open-sans': openSans,
  'lato': lato,
  'comic-neue': comicNeue,
  'lexend': lexend,
  'roboto': roboto,
  'geist-sans': geistSans,
  'geist-mono': geistMono,
} as const;

// Fonction pour obtenir l'instance d'une police
export const getFontInstance = (fontId: FontFamily) => {
  return fontInstances[fontId] || nunito;
};

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

// Fonction pour obtenir la configuration d'une police
export function getFontConfig(fontId: FontFamily): FontConfig | undefined {
  return availableFonts.find(font => font.id === fontId);
}

// Fonction optimisée pour obtenir uniquement la variable de la police active
export function getFontVariable(fontId?: FontFamily): string {
  if (!fontId) {
    return nunito.variable;
  }
  
  const fontInstance = getFontInstance(fontId);
  return fontInstance.variable;
}

// Fonction pour obtenir la classe CSS de la police active
export function getFontClassName(fontId?: FontFamily): string {
  if (!fontId) {
    return 'font-nunito'; // classe par défaut
  }
  
  return `font-${fontId}`;
}

// Fonction pour obtenir toutes les variables de polices (pour le layout)
export function getAllFontVariables(): string {
  return Object.values(fontInstances)
    .map(font => font.variable)
    .join(' ');
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

// Export des instances spécifiques pour usage direct
export { inter, nunito, poppins, openSans, lato, comicNeue, lexend, roboto, geistSans, geistMono };