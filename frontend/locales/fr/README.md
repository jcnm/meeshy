# Structure des Traductions Françaises

Ce répertoire contient les traductions françaises organisées par fonctionnalité et type de composant.

## Organisation des Fichiers

### Fichiers Principaux
- **`common.json`** - Traductions communes utilisées dans toute l'application (boutons, erreurs, validation, noms de langues, navigation)
- **`auth.json`** - Traductions liées à l'authentification (connexion, inscription, rejoindre une conversation)
- **`landing.json`** - Traductions de la page d'accueil (hero, fonctionnalités, mission, CTA)

### Fichiers Spécifiques aux Pages
- **`dashboard.json`** - Traductions de la page tableau de bord (statistiques, actions, actions rapides)
- **`conversations.json`** - Gestion des conversations et communautés
- **`settings.json`** - Traductions de la page paramètres (profil, paramètres de traduction, thème)
- **`pages.json`** - Pages statiques (à propos, contact, partenaires, page introuvable)

### Fichiers de Composants
- **`components.json`** - Composants UI (affiliation, en-tête, sélecteur de langue, mise en page, toasts, flux de bulles)
- **`modals.json`** - Boîtes de dialogue modales (modal de création de lien, résumé de lien, chat anonyme)
- **`features.json`** - Fonctionnalités spécialisées (page de chat, gestionnaires d'erreur, recherche, gestion de conversation)

### Fichiers Légaux
- **`legal.json`** - Documents légaux (politique de confidentialité, conditions d'utilisation)

## Utilisation

### Importer des Fichiers Individuels
```typescript
import { common } from './locales/fr/common.json';
import { auth } from './locales/fr/auth.json';
```

### Importer Toutes les Traductions
```typescript
import translations from './locales/fr';
// ou
import { common, auth, landing } from './locales/fr';
```

## Structure des Clés de Traduction

Chaque fichier maintient la structure imbriquée originale du fichier principal `fr.json`. Par exemple :

```json
// common.json
{
  "common": {
    "loading": "Chargement...",
    "save": "Enregistrer"
  },
  "languageNames": {
    "en": "Anglais",
    "fr": "Français"
  }
}
```

## Avantages de cette Structure

1. **Modularité** - Charger seulement les traductions nécessaires
2. **Maintenabilité** - Plus facile de trouver et mettre à jour des traductions spécifiques
3. **Collaboration d'équipe** - Différents membres de l'équipe peuvent travailler sur différents fichiers
4. **Performance** - Tailles de bundle plus petites lors de l'utilisation du code splitting
5. **Organisation** - Séparation claire des responsabilités

## Tailles des Fichiers

- `common.json` - Traductions principales utilisées partout
- `auth.json` - Flux d'authentification
- `landing.json` - Contenu marketing et page d'accueil
- `dashboard.json` - Interface du tableau de bord
- `conversations.json` - Gestion du chat et des conversations
- `settings.json` - Préférences utilisateur et configuration
- `pages.json` - Pages d'information statiques
- `components.json` - Composants UI réutilisables
- `modals.json` - Contenu des dialogues et modales
- `features.json` - Fonctionnalités avancées et gestion d'erreurs
- `legal.json` - Politique de confidentialité et conditions d'utilisation

## Notes de Migration

Cette structure remplace le fichier unique `fr.json` tout en maintenant toutes les clés et valeurs de traduction originales. Le fichier `index.ts` fournit une rétrocompatibilité en exportant toutes les traductions comme un seul objet.
