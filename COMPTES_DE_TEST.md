# 🧪 Comptes de Test Meeshy

## 📋 Informations de Connexion

Tous les comptes utilisent le mot de passe : **`password123`**

### 👥 Utilisateurs Disponibles

| Utilisateur | Email | Nom Complet | Langue | Rôle |
|-------------|-------|-------------|--------|------|
| **Alice** | `alice@meeshy.com` | Alice Dubois | Français | **ADMIN** |
| **Bob** | `bob@meeshy.com` | Bob Johnson | Anglais | User |
| **Carlos** | `carlos@meeshy.com` | Carlos García | Espagnol | User |
| **Dieter** | `dieter@meeshy.com` | Dieter Schmidt | Allemand | User |
| **Li** | `li@meeshy.com` | Li Wei | Chinois | User |
| **Yuki** | `yuki@meeshy.com` | Yuki Tanaka | Japonais | User |
| **Maria** | `maria@meeshy.com` | Maria Silva | Portugais | User |

## 🚀 Connexion Rapide

### Via l'Interface Web
1. Allez sur la page de connexion : `/login`
2. Cliquez sur un des boutons de connexion rapide
3. Vous serez automatiquement connecté avec le compte sélectionné

### Via l'API
```bash
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "alice@meeshy.com",
    "password": "password123"
  }'
```

## 🌍 Fonctionnalités Multilingues

### Conversation Globale "any"
- **ID** : `any`
- **Type** : GLOBAL
- **Accès** : Tous les utilisateurs
- **Messages** : 31 messages avec traductions complètes
- **Langues** : FR, EN, ES, DE, ZH, JA, PT

### Traductions Automatiques
- Chaque utilisateur a sa langue système configurée
- Traductions automatiques vers les langues des autres membres
- Support de 7 langues principales

## 🔧 Configuration des Utilisateurs

### Alice (Admin - Français)
- **Langue système** : Français (fr)
- **Langue régionale** : Français (fr)
- **Traduction automatique** : Activée
- **Permissions** : Administrateur

### Bob (Anglais)
- **Langue système** : Anglais (en)
- **Langue régionale** : Espagnol (es)
- **Langue personnalisée** : Français (fr)

### Carlos (Espagnol)
- **Langue système** : Espagnol (es)
- **Langue régionale** : Anglais (en)

### Dieter (Allemand)
- **Langue système** : Allemand (de)
- **Langue régionale** : Français (fr)

### Li (Chinois)
- **Langue système** : Chinois (zh)
- **Langue régionale** : Anglais (en)
- **Langue personnalisée** : Français (fr)

### Yuki (Japonais)
- **Langue système** : Japonais (ja)
- **Langue régionale** : Français (fr)
- **Langue personnalisée** : Russe (ru)

### Maria (Portugais)
- **Langue système** : Portugais (pt)
- **Langue régionale** : Arabe (ar)

## 📊 Statistiques des Seeds

- **Utilisateurs créés** : 7
- **Messages créés** : 31
- **Traductions créées** : 186
- **Conversations** : 1 (globale "any")

## 🎯 Tests Recommandés

1. **Connexion multilingue** : Testez avec différents utilisateurs
2. **Traduction automatique** : Envoyez des messages dans différentes langues
3. **Indicateurs de frappe** : Vérifiez les notifications en temps réel
4. **Conversation globale** : Rejoignez la conversation "any"
5. **Permissions admin** : Testez avec Alice (admin)

## 🔄 Mise à Jour des Seeds

Pour régénérer les données de test :
```bash
cd gateway
npm run generate:seeds
```

Cela recréera tous les utilisateurs et messages avec les traductions.
