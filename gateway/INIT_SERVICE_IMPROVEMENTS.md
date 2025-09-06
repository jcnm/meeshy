# Améliorations du Service d'Initialisation

## Vue d'ensemble

Le service d'initialisation de la gateway a été amélioré pour permettre une réinitialisation forcée de la base de données et créer des utilisateurs et conversations supplémentaires selon les spécifications métier.

## Nouvelles Fonctionnalités

### 1. Utilisateurs Configurables

#### Utilisateur Meeshy (BIGBOSS) - Partiellement Configurable
L'utilisateur Meeshy a des champs fixes et des champs configurables :

**Champs FIXES** :
- Username: `meeshy`
- Prénom: `Meeshy`
- Nom: `Sama`
- Rôle: `BIGBOSS`

**Champs CONFIGURABLES** :
- **Mot de passe** : `MEESHY_PASSWORD`
- **Email** : `MEESHY_EMAIL`
- **Langue système** : `MEESHY_SYSTEM_LANGUAGE`
- **Langue régionale** : `MEESHY_REGIONAL_LANGUAGE`
- **Langue de destination** : `MEESHY_CUSTOM_DESTINATION_LANGUAGE`

#### Utilisateur Admin - Partiellement Configurable
L'utilisateur Admin a des champs fixes et des champs configurables :

**Champs FIXES** :
- Username: `admin`
- Prénom: `Admin`
- Nom: `Manager`
- Rôle: `ADMIN`

**Champs CONFIGURABLES** :
- **Mot de passe** : `ADMIN_PASSWORD`
- **Email** : `ADMIN_EMAIL`
- **Langue système** : `ADMIN_SYSTEM_LANGUAGE`
- **Langue régionale** : `ADMIN_REGIONAL_LANGUAGE`
- **Langue de destination** : `ADMIN_CUSTOM_DESTINATION_LANGUAGE`

#### Utilisateur André Tabeth - Entièrement Configurable
L'utilisateur André Tabeth est entièrement configurable :

- **Nom d'utilisateur** : `ATABETH_USERNAME`
- **Mot de passe** : `ATABETH_PASSWORD`
- **Prénom** : `ATABETH_FIRST_NAME`
- **Nom de famille** : `ATABETH_LAST_NAME`
- **Email** : `ATABETH_EMAIL`
- **Rôle** : `ATABETH_ROLE` (USER, ADMIN, MODO, AUDIT, ANALYST, BIGBOSS)
- **Langue système** : `ATABETH_SYSTEM_LANGUAGE`
- **Langue régionale** : `ATABETH_REGIONAL_LANGUAGE`
- **Langue de destination** : `ATABETH_CUSTOM_DESTINATION_LANGUAGE`

### 2. Variable d'Environnement FORCE_DB_RESET

- **Variable**: `FORCE_DB_RESET`
- **Valeurs**: `true` ou `false` (défaut: `false`)
- **Fonction**: Force la réinitialisation complète de la base de données au démarrage

```bash
# Pour forcer la réinitialisation
FORCE_DB_RESET=true
```

⚠️ **ATTENTION**: Cette option supprime TOUTES les données existantes !

### 2. Utilisateur André Tabeth

- **Nom d'utilisateur**: `atabeth`
- **Mot de passe**: Identique à l'admin (configurable via `ADMIN_PASSWORD`)
- **Rôle**: `USER` (utilisateur simple)
- **Langues**: Français (système et régional), Anglais (destination personnalisée)

### 3. Conversations Supplémentaires

#### Conversation Directe
- **Type**: `direct`
- **Participants**: André Tabeth et Admin
- **Identifiant**: `direct_{userId1}_{userId2}`

#### Conversation de Groupe
- **Type**: `group`
- **Participants**: André Tabeth, Admin et Meeshy
- **Identifiant**: `group_{userIds_sorted}`
- **Rôles**: Premier utilisateur = ADMIN, autres = MEMBER

### 4. Logs Améliorés

Les logs indiquent maintenant clairement :
- Si `FORCE_DB_RESET=true` est détecté
- Si l'initialisation a été exécutée ou non
- Le statut de chaque étape de l'initialisation
- Les détails des éléments créés

## Configuration

### Variables d'Environnement

```bash
# Configuration de l'initialisation
FORCE_DB_RESET=false                    # Forcer la réinitialisation

# Configuration utilisateur Meeshy (partiellement configurable)
MEESHY_PASSWORD=bigboss123              # Mot de passe
MEESHY_EMAIL=meeshy@meeshy.me          # Adresse email
MEESHY_SYSTEM_LANGUAGE=en              # Langue système
MEESHY_REGIONAL_LANGUAGE=fr            # Langue régionale
MEESHY_CUSTOM_DESTINATION_LANGUAGE=pt  # Langue de destination personnalisée

# Configuration utilisateur Admin (partiellement configurable)
ADMIN_PASSWORD=admin123                 # Mot de passe
ADMIN_EMAIL=admin@meeshy.me            # Adresse email
ADMIN_SYSTEM_LANGUAGE=es               # Langue système
ADMIN_REGIONAL_LANGUAGE=de             # Langue régionale
ADMIN_CUSTOM_DESTINATION_LANGUAGE=zh   # Langue de destination personnalisée

# Configuration utilisateur André Tabeth (entièrement configurable)
ATABETH_USERNAME=atabeth               # Nom d'utilisateur
ATABETH_PASSWORD=admin123              # Mot de passe
ATABETH_FIRST_NAME=André               # Prénom
ATABETH_LAST_NAME=Tabeth               # Nom de famille
ATABETH_EMAIL=atabeth@meeshy.me        # Adresse email
ATABETH_ROLE=USER                      # Rôle (USER, ADMIN, MODO, AUDIT, ANALYST, BIGBOSS)
ATABETH_SYSTEM_LANGUAGE=fr             # Langue système
ATABETH_REGIONAL_LANGUAGE=fr           # Langue régionale
ATABETH_CUSTOM_DESTINATION_LANGUAGE=en # Langue de destination personnalisée
```

### Exemple de Configuration

```bash
# .env pour développement avec réinitialisation
NODE_ENV=development
FORCE_DB_RESET=true

# Configuration personnalisée des utilisateurs
MEESHY_PASSWORD=dev123
MEESHY_EMAIL=dev@meeshy.me
MEESHY_SYSTEM_LANGUAGE=fr
MEESHY_REGIONAL_LANGUAGE=fr
MEESHY_CUSTOM_DESTINATION_LANGUAGE=en

ADMIN_PASSWORD=dev456
ADMIN_EMAIL=admin@meeshy.me
ADMIN_SYSTEM_LANGUAGE=fr
ADMIN_REGIONAL_LANGUAGE=fr
ADMIN_CUSTOM_DESTINATION_LANGUAGE=en

# Configuration entièrement personnalisée pour André Tabeth
ATABETH_USERNAME=devuser
ATABETH_PASSWORD=dev789
ATABETH_FIRST_NAME=Dev
ATABETH_LAST_NAME=User
ATABETH_EMAIL=dev@meeshy.me
ATABETH_ROLE=ADMIN
ATABETH_SYSTEM_LANGUAGE=fr
ATABETH_REGIONAL_LANGUAGE=fr
ATABETH_CUSTOM_DESTINATION_LANGUAGE=en
```

## Utilisation

### Démarrage Normal
```bash
# Démarrage sans réinitialisation
npm start
# ou
pnpm start
```

### Démarrage avec Réinitialisation
```bash
# Définir la variable d'environnement
export FORCE_DB_RESET=true

# Puis démarrer
npm start
# ou
pnpm start
```

### Via Docker
```bash
# Avec réinitialisation
docker run -e FORCE_DB_RESET=true meeshy-gateway

# Sans réinitialisation (défaut)
docker run meeshy-gateway
```

## Structure des Données Créées

### Utilisateurs
1. **Meeshy** (BIGBOSS) - Partiellement Configurable
   - Username: `meeshy` (FIXE)
   - Prénom: `Meeshy` (FIXE)
   - Nom: `Sama` (FIXE)
   - Rôle: `BIGBOSS` (FIXE)
   - Mot de passe, email, langues: Configurables

2. **Admin** (Administrateur) - Partiellement Configurable
   - Username: `admin` (FIXE)
   - Prénom: `Admin` (FIXE)
   - Nom: `Manager` (FIXE)
   - Rôle: `ADMIN` (FIXE)
   - Mot de passe, email, langues: Configurables

3. **André Tabeth** (Utilisateur) - Entièrement Configurable
   - Username: Configurable via `ATABETH_USERNAME` (défaut: `atabeth`)
   - Prénom: Configurable via `ATABETH_FIRST_NAME` (défaut: `André`)
   - Nom: Configurable via `ATABETH_LAST_NAME` (défaut: `Tabeth`)
   - Rôle: Configurable via `ATABETH_ROLE` (défaut: `USER`)
   - Tous les autres champs: Configurables

### Conversations
1. **Meeshy Global** (Globale)
   - Identifiant: `meeshy`
   - Type: `global`
   - Participants: Tous les utilisateurs

2. **Conversation Directe** (Privée)
   - Identifiant: `direct_{atabeth_id}_{admin_id}`
   - Type: `direct`
   - Participants: André Tabeth et Admin

3. **Conversation de Groupe** (Groupe)
   - Identifiant: `group_{atabeth_id}_{admin_id}_{meeshy_id}`
   - Type: `group`
   - Participants: André Tabeth, Admin et Meeshy

## Logs d'Exemple

### Démarrage Normal
```
[INIT] 🚀 Démarrage de l'initialisation de la base de données...
[INIT] 🔍 Vérification de la conversation globale "meeshy"...
[INIT] ✅ Conversation globale "meeshy" existe déjà
[INIT] 🔍 Vérification des utilisateurs par défaut...
[INIT] ✅ Utilisateur Bigboss "meeshy" existe déjà
[INIT] ✅ Utilisateur Admin "admin" existe déjà
[INIT] 🔍 Vérification de l'utilisateur André Tabeth "atabeth"...
[INIT] ✅ Utilisateur André Tabeth "atabeth" existe déjà
[INIT] 🔍 Création des conversations supplémentaires...
[INIT] ✅ Conversation directe existe déjà
[INIT] ✅ Conversation de groupe existe déjà
[INIT] ✅ Conversations supplémentaires créées avec succès
[INIT] ✅ Initialisation de la base de données terminée avec succès
```

### Démarrage avec Réinitialisation
```
[INIT] 🔄 FORCE_DB_RESET=true détecté - Réinitialisation forcée de la base de données...
[INIT] 🧹 Suppression de toutes les données existantes...
[INIT] ✅ Base de données réinitialisée avec succès
[INIT] 🆕 Création de la conversation globale "meeshy"...
[INIT] ✅ Conversation globale "meeshy" créée avec succès
[INIT] 🆕 Création de l'utilisateur Bigboss "meeshy"...
[INIT] ✅ Utilisateur Bigboss "meeshy" créé avec succès
[INIT] 🆕 Création de l'utilisateur Admin "admin"...
[INIT] ✅ Utilisateur Admin "admin" créé avec succès
[INIT] 🆕 Création de l'utilisateur André Tabeth "atabeth"...
[INIT] ✅ Utilisateur André Tabeth "atabeth" créé avec succès
[INIT] 🔍 Création des conversations supplémentaires...
[INIT] 🔍 Création de la conversation directe...
[INIT] ✅ Conversation directe créée avec succès
[INIT] 🔍 Création de la conversation de groupe...
[INIT] ✅ Conversation de groupe créée avec succès
[INIT] ✅ Conversations supplémentaires créées avec succès
[INIT] ✅ Initialisation de la base de données terminée avec succès
```

## Tests

Un script de test est disponible pour vérifier le bon fonctionnement :

```bash
# Compiler le TypeScript d'abord
npm run build

# Puis exécuter le test
node test-init-service.js
```

## Exemples d'Utilisation

### Configuration par Défaut
```bash
# Utilise les valeurs par défaut
MEESHY_USERNAME=meeshy
MEESHY_PASSWORD=bigboss123
MEESHY_FIRST_NAME=Meeshy
MEESHY_LAST_NAME=Sama
MEESHY_EMAIL=meeshy@meeshy.me
MEESHY_ROLE=BIGBOSS
MEESHY_SYSTEM_LANGUAGE=en
MEESHY_REGIONAL_LANGUAGE=fr
MEESHY_CUSTOM_DESTINATION_LANGUAGE=pt
```

### Configuration Personnalisée
```bash
# Configuration pour un utilisateur personnalisé
MEESHY_USERNAME=monuser
MEESHY_PASSWORD=monmotdepasse
MEESHY_FIRST_NAME=Mon
MEESHY_LAST_NAME=Nom
MEESHY_EMAIL=mon@email.com
MEESHY_ROLE=ADMIN
MEESHY_SYSTEM_LANGUAGE=fr
MEESHY_REGIONAL_LANGUAGE=fr
MEESHY_CUSTOM_DESTINATION_LANGUAGE=en
```

### Configuration pour Développement
```bash
# Configuration optimisée pour le développement
FORCE_DB_RESET=true
MEESHY_USERNAME=devuser
MEESHY_PASSWORD=dev123
MEESHY_FIRST_NAME=Dev
MEESHY_LAST_NAME=User
MEESHY_EMAIL=dev@meeshy.me
MEESHY_ROLE=ADMIN
MEESHY_SYSTEM_LANGUAGE=fr
MEESHY_REGIONAL_LANGUAGE=fr
MEESHY_CUSTOM_DESTINATION_LANGUAGE=en
```

Un fichier d'exemple complet est disponible : `env.custom.example`

## Sécurité

- La variable `FORCE_DB_RESET` ne doit être utilisée qu'en développement
- En production, cette variable doit être définie à `false` ou omise
- Les mots de passe par défaut doivent être changés en production
- L'initialisation respecte les contraintes de sécurité existantes

## Compatibilité

- Compatible avec l'architecture existante
- N'affecte pas les fonctionnalités existantes
- Utilise les services d'authentification existants
- Respecte le schéma de base de données actuel
