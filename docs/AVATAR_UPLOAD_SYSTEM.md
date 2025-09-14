# Système d'Upload d'Avatar

## Vue d'ensemble

Le système d'upload d'avatar de Meeshy utilise une approche simple et efficace où les images sont stockées localement dans le frontend et les URLs sont sauvegardées dans la base de données.

## Architecture

### Frontend (Next.js)
- **Upload local** : Les images sont sauvegardées dans `frontend/public/i/p/<year>/<month>/`
- **API Route** : `/api/upload/avatar` gère l'upload des fichiers
- **Validation** : Vérification du type et de la taille des fichiers

### Backend (Gateway)
- **Stockage URL** : Seule l'URL de l'image est sauvegardée en base de données
- **Validation** : Accepte les URLs HTTP/HTTPS et les data URLs (base64)

## Structure des dossiers

```
frontend/public/i/p/
├── .gitkeep
├── 2024/
│   ├── 01/
│   │   ├── avatar_1640995200000_abc123.jpg
│   │   └── avatar_1640995201000_def456.png
│   └── 02/
│       └── avatar_1643673600000_ghi789.webp
└── 2025/
    └── 01/
        └── avatar_1735689600000_jkl012.jpg
```

## Format des URLs

Les URLs générées suivent le format :
```
<protocol>://<domaine>/i/p/<year>/<month>/<filename>
```

Exemples :
- `http://localhost:3000/i/p/2024/12/avatar_1640995200000_abc123.jpg`
- `https://meeshy.com/i/p/2025/01/avatar_1735689600000_def456.png`

## Processus d'upload

### 1. Sélection du fichier
- L'utilisateur sélectionne une image via l'interface
- Validation côté client (type, taille)

### 2. Upload vers Next.js
- Le fichier est envoyé à `/api/upload/avatar`
- Création automatique des dossiers si nécessaire
- Génération d'un nom de fichier unique

### 3. Mise à jour en base
- L'URL de l'image est envoyée à l'API backend
- Sauvegarde de l'URL dans la colonne `avatar` de l'utilisateur

## Validation des fichiers

### Types acceptés
- `image/jpeg`
- `image/jpg`
- `image/png`
- `image/webp`

### Contraintes
- Taille maximale : 5MB
- Formats supportés : JPEG, PNG, WebP

## Sécurité

### Frontend
- Validation stricte des types de fichiers
- Limitation de la taille des uploads
- Noms de fichiers uniques (timestamp + random)

### Backend
- Validation des URLs reçues
- Support des URLs HTTP/HTTPS et data URLs
- Authentification requise pour les mises à jour

## Utilisation

### Composant UserSettings
```typescript
// Sélection d'un fichier
const handleAvatarSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
  const file = event.target.files?.[0];
  if (file) {
    const validation = validateAvatarFile(file);
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }
    // ... traitement du fichier
  }
};

// Upload de l'avatar
const handleAvatarUpload = async () => {
  // 1. Upload vers Next.js
  const formData = new FormData();
  formData.append('avatar', selectedFile);
  
  const uploadResponse = await fetch('/api/upload/avatar', {
    method: 'POST',
    body: formData
  });
  
  // 2. Mise à jour en base
  const imageUrl = uploadData.data.url;
  await fetch('/api/users/me/avatar', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ avatar: imageUrl })
  });
};
```

### API Backend
```typescript
// Schéma de validation
const updateAvatarSchema = z.object({
  avatar: z.string().refine(
    (data) => {
      return data.startsWith('http://') || 
             data.startsWith('https://') || 
             data.startsWith('data:image/');
    },
    'Invalid avatar format'
  )
});
```

## Avantages

1. **Simplicité** : Pas de service de stockage externe nécessaire
2. **Performance** : Images servies directement par Next.js
3. **Organisation** : Structure de dossiers claire par date
4. **Sécurité** : Validation stricte des fichiers
5. **Compatibilité** : Support des anciens avatars base64

## Migration

Le système est rétrocompatible avec les avatars existants stockés en base64. Les nouveaux uploads utiliseront automatiquement le nouveau système d'URLs.

## Maintenance

### Nettoyage des fichiers
- Les anciens avatars peuvent être supprimés manuellement
- Considérer l'implémentation d'un système de nettoyage automatique

### Monitoring
- Surveiller l'espace disque utilisé
- Logs des uploads pour le debugging

## Tests

Un script de test est disponible : `test-avatar-upload.js`

```bash
node test-avatar-upload.js
```

Ce script vérifie :
- La structure des dossiers
- La génération de noms de fichiers
- La génération d'URLs
- La validation des fichiers
