# Intégration des Traductions Multi-langues dans Meeshy Gateway

## 🎯 Objectif

Cette implémentation permet aux utilisateurs de recevoir et d'envoyer des messages traduits automatiquement selon leurs préférences linguistiques, en respectant l'architecture distribuée Meeshy avec communication ZMQ.

## 🏗️ Architecture Implémentée

```
Frontend (Next.js) 
    ↓ WebSocket/HTTP
Gateway (Fastify + WebSocket) ← MODIFICATIONS ICI
    ↓ ZMQ + JSON
Translator (FastAPI + Transformers)
    ↓ Shared Database (PostgreSQL + Prisma)
Cache Layer (Redis) + Database
```

## 🔧 Modifications Apportées

### 1. Routes de Conversation (`gateway/src/routes/conversations.ts`)

#### ✅ Modifications des imports
- Remplacement de `GrpcClient` par `ZMQTranslationClient`
- Intégration du `TranslationService` avec ZMQ

#### ✅ Route de récupération des messages (`GET /conversations/:id/messages`)
- **Filtrage par langue** : Les messages sont retournés dans la langue préférée de l'utilisateur
- **Résolution de langue** : Logique pour déterminer la langue à afficher selon les préférences utilisateur
- **Adaptation des traductions** : Messages et réponses adaptés automatiquement

#### ✅ Route d'envoi de messages (`POST /conversations/:id/messages`)
- **Traduction automatique** : Chaque message est automatiquement traduit pour tous les participants
- **Traitement asynchrone** : Les traductions sont lancées en arrière-plan via ZMQ
- **Gestion d'erreurs** : L'envoi du message ne dépend pas du succès des traductions

#### ✅ Nouvelles routes de gestion des messages
- **Modification de messages** (`PUT /conversations/:id/messages/:messageId`)
- **Suppression de messages** (`DELETE /conversations/:id/messages/:messageId`)
- **Route de modification globale** (`PATCH /messages/:messageId`)

### 2. Service de Traduction (`gateway/src/services/TranslationService.ts`)

#### ✅ Intégration ZMQ
- Remplacement de gRPC par ZMQ pour la communication avec le service Translator
- Méthode `initialize()` pour initialiser la connexion ZMQ
- Gestion des erreurs avec fallback

#### ✅ Traduction intelligente
- **Cache intelligent** : Vérification des traductions existantes via `MessageTranslation`
- **Modèles adaptatifs** : Sélection automatique du modèle (basic/medium/premium)
- **Multi-langue** : Traduction simultanée vers plusieurs langues cibles

#### ✅ Gestion des préférences utilisateur
- **Résolution de langue** : Logique pour déterminer la langue cible selon la configuration utilisateur
- **Traduction conversationnelle** : Traduction pour tous les participants d'une conversation

### 3. WebSocket Handler (`gateway/src/websocket/handler.ts`)

#### ✅ Traductions en temps réel
- **Messages traduits instantanés** : Chaque message est traduit et diffusé dans la langue de chaque participant
- **Gestion conversation globale** : Support spécial pour la conversation "any" (globale)
- **Broadcasting intelligent** : Messages diffusés dans la langue préférée de chaque utilisateur

#### ✅ Nouvelle méthode `translateAndBroadcastMessage()`
- Traduction asynchrone pour tous les participants
- Gestion des préférences linguistiques individuelles
- Fallback en cas d'erreur de traduction

## 🌐 Flux de Traduction Multi-langue

### 1. Envoi d'un Message
```
1. User A envoie "Bonjour" (français) → Gateway WebSocket
2. Gateway crée le message en base de données
3. Gateway → Translator (ZMQ): demande traductions pour tous les participants
4. Translator traduit vers toutes les langues nécessaires
5. Gateway diffuse le message :
   - User B (systemLanguage: "en") reçoit: "Hello"
   - User C (regionalLanguage: "es") reçoit: "Hola"
   - User D (systemLanguage: "fr") reçoit: "Bonjour" (original)
```

### 2. Récupération de l'Historique
```
1. User demande l'historique → Gateway HTTP GET /conversations/:id/messages
2. Gateway récupère les messages avec leurs traductions
3. Gateway filtre selon les préférences de l'utilisateur
4. Retourne les messages dans la langue préférée de l'utilisateur
```

## 📋 Configuration des Langues Utilisateur

### Schéma des Préférences (Prisma)
```typescript
model User {
  systemLanguage: string              // Default: "fr"
  regionalLanguage: string            // Default: "fr"
  customDestinationLanguage?: string  // Optional
  autoTranslateEnabled: boolean       // Default: true
  translateToSystemLanguage: boolean  // Default: true
  translateToRegionalLanguage: boolean // Default: false
  useCustomDestination: boolean       // Default: false
}
```

### Logique de Résolution de Langue
```typescript
function resolveUserLanguage(user: User): string {
  if (user.useCustomDestination && user.customDestinationLanguage) {
    return user.customDestinationLanguage;
  }
  
  if (user.translateToSystemLanguage) {
    return user.systemLanguage;
  }
  
  if (user.translateToRegionalLanguage) {
    return user.regionalLanguage;
  }
  
  return user.systemLanguage; // fallback
}
```

## 🚀 Tests d'Intégration

### 1. Test du Service de Traduction
```bash
cd gateway
node test-translation-integration.js
```

### 2. Test WebSocket
```bash
cd gateway
node test-websocket-translations.js
```

## 🔒 Restrictions de Sécurité

### Permissions Gateway vs Translator
- **Gateway** : Peut lire et modifier les messages, mais PAS les traductions
- **Translator** : Seul service autorisé à créer/modifier les traductions
- **Cohérence** : Respect strict des instructions Copilot

## 📊 Performance

### Optimisations Implémentées
- **Cache intelligent** : Utilisation des `MessageTranslation` existantes
- **Traduction asynchrone** : Messages diffusés immédiatement, traductions en arrière-plan
- **Requêtes optimisées** : Réduction des appels base de données

### Métriques Ciblées
- **Débit** : Support de 100k messages/seconde
- **Latence** : <50ms pour la diffusion des messages
- **Cache Hit Rate** : >80% avec le système `MessageTranslation`

## 🔄 Communication ZMQ

### Format des Requêtes de Traduction
```json
{
  "messageId": "msg_123",
  "text": "Bonjour",
  "sourceLanguage": "fr",
  "targetLanguage": "en",
  "modelType": "basic"
}
```

### Format des Réponses
```json
{
  "messageId": "msg_123",
  "translatedText": "Hello",
  "detectedSourceLanguage": "fr",
  "status": 1,
  "metadata": {
    "confidenceScore": 0.95,
    "fromCache": false,
    "modelUsed": "basic"
  }
}
```

## 🎯 Résultats Attendus

✅ **Messages en temps réel traduits** selon les préférences utilisateur  
✅ **Historique de conversation** adapté à la langue de l'utilisateur  
✅ **Performance optimisée** avec cache et traduction asynchrone  
✅ **Architecture distribuée** respectée (Gateway ↔ Translator via ZMQ)  
✅ **Permissions strictes** : Gateway ne modifie que les messages, pas les traductions  

---

**Note** : Cette implémentation respecte entièrement les instructions Copilot pour l'architecture distribuée Meeshy avec traductions multi-langues haute performance.
