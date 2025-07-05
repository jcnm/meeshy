# Spécifications complètes des modèles de traduction

Ce document détaille tous les variants des modèles MT5 et NLLB supportés par Meeshy, avec leurs caractéristiques techniques, coûts énergétiques et codes couleur.

## 🎯 Vue d'ensemble

Meeshy supporte **11 variants** de modèles de traduction automatique, répartis en deux familles principales :
- **5 variants MT5** (Google) - Optimisés pour messages courts et simples
- **6 variants NLLB** (Meta) - Optimisés pour messages longs et 200+ langues

## 🟢 Famille MT5 (Multilingual Text-to-Text Transfer Transformer)

### MT5_SMALL - Le plus léger
- **Paramètres :** 300M
- **Mémoire requise :** 600 MB
- **Consommation :** 0.015 Wh/traduction
- **CO2 :** 8 mg/traduction
- **Temps d'inférence :** 150ms
- **Couleur bordure :** `#22c55e` (Vert - très efficace)
- **Qualité :** Bonne
- **Usage recommandé :** Messages très courts, machines limitées

### MT5_BASE - Équilibré
- **Paramètres :** 580M
- **Mémoire requise :** 1.2 GB
- **Consommation :** 0.035 Wh/traduction
- **CO2 :** 18 mg/traduction
- **Temps d'inférence :** 280ms
- **Couleur bordure :** `#84cc16` (Vert clair - efficace)
- **Qualité :** Élevée
- **Usage recommandé :** Messages courts, usage quotidien

### MT5_LARGE - Haute qualité
- **Paramètres :** 1.2B
- **Mémoire requise :** 2.4 GB
- **Consommation :** 0.075 Wh/traduction
- **CO2 :** 39 mg/traduction
- **Temps d'inférence :** 450ms
- **Couleur bordure :** `#eab308` (Jaune - moyen)
- **Qualité :** Excellente
- **Usage recommandé :** Messages moyens, qualité importante

### MT5_XL - Très haute performance
- **Paramètres :** 3.7B
- **Mémoire requise :** 4.8 GB
- **Consommation :** 0.15 Wh/traduction
- **CO2 :** 78 mg/traduction
- **Temps d'inférence :** 750ms
- **Couleur bordure :** `#f97316` (Orange - coûteux)
- **Qualité :** Premium
- **Usage recommandé :** Traductions critiques, machines puissantes

### MT5_XXL - Recherche/Production
- **Paramètres :** 13B
- **Mémoire requise :** 11 GB
- **Consommation :** 0.32 Wh/traduction
- **CO2 :** 167 mg/traduction
- **Temps d'inférence :** 1.6s
- **Couleur bordure :** `#dc2626` (Rouge - très coûteux)
- **Qualité :** Premium
- **Usage recommandé :** Recherche, production critique

## 🔵 Famille NLLB (No Language Left Behind)

### NLLB_200M - Ultra-léger
- **Paramètres :** 200M
- **Mémoire requise :** 400 MB
- **Consommation :** 0.008 Wh/traduction
- **CO2 :** 4 mg/traduction
- **Temps d'inférence :** 120ms
- **Couleur bordure :** `#16a34a` (Vert foncé - ultra efficace)
- **Qualité :** Basique
- **Usage recommandé :** Machines très limitées, aperçu rapide

### NLLB_DISTILLED_600M - Optimisé
- **Paramètres :** 600M (distillé)
- **Mémoire requise :** 800 MB
- **Consommation :** 0.022 Wh/traduction
- **CO2 :** 11 mg/traduction
- **Temps d'inférence :** 200ms
- **Couleur bordure :** `#22c55e` (Vert - très efficace)
- **Qualité :** Élevée
- **Usage recommandé :** Meilleur rapport qualité/performance

### NLLB_DISTILLED_1_3B - Équilibré distillé
- **Paramètres :** 1.3B (distillé)
- **Mémoire requise :** 1.3 GB
- **Consommation :** 0.045 Wh/traduction
- **CO2 :** 23 mg/traduction
- **Temps d'inférence :** 300ms
- **Couleur bordure :** `#84cc16` (Vert clair - efficace)
- **Qualité :** Excellente
- **Usage recommandé :** Messages longs, qualité élevée optimisée

### NLLB_1_3B - Standard
- **Paramètres :** 1.3B
- **Mémoire requise :** 1.5 GB
- **Consommation :** 0.055 Wh/traduction
- **CO2 :** 29 mg/traduction
- **Temps d'inférence :** 350ms
- **Couleur bordure :** `#a3a3a3` (Gris - neutre)
- **Qualité :** Excellente
- **Usage recommandé :** Version non-optimisée de 1.3B

### NLLB_3_3B - Haute performance
- **Paramètres :** 3.3B
- **Mémoire requise :** 3.3 GB
- **Consommation :** 0.125 Wh/traduction
- **CO2 :** 65 mg/traduction
- **Temps d'inférence :** 650ms
- **Couleur bordure :** `#f59e0b` (Orange - coûteux)
- **Qualité :** Premium
- **Usage recommandé :** Traductions complexes, langues rares

### NLLB_54B - Recherche avancée
- **Paramètres :** 54B
- **Mémoire requise :** 54 GB
- **Consommation :** 1.2 Wh/traduction
- **CO2 :** 624 mg/traduction
- **Temps d'inférence :** 5s
- **Couleur bordure :** `#991b1b` (Rouge foncé - extrêmement coûteux)
- **Qualité :** Premium
- **Usage recommandé :** Recherche, traductions ultra-précises

## 🎨 Code couleur par efficacité

### 🟢 Très efficace (Vert)
- `#16a34a` - Ultra efficace (NLLB_200M)
- `#22c55e` - Très efficace (MT5_SMALL, NLLB_DISTILLED_600M)
- `#84cc16` - Efficace (MT5_BASE, NLLB_DISTILLED_1_3B)

### 🟡 Moyen (Jaune)
- `#eab308` - Moyen (MT5_LARGE)

### 🟠 Coûteux (Orange)
- `#f97316` - Coûteux (MT5_XL)
- `#f59e0b` - Coûteux (NLLB_3_3B)

### 🔴 Très coûteux (Rouge)
- `#dc2626` - Très coûteux (MT5_XXL)
- `#991b1b` - Extrêmement coûteux (NLLB_54B)

### ⚪ Neutre (Gris)
- `#a3a3a3` - Neutre (NLLB_1_3B)

## 📊 Logique de sélection automatique

Le système sélectionne automatiquement le meilleur modèle selon :

### Critères de base :
1. **Longueur du message**
   - < 50 caractères : MT5 variants
   - ≥ 50 caractères : NLLB variants

2. **Complexité détectée**
   - Texte simple : modèles plus légers
   - Texte complexe : modèles plus lourds

3. **Capacités machine**
   - RAM disponible
   - Type d'appareil (mobile/desktop/workstation)
   - Vitesse de connexion

### Recommandations par profil :
- **Mobile/tablette :** NLLB_200M, MT5_SMALL
- **Laptop standard :** NLLB_DISTILLED_600M, MT5_BASE
- **Desktop puissant :** NLLB_DISTILLED_1_3B, MT5_LARGE
- **Workstation :** NLLB_3_3B, MT5_XL
- **Serveur/recherche :** NLLB_54B, MT5_XXL

## ⚡ Impact environnemental

### Équivalences énergétiques (par 1000 traductions) :
- **NLLB_200M :** 8 Wh = 0.67 charges de smartphone
- **MT5_SMALL :** 15 Wh = 1.25 charges de smartphone
- **NLLB_DISTILLED_600M :** 22 Wh = 1.83 charges de smartphone
- **MT5_BASE :** 35 Wh = 2.92 charges de smartphone
- **NLLB_DISTILLED_1_3B :** 45 Wh = 3.75 charges de smartphone
- **NLLB_1_3B :** 55 Wh = 4.58 charges de smartphone
- **MT5_LARGE :** 75 Wh = 6.25 charges de smartphone
- **NLLB_3_3B :** 125 Wh = 10.42 charges de smartphone
- **MT5_XL :** 150 Wh = 12.5 charges de smartphone
- **MT5_XXL :** 320 Wh = 26.67 charges de smartphone
- **NLLB_54B :** 1200 Wh = 100 charges de smartphone

### Équivalences CO2 (par 1000 traductions) :
- **NLLB_200M :** 4g = 0.033km en voiture
- **MT5_SMALL :** 8g = 0.067km en voiture
- **NLLB_DISTILLED_600M :** 11g = 0.092km en voiture
- **MT5_BASE :** 18g = 0.15km en voiture
- **NLLB_DISTILLED_1_3B :** 23g = 0.192km en voiture
- **NLLB_1_3B :** 29g = 0.242km en voiture
- **MT5_LARGE :** 39g = 0.325km en voiture
- **NLLB_3_3B :** 65g = 0.542km en voiture
- **MT5_XL :** 78g = 0.65km en voiture
- **MT5_XXL :** 167g = 1.392km en voiture
- **NLLB_54B :** 624g = 5.2km en voiture

## 🔧 Intégration technique

### Interface TypeScript :
```typescript
export type TranslationModelType = 
  | 'MT5_SMALL' | 'MT5_BASE' | 'MT5_LARGE' | 'MT5_XL' | 'MT5_XXL'
  | 'NLLB_200M' | 'NLLB_DISTILLED_600M' | 'NLLB_DISTILLED_1_3B' 
  | 'NLLB_1_3B' | 'NLLB_3_3B' | 'NLLB_54B';
```

### Rendu des bordures :
Chaque message traduit affiche une bordure droite colorée selon le modèle utilisé, permettant une identification visuelle immédiate du coût énergétique.

### Statistiques en temps réel :
L'interface de configuration affiche :
- Usage par modèle
- Consommation totale
- Impact CO2 cumulé
- Coût équivalent en charges de smartphone/km de voiture

---

*Dernière mise à jour : Juillet 2025*
*Version du système : 1.3.0*
