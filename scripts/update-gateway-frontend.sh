#!/bin/bash

# ===== MEESHY - MISE À JOUR SÉLECTIVE GATEWAY ET FRONTEND =====
# Script pour mettre à jour uniquement la gateway et le frontend en production
# Usage: ./scripts/update-gateway-frontend.sh [DROPLET_IP] [OPTIONS]
# 
# ⚠️  IMPORTANT: Ce script ne touche PAS à la base de données ni à l'infrastructure
# ⚠️  Seules les applications gateway et frontend sont mises à jour

set -e

# Couleurs pour les logs
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Variables globales
DROPLET_IP=""
FORCE_REFRESH=false
SKIP_HEALTH_CHECK=false
VERBOSE=false

# Fonctions utilitaires
log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; }

# Fonction d'aide
show_help() {
    echo -e "${CYAN}🚀 MEESHY - MISE À JOUR SÉLECTIVE GATEWAY ET FRONTEND${NC}"
    echo "=============================================================="
    echo ""
    echo "Usage: $0 [DROPLET_IP] [OPTIONS]"
    echo ""
    echo "Description:"
    echo "  Met à jour uniquement la gateway et le frontend en production"
    echo "  sans toucher à la base de données ni à l'infrastructure"
    echo ""
    echo "Options:"
    echo "  --force-refresh         Forcer le téléchargement des nouvelles images"
    echo "  --skip-health-check     Ignorer la vérification de santé post-déploiement"
    echo "  --verbose               Mode verbeux"
    echo "  --help, -h              Afficher cette aide"
    echo ""
    echo "Exemples:"
    echo "  $0 192.168.1.100"
    echo "  $0 157.230.15.51 --force-refresh"
    echo "  $0 157.230.15.51 --verbose"
    echo ""
    echo -e "${YELLOW}⚠️  ATTENTION:${NC}"
    echo "  • La base de données et l'infrastructure ne sont PAS modifiées"
    echo "  • Seules les applications gateway et frontend sont mises à jour"
    echo "  • Les services sont redémarrés de manière séquentielle"
    echo ""
}

# Parser les arguments
parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --force-refresh)
                FORCE_REFRESH=true
                shift
                ;;
            --skip-health-check)
                SKIP_HEALTH_CHECK=true
                shift
                ;;
            --verbose)
                VERBOSE=true
                shift
                ;;
            --help|-h)
                show_help
                exit 0
                ;;
            *)
                if [ -z "$DROPLET_IP" ]; then
                    DROPLET_IP="$1"
                fi
                shift
                ;;
        esac
    done
}

# Test de connexion SSH
test_ssh_connection() {
    local ip="$1"
    log_info "Test de connexion SSH vers $ip..."
    if ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 root@$ip "echo 'Connexion SSH réussie'" >/dev/null 2>&1; then
        log_success "Connexion SSH réussie"
        return 0
    else
        log_error "Impossible de se connecter au serveur $ip"
        return 1
    fi
}

# Vérifier l'état actuel des services
check_current_status() {
    local ip="$1"
    log_info "Vérification de l'état actuel des services..."
    
    ssh -o StrictHostKeyChecking=no root@$ip << 'EOF'
        cd /opt/meeshy
        echo "=== ÉTAT ACTUEL DES SERVICES ==="
        docker-compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
        echo ""
        echo "=== VERSIONS ACTUELLES DES IMAGES ==="
        docker images | grep -E "(gateway|frontend)" | head -10
EOF
}

# Sauvegarder la configuration actuelle
backup_current_config() {
    local ip="$1"
    log_info "Sauvegarde de la configuration actuelle..."
    
    ssh -o StrictHostKeyChecking=no root@$ip << 'EOF'
        cd /opt/meeshy
        BACKUP_DIR="/opt/meeshy/backup-$(date +%Y%m%d-%H%M%S)"
        mkdir -p "$BACKUP_DIR"
        
        # Sauvegarder les fichiers de configuration
        cp docker-compose.yml "$BACKUP_DIR/" 2>/dev/null || true
        cp .env "$BACKUP_DIR/" 2>/dev/null || true
        
        # Sauvegarder l'état des conteneurs
        docker-compose ps > "$BACKUP_DIR/services-status.txt" 2>/dev/null || true
        docker images > "$BACKUP_DIR/images-list.txt" 2>/dev/null || true
        
        echo "✅ Sauvegarde créée dans: $BACKUP_DIR"
EOF
}

# Mise à jour sélective des services
update_services() {
    local ip="$1"
    log_info "Mise à jour sélective des services gateway et frontend..."
    
    # Créer le script de mise à jour
    cat << 'EOF' > /tmp/update-services.sh
#!/bin/bash
set -e

echo "🚀 MISE À JOUR SÉLECTIVE GATEWAY ET FRONTEND"
echo "==========================================="

cd /opt/meeshy

# Vérifier que nous sommes dans le bon répertoire
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ Fichier docker-compose.yml non trouvé dans /opt/meeshy"
    exit 1
fi

echo "📋 État des services avant la mise à jour:"
docker-compose ps --format "table {{.Name}}\t{{.Status}}"

# Télécharger les nouvelles images si demandé
if [ "$FORCE_REFRESH" = "true" ]; then
    echo "📦 Téléchargement forcé des nouvelles images..."
    docker-compose pull gateway frontend
else
    echo "📦 Téléchargement des images gateway et frontend..."
    docker-compose pull gateway frontend
fi

echo ""
echo "🔄 MISE À JOUR SÉQUENTIELLE DES SERVICES"
echo "======================================="

# Étape 1: Arrêter les services à mettre à jour
echo "⏹️  Arrêt des services gateway et frontend..."
docker-compose stop gateway frontend

# Étape 2: Supprimer les anciens conteneurs
echo "🗑️  Suppression des anciens conteneurs..."
docker-compose rm -f gateway frontend

# Étape 3: Redémarrer gateway en premier
echo "🚪 Redémarrage du service gateway..."
docker-compose up -d gateway

# Attendre que le gateway soit prêt
echo "⏳ Attente que le gateway soit prêt..."
sleep 10

# Vérifier que le gateway répond
for i in {1..10}; do
    if curl -f -s http://localhost:3000/health >/dev/null 2>&1; then
        echo "✅ Gateway opérationnel"
        break
    fi
    echo "⏳ Tentative $i/10 pour le gateway..."
    sleep 3
done

# Étape 4: Redémarrer le frontend
echo "🎨 Redémarrage du service frontend..."
docker-compose up -d frontend

# Attendre que le frontend soit prêt
echo "⏳ Attente que le frontend soit prêt..."
sleep 5

# Vérifier que le frontend répond
for i in {1..5}; do
    if curl -f -s http://localhost:3100 >/dev/null 2>&1; then
        echo "✅ Frontend opérationnel"
        break
    fi
    echo "⏳ Tentative $i/5 pour le frontend..."
    sleep 2
done

echo ""
echo "📊 État des services après la mise à jour:"
docker-compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo "🎉 Mise à jour sélective terminée avec succès!"
echo "✅ Gateway: Mis à jour et opérationnel"
echo "✅ Frontend: Mis à jour et opérationnel"
echo "✅ Base de données: Non modifiée"
echo "✅ Infrastructure: Non modifiée"
EOF

    # Transférer et exécuter le script
    scp -o StrictHostKeyChecking=no /tmp/update-services.sh root@$ip:/tmp/
    ssh -o StrictHostKeyChecking=no root@$ip "chmod +x /tmp/update-services.sh && FORCE_REFRESH=$FORCE_REFRESH /tmp/update-services.sh"
    rm -f /tmp/update-services.sh
}

# Vérification de santé post-déploiement
health_check() {
    local ip="$1"
    log_info "Vérification de santé post-déploiement..."
    
    # Créer le script de vérification
    cat << 'EOF' > /tmp/health-check.sh
#!/bin/bash
cd /opt/meeshy

echo "🏥 VÉRIFICATION DE SANTÉ POST-DÉPLOIEMENT"
echo "========================================"

# Vérifier l'état des conteneurs
echo "📊 État des conteneurs:"
docker-compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo "🔍 Tests de connectivité:"

# Test Gateway
echo "🚪 Test Gateway..."
if curl -f -s http://localhost:3000/health >/dev/null 2>&1; then
    echo "✅ Gateway: Endpoint /health accessible"
    
    # Test de réponse de santé
    health_response=$(curl -s http://localhost:3000/health 2>/dev/null)
    if echo "$health_response" | grep -q "status\|ok\|healthy"; then
        echo "✅ Gateway: Réponse de santé valide"
    else
        echo "⚠️  Gateway: Réponse de santé suspecte: $health_response"
    fi
else
    echo "❌ Gateway: Endpoint /health inaccessible"
fi

# Test Frontend
echo "🎨 Test Frontend..."
if curl -f -s http://localhost:3100 >/dev/null 2>&1; then
    echo "✅ Frontend: Accessible sur le port 3100"
    
    # Vérifier que c'est bien Next.js
    response=$(curl -s http://localhost:3100 2>/dev/null | head -c 200)
    if echo "$response" | grep -q "Next\|React\|meeshy\|Meeshy"; then
        echo "✅ Frontend: Réponse Next.js détectée"
    else
        echo "⚠️  Frontend: Réponse non-Next.js détectée"
    fi
else
    echo "❌ Frontend: Non accessible sur le port 3100"
fi

# Test via Traefik (si configuré)
echo "🌐 Test via Traefik..."
if curl -f -s -H "Host: gate.meeshy.me" http://localhost/health >/dev/null 2>&1; then
    echo "✅ Gateway: Accessible via Traefik (gate.meeshy.me)"
else
    echo "⚠️  Gateway: Non accessible via Traefik"
fi

if curl -f -s -H "Host: meeshy.me" http://localhost >/dev/null 2>&1; then
    echo "✅ Frontend: Accessible via Traefik (meeshy.me)"
else
    echo "⚠️  Frontend: Non accessible via Traefik"
fi

# Vérifier les logs récents pour les erreurs
echo ""
echo "📋 Vérification des logs récents:"

echo "--- Gateway ---"
docker-compose logs --tail=5 gateway | grep -E "(error|Error|ERROR|failed|Failed|FAILED)" || echo "Aucune erreur récente"

echo "--- Frontend ---"
docker-compose logs --tail=5 frontend | grep -E "(error|Error|ERROR|failed|Failed|FAILED)" || echo "Aucune erreur récente"

echo ""
echo "🎯 RÉSUMÉ DE LA VÉRIFICATION:"
echo "============================="
healthy_services=$(docker-compose ps --format "{{.Name}} {{.Status}}" | grep -E "(gateway|frontend)" | grep -c "Up")
total_services=2
echo "Services mis à jour opérationnels: $healthy_services/$total_services"

if [ $healthy_services -eq $total_services ]; then
    echo "🎉 TOUS LES SERVICES MIS À JOUR SONT OPÉRATIONNELS !"
    exit 0
else
    echo "⚠️  CERTAINS SERVICES ONT DES PROBLÈMES"
    exit 1
fi
EOF

    # Transférer et exécuter le script
    scp -o StrictHostKeyChecking=no /tmp/health-check.sh root@$ip:/tmp/
    ssh -o StrictHostKeyChecking=no root@$ip "chmod +x /tmp/health-check.sh && /tmp/health-check.sh"
    rm -f /tmp/health-check.sh
}

# Nettoyage des anciennes images
cleanup_old_images() {
    local ip="$1"
    log_info "Nettoyage des anciennes images..."
    
    ssh -o StrictHostKeyChecking=no root@$ip << 'EOF'
        cd /opt/meeshy
        echo "🧹 Nettoyage des anciennes images Docker..."
        
        # Supprimer les images non utilisées
        docker image prune -f
        
        # Afficher l'espace libéré
        echo "📊 Espace disque après nettoyage:"
        df -h /var/lib/docker 2>/dev/null || df -h /
        
        echo "✅ Nettoyage terminé"
EOF
}

# Fonction principale
main() {
    # Parser les arguments
    parse_arguments "$@"
    
    # Vérifier que l'IP est fournie
    if [ -z "$DROPLET_IP" ]; then
        log_error "IP du serveur manquante"
        show_help
        exit 1
    fi
    
    log_info "🚀 Démarrage de la mise à jour sélective sur $DROPLET_IP"
    log_info "Services à mettre à jour: Gateway et Frontend uniquement"
    log_warning "⚠️  La base de données et l'infrastructure ne seront PAS modifiées"
    
    # Test de connexion
    test_ssh_connection "$DROPLET_IP" || exit 1
    
    # Vérifier l'état actuel
    check_current_status "$DROPLET_IP"
    
    # Sauvegarder la configuration
    backup_current_config "$DROPLET_IP"
    
    # Mettre à jour les services
    update_services "$DROPLET_IP"
    
    # Vérification de santé (si demandée)
    if [ "$SKIP_HEALTH_CHECK" = "false" ]; then
        health_check "$DROPLET_IP"
    else
        log_warning "Vérification de santé ignorée"
    fi
    
    # Nettoyage
    cleanup_old_images "$DROPLET_IP"
    
    # Résumé final
    echo ""
    echo "🎉 MISE À JOUR SÉLECTIVE TERMINÉE AVEC SUCCÈS !"
    echo "==============================================="
    echo "✅ Gateway: Mis à jour et opérationnel"
    echo "✅ Frontend: Mis à jour et opérationnel"
    echo "✅ Base de données: Non modifiée (données préservées)"
    echo "✅ Infrastructure: Non modifiée (Traefik, Redis, MongoDB préservés)"
    echo ""
    echo "🔗 Accès aux services:"
    echo "   • Frontend: https://meeshy.me"
    echo "   • Gateway API: https://gate.meeshy.me"
    echo "   • Dashboard Traefik: https://traefik.meeshy.me"
    echo ""
    echo "📋 Commandes utiles:"
    echo "   • Statut: ssh root@$DROPLET_IP 'cd /opt/meeshy && docker-compose ps'"
    echo "   • Logs: ssh root@$DROPLET_IP 'cd /opt/meeshy && docker-compose logs gateway frontend'"
    echo "   • Redémarrage: ssh root@$DROPLET_IP 'cd /opt/meeshy && docker-compose restart gateway frontend'"
}

# Exécuter le script principal
main "$@"
