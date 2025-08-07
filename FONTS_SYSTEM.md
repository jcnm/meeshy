# 🎨 Système de Polices Configurable - Meeshy

Ce système permet aux utilisateurs de personnaliser la police d'affichage de l'application Meeshy, spécialement optimisé pour les jeunes, enfants d'école multilingue et entreprises multiculturelles.

## 🚀 Fonctionnalités

- **9 polices disponibles** optimisées pour différents publics
- **Sauvegarde automatique** dans les préférences utilisateur (backend)
- **Cache local** pour un chargement rapide
- **Support multilingue** avec prévisualisation
- **Interface intuitive** avec catégorisation des polices
- **Accessibilité** avec polices optimisées pour la lecture

## 📚 Polices Disponibles

### 🌟 Polices Recommandées

| Police | Description | Public cible | Accessibilité |
|--------|-------------|--------------|---------------|
| **Nunito** (Défaut) | Police ronde et amicale | Enfants | ♿ Haute |
| **Inter** | Moderne et lisible | Tous | ♿ Haute |
| **Poppins** | Géométrique populaire | Adolescents | ♿ Haute |
| **Lexend** | Optimisée pour l'éducation | Tous | ♿ Haute |

### 📝 Autres Polices

| Police | Description | Public cible | Accessibilité |
|--------|-------------|--------------|---------------|
| **Open Sans** | Excellente lisibilité | Adultes | ♿ Haute |
| **Lato** | Humaniste et chaleureuse | Tous | ⚠️ Moyenne |
| **Comic Neue** | Version moderne de Comic Sans | Enfants | ⚠️ Moyenne |
| **Roboto** | Police Google moderne | Tous | ♿ Haute |
| **Geist Sans** | Police originale | Adultes | ⚠️ Moyenne |

## 🛠️ Architecture Technique

### Fichiers principaux

```
frontend/
├── lib/fonts.ts                    # Configuration des polices
├── hooks/use-font-preference.ts    # Hook de gestion des préférences
├── components/
│   ├── settings/font-selector.tsx  # Interface de sélection
│   ├── settings/font-preview.tsx   # Prévisualisation
│   └── common/font-initializer.tsx # Initialisation automatique
└── app/
    ├── layout.tsx                  # Configuration globale
    └── api/users/preferences/       # API frontend (fallback)

gateway/
└── src/routes/user-preferences.ts  # API backend principale
```

### Base de données

Les préférences sont stockées dans le modèle `UserPreference` :

```sql
-- Table existante dans schema.prisma
user_preferences (
  id STRING PRIMARY KEY,
  userId STRING REFERENCES users(id),
  key STRING,           -- "font-family"
  value STRING,         -- "nunito", "inter", etc.
  createdAt DATETIME,
  updatedAt DATETIME
)
```

## 🔧 Utilisation

### Dans un composant React

```tsx
import { useFontPreference } from '@/hooks/use-font-preference';

function MyComponent() {
  const { currentFont, changeFontFamily, fontConfig } = useFontPreference();
  
  return (
    <div className={fontConfig?.cssClass}>
      Police actuelle : {fontConfig?.name}
      <button onClick={() => changeFontFamily('nunito')}>
        Changer pour Nunito
      </button>
    </div>
  );
}
```

### Dans les paramètres utilisateur

```tsx
import { FontSelector } from '@/components/settings';

function UserSettings() {
  return (
    <div>
      <FontSelector />
    </div>
  );
}
```

### Classes CSS Tailwind

```tsx
// Utiliser une police spécifique
<div className="font-nunito">Texte avec Nunito</div>
<div className="font-inter">Texte avec Inter</div>
<div className="font-poppins">Texte avec Poppins</div>

// La police est automatiquement appliquée au body
// Tous les éléments héritent de la police sélectionnée
```

## 🔄 Flux de données

1. **Chargement initial** :
   - Hook vérifie localStorage (cache)
   - Récupère depuis l'API backend si connecté
   - Applique la police au document

2. **Changement de police** :
   - Applique immédiatement la nouvelle police
   - Sauvegarde en localStorage (cache)
   - Envoie vers l'API backend (persistance)

3. **Synchronisation** :
   - Backend prioritaire sur localStorage
   - Fallback sur police par défaut (Nunito)

## 🎯 API Endpoints

### Frontend (Next.js API Routes)
```
GET  /api/users/preferences     # Récupérer toutes les préférences
POST /api/users/preferences     # Créer/Mettre à jour une préférence
```

### Backend (Gateway Fastify)
```
GET    /api/users/preferences           # Récupérer toutes les préférences
GET    /api/users/preferences/:key      # Récupérer une préférence spécifique
POST   /api/users/preferences           # Créer/Mettre à jour une préférence
DELETE /api/users/preferences/:key      # Supprimer une préférence
DELETE /api/users/preferences           # Réinitialiser toutes les préférences
```

## 🚀 Déploiement

### Variables d'environnement

```bash
# Frontend (.env.local)
NEXT_PUBLIC_GATEWAY_URL=http://localhost:3001

# Backend (Gateway)
DATABASE_URL="file:./dev.db"
```

### Installation des dépendances

```bash
# Les polices Google Fonts sont déjà incluses
npm install  # Toutes les dépendances sont dans package.json
```

## 🧪 Tests et validation

### Test rapide
1. Ouvrir l'application
2. Aller dans Paramètres > Polices
3. Sélectionner différentes polices
4. Vérifier que le changement s'applique immédiatement
5. Recharger la page pour vérifier la persistance

### Test multilingue
- Vérifier l'affichage avec caractères français, anglais, espagnol, arabe, chinois
- Tester avec emojis et caractères spéciaux

## 💡 Recommandations pédagogiques

### Pour les enfants (6-12 ans)
- **Nunito** : Police par défaut, ronde et amicale
- **Comic Neue** : Familière mais plus professionnelle
- **Lexend** : Optimisée pour l'apprentissage de la lecture

### Pour les adolescents (13-18 ans)
- **Poppins** : Moderne et tendance
- **Inter** : Professionnelle mais accessible
- **Roboto** : Connue des utilisateurs Android

### Pour les adultes/professionnels
- **Inter** : Excellence pour les interfaces
- **Open Sans** : Lisibilité maximale
- **Lato** : Chaleureuse pour la communication

## 🔒 Sécurité

- Validation côté backend des polices autorisées
- Pas d'injection de CSS custom
- Polices servies via Google Fonts (CDN sécurisé)
- Authentication requise pour sauvegarder les préférences

## 🌐 Support multilingue

Les polices sélectionnées supportent :
- Latin (français, anglais, espagnol, allemand, italien...)
- Latin étendu (caractères accentués)
- Emojis et symboles Unicode
- Certaines polices supportent d'autres scripts (vérifier Google Fonts)

---

**Note** : Ce système est conçu pour être extensible. Pour ajouter de nouvelles polices, modifier le fichier `/lib/fonts.ts` et mettre à jour la validation dans l'API backend.
