# Release Notes - v0.3.05-alpha

## 🎯 Nouvelles Fonctionnalités

### 🔐 Authentification WebSocket Hybride
- **Implémentation de l'authentification hybride** pour WebSocket
- **Support des tokens Bearer** et session tokens
- **Correction des problèmes d'envoi de messages** via BubbleStreamPage
- **Logs de débogage détaillés** pour diagnostiquer les problèmes d'authentification

### 🔗 Gestion des Liens de Partage
- **Correction des permissions** pour la création de liens
- **Permettre aux utilisateurs** de créer des liens pour leurs conversations
- **Suppression du middleware requireModeration** trop restrictif
- **Logs de débogage** pour la création de liens

### 💬 Interface Utilisateur - Page /chat
- **Ajout des modales de connexion** et d'inscription dans la page /chat
- **Gestion des actions d'authentification** depuis le menu utilisateur
- **Amélioration de l'expérience utilisateur** pour les participants anonymes

### 🔧 Corrections Techniques
- **Correction de l'authentification WebSocket** avec auth et extraHeaders
- **Amélioration des logs de débogage** pour diagnostiquer les problèmes
- **Correction des erreurs TypeScript** et des middlewares

## 📋 Détails des Modifications

### Frontend
- `frontend/services/meeshy-socketio.service.ts`: Authentification hybride WebSocket
- `frontend/app/chat/[conversationShareLinkId]/page.tsx`: Modales d'authentification
- `frontend/components/layout/Header.tsx`: Gestion des actions d'authentification

### Backend Gateway
- `gateway/src/routes/links.ts`: Permissions de création de liens
- `gateway/src/socketio/MeeshySocketIOManager.ts`: Authentification hybride
- `gateway/src/middleware/hybrid-auth.ts`: Middlewares d'authentification

## 🚀 Améliorations de Performance
- **Optimisation de l'authentification WebSocket**
- **Réduction des erreurs d'envoi de messages**
- **Amélioration de la stabilité des connexions**

## 🧪 Tests Recommandés

### 1. Envoi de Messages
- Connectez-vous et envoyez des messages via BubbleStreamPage
- Vérifiez que les messages sont bien reçus par les autres participants

### 2. Création de Liens de Partage
- Créez un lien de partage pour une conversation
- Vérifiez que le lien fonctionne et permet l'accès anonyme

### 3. Authentification depuis /chat
- Rejoignez une conversation en mode anonyme
- Testez "Se connecter" → modal de connexion
- Testez "S'inscrire" → modal d'inscription

### 4. Authentification WebSocket
- Vérifiez les logs de débogage dans la console
- Confirmez que l'authentification hybride fonctionne

## 🔍 Logs de Débogage

### WebSocket Authentication
```
🔌 MeeshySocketIOService: Initialisation connexion Socket.IO...
🔐 MeeshySocketIOService: Headers d'authentification préparés
✅ MeeshySocketIOService: Socket.IO connecté
```

### Création de Liens
```
[CREATE_LINK] Tentative création lien: { userId: "...", userRole: "MEMBER" }
[CREATE_LINK] Nouvelle conversation créée: { conversationId: "...", creatorRole: "CREATOR" }
```

## 🎉 Résumé

Cette version apporte des améliorations majeures à l'authentification WebSocket et à l'interface utilisateur, résolvant les problèmes d'envoi de messages et améliorant l'expérience utilisateur pour les participants anonymes.

---

**Version**: v0.3.05-alpha  
**Date**: 17 août 2025  
**Statut**: Alpha - Tests en cours
