#!/bin/bash

# ╔═══════════════════════════════════════════════════════════════════════════╗
# ║                                                                           ║
# ║  🔐 RÉINITIALISATION MOTS DE PASSE MEESHY - PRODUCTION                  ║
# ║                                                                           ║
# ║  ✅ SANS PERTE DE DONNÉES                                                ║
# ║  ⚡ 5 MINUTES CHRONO                                                     ║
# ║  🔒 100% SÉCURISÉ                                                        ║
# ║                                                                           ║
# ╚═══════════════════════════════════════════════════════════════════════════╝

echo ""
echo "╔═══════════════════════════════════════════════════════════════════════════╗"
echo "║                    RÉINITIALISATION RAPIDE - 3 ÉTAPES                     ║"
echo "╚═══════════════════════════════════════════════════════════════════════════╝"
echo ""

# ═════════════════════════════════════════════════════════════════════════════
# ÉTAPE 1 : INSTALLER PRÉREQUIS (une seule fois)
# ═════════════════════════════════════════════════════════════════════════════

echo "📦 ÉTAPE 1 : Installer htpasswd (si pas déjà fait)"
echo "   Commande : brew install httpd"
echo ""
read -p "   htpasswd est-il installé ? (o/n) : " installed

if [ "$installed" != "o" ]; then
    echo "   Installation de htpasswd..."
    brew install httpd
    echo "   ✅ htpasswd installé"
fi

echo ""

# ═════════════════════════════════════════════════════════════════════════════
# ÉTAPE 2 : RÉCUPÉRER L'IP DU SERVEUR
# ═════════════════════════════════════════════════════════════════════════════

echo "🌐 ÉTAPE 2 : Récupérer l'IP de votre serveur DigitalOcean"
echo ""
read -p "   Entrez l'IP du serveur (ex: 157.230.15.51) : " DROPLET_IP

if [ -z "$DROPLET_IP" ]; then
    echo "   ❌ IP requise. Annulation."
    exit 1
fi

echo "   ✅ IP enregistrée : $DROPLET_IP"
echo ""

# Tester la connexion SSH
echo "   Test de connexion SSH..."
if ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 root@$DROPLET_IP "echo 'OK'" >/dev/null 2>&1; then
    echo "   ✅ Connexion SSH réussie"
else
    echo "   ❌ Impossible de se connecter à $DROPLET_IP"
    echo "   Vérifiez l'IP et votre configuration SSH"
    exit 1
fi

echo ""

# ═════════════════════════════════════════════════════════════════════════════
# ÉTAPE 3 : EXÉCUTER LA RÉINITIALISATION
# ═════════════════════════════════════════════════════════════════════════════

echo "🚀 ÉTAPE 3 : Exécuter la réinitialisation"
echo ""
echo "   ⚠️  ATTENTION :"
echo "   • Les services seront brièvement interrompus (~30 secondes)"
echo "   • Les données MongoDB ne seront PAS affectées"
echo "   • Un backup sera créé automatiquement"
echo ""
read -p "   Voulez-vous continuer ? (oui/non) : " confirm

if [ "$confirm" != "oui" ]; then
    echo "   ⚠️  Annulation"
    exit 0
fi

echo ""
echo "   📝 Exécution du script de réinitialisation..."
echo ""

# Naviguer vers le répertoire du projet
cd "$(dirname "$0")"

# Exécuter le script de réinitialisation
./scripts/production/reset-production-passwords.sh "$DROPLET_IP"

# Vérifier le code de retour
if [ $? -eq 0 ]; then
    echo ""
    echo "   ✅ Réinitialisation réussie !"
    echo ""
    
    # Proposer de vérifier
    echo "   🔍 Voulez-vous vérifier que tout fonctionne ?"
    read -p "   Lancer la vérification ? (o/n) : " verify
    
    if [ "$verify" == "o" ]; then
        echo ""
        ./scripts/production/verify-password-reset.sh "$DROPLET_IP"
    fi
    
    echo ""
    echo "╔═══════════════════════════════════════════════════════════════════════════╗"
    echo "║                         🎉 OPÉRATION TERMINÉE !                           ║"
    echo "╚═══════════════════════════════════════════════════════════════════════════╝"
    echo ""
    echo "📋 PROCHAINES ÉTAPES :"
    echo ""
    echo "   1. Consulter les nouveaux mots de passe :"
    echo "      cat secrets/clear.txt"
    echo ""
    echo "   2. Tester les interfaces :"
    echo "      • Traefik : https://traefik.meeshy.me"
    echo "      • MongoDB : https://mongo.meeshy.me"
    echo "      • Redis   : https://redis.meeshy.me"
    echo "      • App     : https://meeshy.me"
    echo ""
    echo "   3. Sauvegarder dans gestionnaire de mots de passe"
    echo ""
    echo "   4. Consulter le log complet :"
    echo "      cat secrets/password-reset-*.log"
    echo ""
    echo "📚 DOCUMENTATION COMPLÈTE :"
    echo "   cat docs/PASSWORD_RESET_INDEX.md"
    echo ""
    
else
    echo ""
    echo "   ❌ Erreur lors de la réinitialisation"
    echo ""
    echo "   📋 TROUBLESHOOTING :"
    echo "   • Consulter le log : cat secrets/password-reset-*.log"
    echo "   • Voir la doc : cat docs/PASSWORD_RESET_GUIDE.md"
    echo "   • Contact : support@meeshy.me"
    echo ""
    exit 1
fi

echo ""
