# 🎯 RÉINITIALISATION DES MOTS DE PASSE MEESHY - GUIDE RAPIDE

## ⚡ TL;DR - Procédure Express

**Objectif:** Réinitialiser tous les mots de passe en production SANS PERTE DE DONNÉES

**Durée totale:** ~5 minutes  
**Interruption services:** ~30 secondes

### Commandes rapides

```bash
# 1. Installer les prérequis (si nécessaire)
brew install httpd  # macOS

# 2. Naviguer vers le projet
cd /Users/smpceo/Documents/Services/Meeshy/meeshy

# 3. Exécuter le script (remplacer par votre IP)
./scripts/production/reset-production-passwords.sh 157.230.15.51

# 4. Vérifier que tout fonctionne
./scripts/production/verify-password-reset.sh 157.230.15.51

# 5. Consulter les nouveaux mots de passe
cat secrets/clear.txt
```

---

## 📋 Checklist pré-exécution

- [ ] `htpasswd` installé (`brew install httpd`)
- [ ] Accès SSH au serveur DigitalOcean configuré
- [ ] IP du droplet notée : `_________________`
- [ ] Backup manuel des secrets actuels (optionnel, automatique dans le script)
- [ ] Confirmation que c'est le bon moment (services seront brièvement interrompus)

---

## 🔐 Ce qui sera réinitialisé

### Interfaces d'administration
| Service | URL | Utilisateur | Nouveau mot de passe |
|---------|-----|-------------|----------------------|
| Traefik Dashboard | https://traefik.meeshy.me | admin | Généré automatiquement |
| MongoDB UI | https://mongo.meeshy.me | admin | Même que Traefik |
| Redis UI | https://redis.meeshy.me | admin | Même que Traefik |

### Utilisateurs de l'application
| Utilisateur | URL | Mot de passe |
|-------------|-----|--------------|
| admin | https://meeshy.me | Généré automatiquement |
| meeshy | https://meeshy.me | Généré automatiquement |
| atabeth | https://meeshy.me | Généré automatiquement |

### Services backend
| Service | Mot de passe |
|---------|--------------|
| MongoDB database | Généré automatiquement (24 caractères) |
| Redis | Généré automatiquement (20 caractères) |
| JWT Secret | Généré automatiquement (64 caractères) |

---

## 🚀 Procédure détaillée

### Étape 1: Préparation (2 min)

```bash
# Vérifier que htpasswd est installé
htpasswd -V

# Si non installé:
brew install httpd  # macOS
# ou
sudo apt install apache2-utils  # Linux

# Tester la connexion SSH
ssh root@VOTRE_IP_DROPLET "echo OK"
```

### Étape 2: Exécution (2 min)

```bash
cd /Users/smpceo/Documents/Services/Meeshy/meeshy

./scripts/production/reset-production-passwords.sh VOTRE_IP_DROPLET
```

**Le script va vous demander confirmation:**
```
⚠️  ATTENTION:
Cette opération va réinitialiser tous les mots de passe sur VOTRE_IP_DROPLET
Les données MongoDB ne seront PAS affectées.

Voulez-vous continuer? (oui/non):
```

**Tapez:** `oui`

**Progression affichée:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
▶ ÉTAPE 1/8: Vérification des prérequis
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ htpasswd est installé
✅ openssl est installé
✅ ssh est installé
...
```

### Étape 3: Vérification (1 min)

```bash
./scripts/production/verify-password-reset.sh VOTRE_IP_DROPLET
```

**Résultat attendu:**
```
✅ Tous les conteneurs sont opérationnels
✅ Traefik Dashboard requiert l'authentification (401) ✅
✅ MongoDB UI accessible
✅ Redis UI accessible
✅ Gateway opérationnel (200 OK)
✅ Translator opérationnel (200 OK)
✅ Frontend accessible (200 OK)
✅ Vérification des logs terminée
```

### Étape 4: Tests manuels (2 min)

#### Test 1: Traefik Dashboard
```
URL: https://traefik.meeshy.me
Utilisateur: admin
Mot de passe: [voir secrets/clear.txt - ligne TRAEFIK_PASSWORD_CLEAR]
```

#### Test 2: MongoDB UI
```
URL: https://mongo.meeshy.me
Utilisateur: admin
Mot de passe: [voir secrets/clear.txt - ligne MONGO_UI_PASSWORD_CLEAR]
```

#### Test 3: Redis UI
```
URL: https://redis.meeshy.me
Utilisateur: admin
Mot de passe: [voir secrets/clear.txt - ligne REDIS_UI_PASSWORD_CLEAR]
```

#### Test 4: Application - 3 utilisateurs
```
URL: https://meeshy.me

1. admin / [voir secrets/clear.txt - ligne ADMIN_PASSWORD_CLEAR]
2. meeshy / [voir secrets/clear.txt - ligne MEESHY_PASSWORD_CLEAR]
3. atabeth / [voir secrets/clear.txt - ligne ATABETH_PASSWORD_CLEAR]
```

---

## 📁 Fichiers importants après exécution

### 1. `secrets/clear.txt` ⚠️ ULTRA CONFIDENTIEL

Contient tous les mots de passe en clair :

```bash
# Consulter
cat secrets/clear.txt

# Permissions (automatique)
-rw------- (600)

# ⚠️ NE JAMAIS COMMITER DANS GIT
```

### 2. `secrets/production-secrets.env`

Variables d'environnement avec hashes pour déploiement :

```bash
cat secrets/production-secrets.env
```

### 3. `secrets/backup-TIMESTAMP/`

Backup automatique des anciens secrets :

```bash
# Lister les backups
ls -la secrets/backup-*/

# Exemple de contenu
secrets/backup-20250915-143022/
├── production-secrets.env
└── clear.txt
```

### 4. `secrets/password-reset-TIMESTAMP.log`

Journal complet de l'opération :

```bash
cat secrets/password-reset-*.log
```

---

## ✅ Checklist post-exécution

- [ ] Script terminé sans erreur
- [ ] Vérification automatique réussie
- [ ] Traefik Dashboard accessible avec nouveau mot de passe
- [ ] MongoDB UI accessible avec nouveau mot de passe
- [ ] Redis UI accessible avec nouveau mot de passe
- [ ] Connexion application testée pour `admin`
- [ ] Connexion application testée pour `meeshy`
- [ ] Connexion application testée pour `atabeth`
- [ ] Données MongoDB vérifiées (messages, utilisateurs visibles)
- [ ] Fichier `clear.txt` sauvegardé dans gestionnaire de mots de passe
- [ ] Fichiers secrets NON commités dans Git
- [ ] Backup vérifié dans `secrets/backup-TIMESTAMP/`

---

## ⚠️ En cas de problème

### Problème: Script échoue à l'étape 1

**Cause:** htpasswd non installé

**Solution:**
```bash
# macOS
brew install httpd

# Linux
sudo apt install apache2-utils

# Relancer
./scripts/production/reset-production-passwords.sh VOTRE_IP
```

### Problème: Impossible de se connecter au serveur

**Cause:** SSH non configuré ou firewall

**Solution:**
```bash
# Tester la connexion
ssh -v root@VOTRE_IP

# Vérifier la clé SSH
ssh-add -l

# Ajouter la clé si nécessaire
ssh-add ~/.ssh/id_rsa
```

### Problème: Services ne redémarrent pas

**Solution:**
```bash
# Se connecter au serveur
ssh root@VOTRE_IP

# Vérifier l'état
cd /opt/meeshy
docker-compose ps

# Redémarrer manuellement
docker-compose restart traefik gateway nosqlclient p3x-redis-ui

# Vérifier les logs
docker-compose logs --tail=50 gateway
```

### Problème: Nouveaux mots de passe ne fonctionnent pas

**Solution:**
```bash
# Restaurer le backup
cp secrets/backup-TIMESTAMP/production-secrets.env secrets/
cp secrets/backup-TIMESTAMP/clear.txt secrets/

# Consulter les logs
cat secrets/password-reset-*.log

# Contacter le support avec le fichier de log
```

---

## 🔒 Sécurité post-réinitialisation

### Actions immédiates

1. **Sauvegarder les mots de passe dans un gestionnaire sécurisé**
   ```bash
   # Copier le contenu de clear.txt dans:
   # - 1Password
   # - LastPass
   # - Bitwarden
   # - etc.
   ```

2. **Vérifier que les secrets ne sont pas dans Git**
   ```bash
   git status | grep secrets
   # Ne doit rien retourner
   ```

3. **Sécuriser le fichier clear.txt**
   ```bash
   # Vérifier les permissions
   ls -la secrets/clear.txt
   # Doit afficher: -rw------- (600)
   
   # Si besoin, corriger
   chmod 600 secrets/clear.txt
   ```

4. **Distribuer les nouveaux mots de passe**
   - Envoyer de manière sécurisée aux personnes autorisées
   - Utiliser un canal chiffré (Signal, ProtonMail, etc.)
   - Ne JAMAIS envoyer par email non chiffré

---

## 📊 Statistiques de sécurité

Après la réinitialisation, vous avez :

| Élément | Force | Détails |
|---------|-------|---------|
| Mots de passe utilisateurs | ⭐⭐⭐⭐⭐ | 20 caractères alphanumériques |
| Mot de passe MongoDB | ⭐⭐⭐⭐⭐ | 24 caractères alphanumériques |
| JWT Secret | ⭐⭐⭐⭐⭐ | 64 caractères base64 |
| Hashes bcrypt | ⭐⭐⭐⭐⭐ | Cost factor 5 (Traefik), 10 (MongoDB) |

**Estimation résistance brute force:**
- Mots de passe 20 char: ~10^35 combinaisons (~millions d'années)
- JWT Secret 64 char: ~10^112 combinaisons (impossible à brute force)

---

## 📞 Support et ressources

### Documentation

- **Guide complet:** [docs/PASSWORD_RESET_GUIDE.md](../docs/PASSWORD_RESET_GUIDE.md)
- **Scripts:** [scripts/production/README.md](scripts/production/README.md)
- **Architecture:** [.github/copilot-instructions.md](.github/copilot-instructions.md)

### Logs et debugging

```bash
# Log de la réinitialisation
cat secrets/password-reset-*.log

# Logs serveur
ssh root@VOTRE_IP "cd /opt/meeshy && docker-compose logs --tail=100"

# État des conteneurs
ssh root@VOTRE_IP "cd /opt/meeshy && docker-compose ps"
```

### Contact

- **Email:** support@meeshy.me
- **Issues:** https://github.com/jcnm/meeshy/issues

---

## 🎉 Conclusion

Si vous avez suivi toutes les étapes et que tous les tests sont ✅, **félicitations !**

Vous avez réussi à :
- ✅ Réinitialiser tous les mots de passe en production
- ✅ Maintenir tous les services opérationnels
- ✅ Préserver TOUTES les données MongoDB
- ✅ Sécuriser l'infrastructure avec de nouveaux secrets
- ✅ Créer des backups automatiques
- ✅ Documenter toute l'opération

**🔐 Votre infrastructure Meeshy est maintenant sécurisée avec de nouveaux mots de passe !**

---

**Date de création:** 2025-09-15  
**Version:** 1.0.0  
**Temps estimé:** 5-10 minutes  
**Difficulté:** ⭐⭐ (Facile avec le script automatisé)
