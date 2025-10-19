# Système de Partage Meeshy

## Vue d'ensemble

Le système de partage Meeshy permet de générer des aperçus riches (Open Graph et Twitter Cards) pour tous les types de liens partagés, notamment les liens d'affiliation comme `https://meeshy.me/signin?affiliate=aff_1760728104767_u3qrp5u4pld`.

## Architecture

### 1. API de Métadonnées (`/api/metadata`)
- **Endpoint**: `GET /api/metadata`
- **Paramètres**:
  - `type`: Type de lien (`affiliate`, `conversation`, `join`, `default`)
  - `affiliate`: Token d'affiliation (pour les liens d'affiliation)
  - `linkId`: Identifiant du lien (pour les conversations)
- **Retour**: Métadonnées JSON pour Open Graph et Twitter Cards

### 2. Métadonnées Dynamiques par Page

#### Page d'Inscription (`/signin`)
- Génère automatiquement des métadonnées personnalisées pour les liens d'affiliation
- Utilise les informations de l'utilisateur qui invite (nom, avatar)
- Fallback vers des métadonnées par défaut si le token est invalide

#### Page de Jointure (`/join/[linkId]`)
- Récupère les informations de la conversation partagée
- Génère des métadonnées basées sur le titre et la description de la conversation
- Support pour les conversations publiques et privées

### 3. Composants de Partage

#### `SharePreview`
- Composant pour prévisualiser l'aperçu de partage
- Affiche une carte sociale simulée
- Boutons de partage et copie

#### `ShareButton`
- Bouton de partage simple avec options
- Support pour l'API Web Share native
- Fallback vers la copie dans le presse-papiers

### 4. Utilitaires (`lib/share-utils.ts`)
- Fonctions pour générer des liens de partage
- Validation des tokens et liens
- Gestion des métadonnées

## Types de Liens Supportés

### 1. Liens d'Affiliation
```
https://meeshy.me/signin?affiliate=aff_1760728104767_u3qrp5u4pld
```
- **Métadonnées**: Titre personnalisé avec le nom de l'invitant
- **Image**: Avatar de l'invitant ou image par défaut
- **Description**: Message d'invitation personnalisé

### 2. Liens de Conversation
```
https://meeshy.me/join/mshy_conversation_id
```
- **Métadonnées**: Titre de la conversation
- **Image**: Image spécifique aux conversations
- **Description**: Description de la conversation

### 3. Liens de Jointure
```
https://meeshy.me/join/link_id
```
- **Métadonnées**: Informations de la conversation
- **Image**: Image d'invitation
- **Description**: Message d'invitation générique

## Images Open Graph

Le système utilise des images optimisées de 1200x630px pour chaque type de lien :

- `meeshy-og-default.jpg` - Page d'accueil et liens génériques
- `meeshy-og-affiliate.jpg` - Liens d'affiliation
- `meeshy-og-conversation.jpg` - Conversations partagées
- `meeshy-og-join.jpg` - Liens de jointure
- `meeshy-og-signin.jpg` - Page d'inscription

## Configuration

### Variables d'Environnement
```env
NEXT_PUBLIC_FRONTEND_URL=https://meeshy.me
NEXT_PUBLIC_BACKEND_URL=https://gate.meeshy.me
```

### Génération des Images
```bash
# Générer les images Open Graph
./frontend/scripts/generate-og-images.sh
```

## Utilisation

### 1. Partage Simple
```tsx
import { ShareButton } from '@/components/common/share-button';

<ShareButton 
  options={{
    type: 'affiliate',
    affiliateToken: 'aff_1760728104767_u3qrp5u4pld'
  }}
/>
```

### 2. Prévisualisation
```tsx
import { SharePreview } from '@/components/common/share-preview';

<SharePreview 
  url="https://meeshy.me/signin?affiliate=aff_1760728104767_u3qrp5u4pld"
  type="affiliate"
  affiliateToken="aff_1760728104767_u3qrp5u4pld"
/>
```

### 3. Génération de Métadonnées
```tsx
import { generateShareMetadata } from '@/lib/share-utils';

const metadata = await generateShareMetadata({
  type: 'affiliate',
  affiliateToken: 'aff_1760728104767_u3qrp5u4pld'
});
```

## Test des Liens

### 1. Outils de Test
- **Facebook**: https://developers.facebook.com/tools/debug/
- **Twitter**: https://cards-dev.twitter.com/validator
- **LinkedIn**: https://www.linkedin.com/post-inspector/
- **WhatsApp**: Partage direct pour test

### 2. Test Local
```bash
# Démarrer le serveur de développement
pnpm dev

# Tester l'API de métadonnées
curl "http://localhost:3000/api/metadata?type=affiliate&affiliate=aff_1760728104767_u3qrp5u4pld"
```

## Optimisations

### 1. Cache
- Métadonnées mises en cache pendant 5 minutes
- Images optimisées et compressées
- CDN pour les images statiques

### 2. Performance
- Génération asynchrone des métadonnées
- Fallback rapide en cas d'erreur
- Images pré-générées pour les cas courants

### 3. SEO
- Métadonnées complètes Open Graph et Twitter Cards
- URLs canoniques
- Support multilingue (locale: fr_FR)

## Maintenance

### 1. Mise à Jour des Images
- Modifier le script `generate-og-images.sh`
- Régénérer les images avec les nouvelles couleurs/styles
- Tester sur les différents réseaux sociaux

### 2. Ajout de Nouveaux Types
1. Ajouter le type dans `ShareLinkOptions`
2. Créer la fonction de génération dans l'API
3. Ajouter les métadonnées dans les layouts
4. Créer l'image Open Graph correspondante

### 3. Monitoring
- Surveiller les erreurs de génération de métadonnées
- Tester régulièrement les liens sur les réseaux sociaux
- Vérifier la validité des tokens d'affiliation
