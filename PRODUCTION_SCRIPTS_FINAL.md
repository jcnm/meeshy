# Scripts de production - Configuration finale

## ✅ Scripts conservés (6 fichiers essentiels)

### Scripts de production (backups et maintenance)

#### 1. `production/meeshy-auto-backup.sh`
**Usage** : Backup automatique avant mise à jour
```bash
./scripts/production/meeshy-auto-backup.sh [BACKUP_DIR]
```
**Quand** : Avant chaque mise à jour de service

#### 2. `production/meeshy-restore-backup.sh`
**Usage** : Restaurer un backup
```bash
./scripts/production/meeshy-restore-backup.sh [BACKUP_FILE]
```
**Quand** : En cas de problème après une mise à jour

#### 3. `production/meeshy-maintenance.sh`
**Usage** : Maintenance et nettoyage des services
```bash
./scripts/production/meeshy-maintenance.sh [COMMAND] [OPTIONS]
```
**Quand** : Maintenance mensuelle

### Scripts de maintenance BDD (MongoDB)

#### 4. `cleanup-user-spaces.js`
**Usage** : Nettoyer les espaces inutilisés dans les usernames
```bash
docker exec meeshy-database mongosh meeshy /opt/meeshy/scripts/cleanup-user-spaces.js
```
**Quand** : Maintenance occasionnelle

#### 5. `normalize-user-data.js`
**Usage** : Normaliser les données utilisateurs (emails, noms)
```bash
docker exec meeshy-database mongosh meeshy /opt/meeshy/scripts/normalize-user-data.js
```
**Quand** : Après import de données ou migration

#### 6. `restore-missing-users.js`
**Usage** : Restaurer les utilisateurs manquants (admin, meeshy)
```bash
docker exec meeshy-database mongosh meeshy /opt/meeshy/scripts/restore-missing-users.js
```
**Quand** : Urgence (utilisateurs système supprimés par erreur)

## ❌ Scripts supprimés (non nécessaires)

| Script | Raison de suppression |
|--------|----------------------|
| `deployment/deploy-config.sh` | Déploiement depuis dev uniquement |
| `deployment/deploy-configure-models-permissions.sh` | Setup initial uniquement |
| `deployment/deploy-maintenance.sh` | Déjà dans production/meeshy-maintenance.sh |
| `configure-database.sh` | Setup initial (une seule fois) |
| `manage-ssl.sh` | Traefik gère SSL automatiquement |
| `check-public-url.sh` | Vérification faite, plus nécessaire |

## Structure finale

```
/opt/meeshy/scripts/
├── production/
│   ├── meeshy-auto-backup.sh       ⭐ Backups automatiques
│   ├── meeshy-restore-backup.sh    ⭐ Restauration
│   └── meeshy-maintenance.sh       ⭐ Maintenance
│
├── cleanup-user-spaces.js          🗃️ Nettoyage BDD
├── normalize-user-data.js          🗃️ Normalisation BDD
└── restore-missing-users.js        🚨 Urgence
```

## Utilisation courante

### Backup avant mise à jour

```bash
cd /opt/meeshy
./scripts/production/meeshy-auto-backup.sh
# Crée un backup dans backups/
```

### Maintenance mensuelle

```bash
cd /opt/meeshy
./scripts/production/meeshy-maintenance.sh
```

### Normalisation des données

```bash
docker exec meeshy-database mongosh meeshy \
  /opt/meeshy/scripts/normalize-user-data.js
```

### Restauration d'urgence

```bash
cd /opt/meeshy
./scripts/production/meeshy-restore-backup.sh backups/backup-YYYYMMDD.tar.gz
```

## Automatisation recommandée

### Cron pour backups quotidiens

```bash
# Ajouter au crontab
crontab -e

# Backup quotidien à 3h du matin
0 3 * * * /opt/meeshy/scripts/production/meeshy-auto-backup.sh

# Maintenance hebdomadaire (dimanche 4h)
0 4 * * 0 /opt/meeshy/scripts/production/meeshy-maintenance.sh
```

### Rotation des backups

Les scripts de production gèrent automatiquement :
- Garde les 7 backups quotidiens les plus récents
- Garde les 4 backups hebdomadaires les plus récents
- Garde les 3 backups mensuels les plus récents

## Espace disque

- **Scripts** : ~50KB total
- **Backups** : Gérés automatiquement par rotation
- **Logs** : Intégrés dans Docker

## Checklist finale

- [x] Scripts de production conservés (backups, restore, maintenance)
- [x] Scripts de maintenance BDD conservés
- [x] Scripts de déploiement supprimés
- [x] Scripts de setup initial supprimés
- [x] Scripts redondants supprimés
- [x] Structure claire et minimale

---

**Total** : 6 scripts essentiels  
**Espace** : 50KB  
**Fonction** : Maintenance, backups, urgences

