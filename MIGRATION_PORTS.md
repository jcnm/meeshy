# Migration des Ports - Résumé des Changements

## 🎯 Objectif
Normalisation des ports pour éviter les conflits et centraliser la configuration.

## 📝 Changements Effectués

### Nouveaux Ports
- **Frontend Next.js** : `3000` → `3200`
- **Backend NestJS** : `3002` → `3100`
- **Prisma Studio** : `5555` (inchangé)

### 🔧 Configuration Centralisée
Création de `/src/lib/config.ts` pour centraliser toutes les URLs :

```typescript
export const APP_CONFIG = {
  FRONTEND_URL: process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3200',
  BACKEND_URL: process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3100',
  // ...
};

export const API_ENDPOINTS = {
  AUTH: { LOGIN: '/auth/login', REGISTER: '/auth/register', ME: '/auth/me' },
  CONVERSATION: { CREATE: '/conversation', JOIN: '/conversation/join' },
  // ...
};
```

### 📂 Fichiers Modifiés

#### Backend
- `backend/src/main.ts` - Port changé vers 3100
- `backend/.env.example` - Nouvelle configuration

#### Frontend - Configuration
- `package.json` - Scripts dev et start avec `-p 3200`
- `src/lib/config.ts` - **NOUVEAU** fichier de configuration centralisée
- `.env.example` - **NOUVEAU** fichier d'environnement

#### Frontend - Composants d'authentification
- `src/components/auth/login-form.tsx`
- `src/components/auth/register-form.tsx`
- `src/components/auth/join-conversation-form.tsx`

#### Frontend - Pages
- `src/app/page.tsx`
- `src/app/dashboard/page.tsx`
- `src/app/chat/[id]/page.tsx`
- `src/app/join/[linkId]/page.tsx`
- `src/app/groups/page.tsx`
- `src/app/groups/[id]/page.tsx`

#### Frontend - Services et Hooks
- `src/lib/websocket-service.ts`
- `src/lib/socket.service.ts`
- `src/hooks/use-online-presence.ts`
- `src/hooks/use-notifications.ts`

#### Frontend - API Routes
- `src/app/api/conversation/route.ts`
- `src/app/api/conversation/join/route.ts`
- `src/app/api/conversation/link/[linkId]/route.ts`
- `src/app/api/conversation/links/route.ts`

#### Documentation
- `README.md` - URLs mises à jour
- `start.sh` - Script de démarrage mis à jour

## 🚀 Avantages

### ✅ Configuration Centralisée
- Une seule source de vérité pour toutes les URLs
- Support des variables d'environnement
- Distinction côté client/serveur

### ✅ Ports Normalisés
- `3200` pour le frontend (plus logique, proche de 3000)
- `3100` pour le backend (évite les conflits)
- Cohérence dans toute l'application

### ✅ Maintenance Simplifiée
- Changement d'URL en un seul endroit
- Helper functions (`buildApiUrl`)
- Types TypeScript pour les endpoints

### ✅ Support Multi-Environnement
- Variables d'environnement pour production
- Fallbacks pour le développement
- Configuration flexible

## 🔍 Usage

### Utilisation de la Configuration
```typescript
import { buildApiUrl, API_ENDPOINTS, APP_CONFIG } from '@/lib/config';

// Pour les appels API
const response = await fetch(buildApiUrl(API_ENDPOINTS.AUTH.LOGIN), { ... });

// Pour les WebSockets
const socket = io(APP_CONFIG.getBackendUrl());

// Pour construire des URLs custom
const customUrl = buildApiUrl('/custom-endpoint');
```

### Variables d'Environnement
```bash
# .env.local (frontend)
NEXT_PUBLIC_FRONTEND_URL=http://localhost:3200
NEXT_PUBLIC_BACKEND_URL=http://localhost:3100

# backend/.env
FRONTEND_URL=http://localhost:3200
```

## 🎯 Résultat
- ✅ Aucune référence hardcodée à `localhost:3002`
- ✅ Configuration centralisée et typée
- ✅ Support multi-environnement
- ✅ Maintenance facilitée
- ✅ Ports normalisés et sans conflit
