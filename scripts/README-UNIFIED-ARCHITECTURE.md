# 🚀 Meeshy - Architecture Unifiée des Scripts V2.0

## Vue d'ensemble

L'architecture unifiée Meeshy V2.0 organise tous les scripts de gestion en une structure modulaire et cohérente, avec un script principal `meeshy.sh` qui permet de gérer la production, le développement et le déploiement de manière unifiée.

## 🏗️ Architecture

### Script Principal

| Script | Objectif | Description |
|--------|----------|-------------|
| `meeshy.sh` | Point d'entrée unifié | Gestion de tous les environnements |

### Structure des Dossiers

```
scripts/
├── meeshy.sh                    # Script principal unifié
├── production/                  # Scripts de gestion de production
│   ├── meeshy-orchestrator.sh   # Orchestrateur de production
│   ├── meeshy-config.sh         # Configuration de production
│   ├── meeshy-start.sh          # Démarrage des services
│   ├── meeshy-stop.sh           # Arrêt des services
│   ├── meeshy-status.sh         # Statut des services
│   ├── meeshy-logs.sh           # Logs des services
│   ├── meeshy-maintenance.sh    # Maintenance des services
│   └── generate-production-config.sh # Génération des secrets
├── development/                 # Scripts de développement
│   ├── development-configure-dev.sh      # Configuration dev
│   ├── development-init-mongodb-replica.sh # Init MongoDB
│   ├── development-start-local.sh        # Démarrage local
│   ├── development-stop-local.sh         # Arrêt local
│   ├── development-test-*.sh             # Tests de développement
│   └── README.md
└── deployment/                  # Scripts de déploiement
    ├── deploy-orchestrator.sh   # Orchestrateur de déploiement
    ├── deploy-config.sh         # Configuration de déploiement
    ├── deploy-test-connection.sh # Tests de connexion
    ├── deploy-prepare-files.sh  # Préparation des fichiers
    ├── deploy-install-prerequisites.sh # Installation prérequis
    ├── deploy-configure-mongodb.sh # Configuration MongoDB
    ├── deploy-start-services.sh # Démarrage des services
    ├── deploy-health-check.sh   # Vérification de santé
    ├── deploy-maintenance.sh    # Maintenance de déploiement
    └── README-DEPLOYMENT-ARCHITECTURE.md
```

## 🎯 Utilisation

### Syntaxe Générale

```bash
./meeshy.sh [ENVIRONMENT] [COMMAND] [OPTIONS]
```

### Environnements

| Environnement | Alias | Description |
|---------------|-------|-------------|
| `prod` | `production` | Gestion des services en production |
| `dev` | `development` | Gestion des services de développement |
| `deploy` | `deployment` | Déploiement sur serveur distant |

## 📦 Production

### Commandes Disponibles

```bash
# Gestion des services
./meeshy.sh prod start          # Démarrer les services
./meeshy.sh prod stop           # Arrêter les services
./meeshy.sh prod restart        # Redémarrer les services
./meeshy.sh prod status         # Statut des services
./meeshy.sh prod logs           # Logs des services

# Maintenance
./meeshy.sh prod maintenance    # Opérations de maintenance
./meeshy.sh prod health         # Vérification de santé

# Informations
./meeshy.sh prod info           # Informations sur l'environnement
./meeshy.sh prod version        # Version des services
```

### Exemples

```bash
# Démarrer tous les services de production
./meeshy.sh prod start

# Vérifier le statut des services
./meeshy.sh prod status

# Afficher les logs des services
./meeshy.sh prod logs

# Vérification de santé
./meeshy.sh prod health
```

## 🛠️ Développement

### Commandes Disponibles

```bash
# Gestion de l'environnement
./meeshy.sh dev start           # Démarrer l'environnement de développement
./meeshy.sh dev stop            # Arrêter l'environnement de développement
./meeshy.sh dev restart         # Redémarrer l'environnement de développement

# Configuration et tests
./meeshy.sh dev configure       # Configurer l'environnement de développement
./meeshy.sh dev test            # Exécuter les tests de développement
./meeshy.sh dev init-mongo      # Initialiser MongoDB pour le développement
./meeshy.sh dev test-access     # Tests d'accès aux services
```

### Exemples

```bash
# Démarrer l'environnement de développement
./meeshy.sh dev start

# Configurer l'environnement
./meeshy.sh dev configure

# Exécuter les tests
./meeshy.sh dev test

# Initialiser MongoDB
./meeshy.sh dev init-mongo
```

## 🚀 Déploiement

### Commandes Disponibles

```bash
# Déploiement
./meeshy.sh deploy deploy [IP]           # Déployer l'application complète
./meeshy.sh deploy deploy-reset [IP]     # Déploiement avec reset complet

# Vérifications
./meeshy.sh deploy test [IP]             # Tester la connexion au serveur
./meeshy.sh deploy health [IP]           # Vérification de santé sur le serveur
./meeshy.sh deploy status [IP]           # Statut des services sur le serveur

# Gestion des services
./meeshy.sh deploy logs [IP]             # Logs des services sur le serveur
./meeshy.sh deploy restart [IP]          # Redémarrer les services sur le serveur
./meeshy.sh deploy stop [IP]             # Arrêter les services sur le serveur

# Configuration
./meeshy.sh deploy passwords [IP]        # Déployer les mots de passe Traefik
./meeshy.sh deploy replica [IP]          # Configuration du replica set MongoDB
```

### Options de Déploiement

```bash
# Déploiement avec régénération des secrets
./meeshy.sh deploy deploy 192.168.1.100 --regenerate-secrets

# Déploiement avec rafraîchissement des images
./meeshy.sh deploy deploy 192.168.1.100 --force-refresh
```

### Exemples

```bash
# Déploiement complet
./meeshy.sh deploy deploy 192.168.1.100

# Test de connexion
./meeshy.sh deploy test 192.168.1.100

# Vérification de santé
./meeshy.sh deploy health 192.168.1.100

# Déploiement des mots de passe
./meeshy.sh deploy passwords 192.168.1.100
```

## 🔧 Options Globales

### Aide et Version

```bash
# Afficher l'aide complète
./meeshy.sh --help

# Afficher la version
./meeshy.sh --version
```

### Aide par Environnement

```bash
# Aide pour la production
./meeshy.sh prod --help

# Aide pour le développement
./meeshy.sh dev --help

# Aide pour le déploiement
./meeshy.sh deploy --help
```

## 📊 Métriques de l'Architecture

### Répartition des Scripts

| Environnement | Nombre de Scripts | Description |
|---------------|-------------------|-------------|
| **Production** | 8 scripts | Gestion des services en production |
| **Développement** | 9 scripts | Environnement de développement |
| **Déploiement** | 10 scripts | Déploiement sur serveur distant |
| **Total** | **27 scripts** | Architecture complète |

### Avantages de l'Architecture Unifiée

#### ✅ **Simplicité d'Utilisation**
- **Un seul point d'entrée** : `meeshy.sh`
- **Syntaxe cohérente** : `[environnement] [commande] [options]`
- **Aide intégrée** : Documentation complète

#### ✅ **Organisation Modulaire**
- **Séparation claire** : Production, développement, déploiement
- **Scripts spécialisés** : Chaque script a un objectif précis
- **Réutilisabilité** : Modules indépendants

#### ✅ **Traçabilité Complète**
- **Sessions unifiées** : ID unique par opération
- **Logs structurés** : Timestamps, niveaux, détails
- **Traces d'opérations** : Suivi complet des actions

#### ✅ **Maintenabilité**
- **Code organisé** : Structure claire et logique
- **Documentation intégrée** : Aide et exemples
- **Tests d'intégrité** : Validation automatique

## 🧪 Tests et Validation

### Test de l'Architecture Unifiée

```bash
# Test complet de l'architecture
./test-unified-architecture.sh
```

### Tests Individuels

```bash
# Test de l'architecture de déploiement
./deployment/test-deployment-architecture.sh

# Test de l'architecture modulaire
./test-modular-architecture.sh
```

## 🔄 Migration et Compatibilité

### Remplacement de l'Ancien Script

L'architecture unifiée remplace complètement l'ancien script monolithique `meeshy-deploy.sh` (2000+ lignes) par une structure modulaire et organisée.

### Compatibilité

- **Scripts de production** : Compatibles avec l'ancienne architecture
- **Scripts de développement** : Nouveaux, avec préfixe `development-`
- **Scripts de déploiement** : Nouveaux, avec préfixe `deploy-`

## 📚 Documentation Associée

### Fichiers de Documentation

- `README-UNIFIED-ARCHITECTURE.md` - Ce fichier (architecture unifiée)
- `production/README-MODULAR-ARCHITECTURE.md` - Architecture des services de production
- `deployment/README-DEPLOYMENT-ARCHITECTURE.md` - Architecture de déploiement
- `development/README.md` - Documentation du développement

### Scripts de Test

- `test-unified-architecture.sh` - Test de l'architecture unifiée
- `test-modular-architecture.sh` - Test de l'architecture modulaire
- `deployment/test-deployment-architecture.sh` - Test de l'architecture de déploiement

## 🎉 Conclusion

L'architecture unifiée Meeshy V2.0 offre :

- **Simplicité** : Un seul script principal pour tout gérer
- **Organisation** : Structure modulaire et cohérente
- **Flexibilité** : Support de tous les environnements
- **Maintenabilité** : Code organisé et documenté
- **Traçabilité** : Suivi complet des opérations

Cette architecture remplace efficacement le script monolithique par une suite de scripts spécialisés, organisés et faciles à utiliser.

---

**Version** : 2.0.0-modular  
**Date** : 2025-09-09  
**Auteur** : Meeshy Development Team
