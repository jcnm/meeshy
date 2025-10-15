#!/bin/bash
# AIDE-MÉMOIRE ULTRA-RAPIDE - RÉINITIALISATION MOTS DE PASSE MEESHY
# Copier-coller ces commandes directement dans le terminal

# ═════════════════════════════════════════════════════════════════
# PRÉPARATION (une seule fois)
# ═════════════════════════════════════════════════════════════════

# Installer htpasswd (macOS uniquement, si pas déjà installé)
brew install httpd

# Ou sur Linux:
# sudo apt install apache2-utils

# ═════════════════════════════════════════════════════════════════
# RÉINITIALISATION COMPLÈTE (5 minutes)
# ═════════════════════════════════════════════════════════════════

# 1. Naviguer vers le projet
cd /Users/smpceo/Documents/Services/Meeshy/meeshy

# 2. Exécuter le script de réinitialisation
# ⚠️ REMPLACER VOTRE_IP_DROPLET par l'IP réelle du serveur
./scripts/production/reset-production-passwords.sh VOTRE_IP_DROPLET

# Exemple avec une vraie IP:
# ./scripts/production/reset-production-passwords.sh 157.230.15.51

# 3. Vérifier que tout fonctionne
./scripts/production/verify-password-reset.sh VOTRE_IP_DROPLET

# 4. Consulter les nouveaux mots de passe
cat secrets/clear.txt

# 5. Afficher juste les mots de passe principaux
grep "PASSWORD_CLEAR" secrets/clear.txt

# ═════════════════════════════════════════════════════════════════
# TESTS MANUELS (2 minutes)
# ═════════════════════════════════════════════════════════════════

# Ouvrir dans le navigateur et tester avec les mots de passe de clear.txt:

# Traefik Dashboard:
echo "https://traefik.meeshy.me"
echo "Utilisateur: admin | Mot de passe: voir secrets/clear.txt"

# MongoDB UI:
echo "https://mongo.meeshy.me"
echo "Utilisateur: admin | Mot de passe: voir secrets/clear.txt"

# Redis UI:
echo "https://redis.meeshy.me"
echo "Utilisateur: admin | Mot de passe: voir secrets/clear.txt"

# Application Meeshy:
echo "https://meeshy.me"
echo "Tester: admin, meeshy, atabeth | Mots de passe: voir secrets/clear.txt"

# ═════════════════════════════════════════════════════════════════
# COMMANDES UTILES
# ═════════════════════════════════════════════════════════════════

# Consulter le log de la dernière réinitialisation
ls -lt secrets/password-reset-*.log | head -1 | awk '{print $NF}' | xargs cat

# Lister tous les backups disponibles
ls -la secrets/backup-*/

# Vérifier que secrets n'est pas dans Git
git status | grep secrets

# Se connecter au serveur
ssh root@VOTRE_IP_DROPLET

# Vérifier l'état des conteneurs sur le serveur
ssh root@VOTRE_IP_DROPLET "cd /opt/meeshy && docker-compose ps"

# Consulter les logs du Gateway sur le serveur
ssh root@VOTRE_IP_DROPLET "cd /opt/meeshy && docker-compose logs --tail=50 gateway"

# ═════════════════════════════════════════════════════════════════
# RESTAURATION D'UN BACKUP (en cas de problème)
# ═════════════════════════════════════════════════════════════════

# 1. Lister les backups disponibles
ls -la secrets/backup-*/

# 2. Restaurer un backup spécifique (remplacer TIMESTAMP)
# cp secrets/backup-TIMESTAMP/production-secrets.env secrets/
# cp secrets/backup-TIMESTAMP/clear.txt secrets/

# 3. Relancer la réinitialisation avec les anciens mots de passe
# ./scripts/production/reset-production-passwords.sh VOTRE_IP_DROPLET

# ═════════════════════════════════════════════════════════════════
# SÉCURITÉ - CHECKLIST RAPIDE
# ═════════════════════════════════════════════════════════════════

# ✅ Vérifier les permissions de clear.txt (doit être 600)
ls -la secrets/clear.txt

# ✅ Vérifier que secrets n'est pas committé
git status | grep secrets
# Ne doit rien retourner

# ✅ Sauvegarder dans gestionnaire de mots de passe
# Copier le contenu de secrets/clear.txt dans 1Password/LastPass/Bitwarden

# ═════════════════════════════════════════════════════════════════
# RÉFÉRENCE RAPIDE - URLS DE PRODUCTION
# ═════════════════════════════════════════════════════════════════

# Frontend:             https://meeshy.me
# Gateway API:          https://gate.meeshy.me
# Translator ML:        https://ml.meeshy.me
# Traefik Dashboard:    https://traefik.meeshy.me
# MongoDB UI:           https://mongo.meeshy.me
# Redis UI:             https://redis.meeshy.me

# ═════════════════════════════════════════════════════════════════
# AIDE ET DOCUMENTATION
# ═════════════════════════════════════════════════════════════════

# Guide rapide (ce fichier):
cat QUICK_PASSWORD_RESET.md

# Guide complet:
cat docs/PASSWORD_RESET_GUIDE.md

# README des scripts:
cat scripts/production/README.md

# Aide du script:
./scripts/production/reset-production-passwords.sh --help
./scripts/production/verify-password-reset.sh --help
