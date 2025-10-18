#!/bin/bash

# ===== MEESHY - MISE À JOUR PRODUCTION COMPLÈTE =====
# Script principal pour orchestrer la mise à jour complète en production
# Usage: ./scripts/update-production.sh [DROPLET_IP] [OPTIONS]

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
SKIP_DECOMMISSION=false
SKIP_HEALTH_CHECK=false
VERBOSE=false
DRY_RUN=false

# Fonctions utilitaires
log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; }

# Fonction d'aide
show_help() {
    echo -e "${CYAN}🚀 MEESHY - MISE À JOUR PRODUCTION COMPLÈTE${NC}"
    echo "=============================================="
    echo ""
    echo "Usage: $0 [DROPLET_IP] [OPTIONS]"
    echo ""
    echo "Description:"
    echo "  Orchestre la mise à jour complète de gateway et frontend en production"
    echo "  en décommissionnant les versions actuelles et déployant les nouvelles"
    echo ""
    echo "Options:"
    echo "  --force-refresh         Forcer le téléchargement des nouvelles images"
    echo "  --skip-decommission     Ignorer l'étape de décommissionnement"
    echo "  --skip-health-check     Ignorer la vérification de santé post-déploiement"
    echo "  --dry-run               Simulation sans modification"
    echo "  --verbose               Mode verbeux"
    echo "  --help, -h              Afficher cette aide"
    echo ""
    echo "Exemples:"
    echo "  $0 192.168.1.100"
    echo "  $0 157.230.15.51 --force-refresh"
    echo "  $0 157.230.15.51 --skip-decommission"
    echo "  $0 157.230.15.51 --dry-run --verbose"
    echo ""
    echo -e "${YELLOW}⚠️  ATTENTION:${NC}"
    echo "  • Ce script met à jour uniquement gateway et frontend"
    echo "  • La base de données et l'infrastructure ne sont PAS modifiées"
    echo "  • Les services sont redémarrés de manière séquentielle"
    echo ""
    echo -e "${GREEN}📋 Processus de mise à jour:${NC}"
    echo "  1. Vérification de l'état actuel"
    echo "  2. Décommissionnement des services actuels (optionnel)"
    echo "  3. Mise à jour des services avec les nouvelles versions"
    echo "  4. Vérification de santé post-déploiement"
    echo "  5. Nettoyage des anciennes images"
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
            --skip-decommission)
                SKIP_DECOMMISSION=true
                shift
                ;;
            --skip-health-check)
                SKIP_HEALTH_CHECK=true
                shift
                ;;
            --dry-run)
                DRY_RUN=true
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

# Vérification préliminaire
preliminary_check() {
    local ip="$1"
    log_info "Vérification préliminaire de l'environnement..."
    
    ssh -o StrictHostKeyChecking=no root@$ip << 'EOF'
        cd /opt/meeshy
        echo "🔍 VÉRIFICATION PRÉLIMINAIRE"
        echo "============================"
        
        # Vérifier que le répertoire existe
        if [ ! -d "/opt/meeshy" ]; then
            echo "❌ Répertoire /opt/meeshy non trouvé"
            exit 1
        fi
        
        # Vérifier que docker-compose.yml existe
        if [ ! -f "docker-compose.yml" ]; then
            echo "❌ Fichier docker-compose.yml non trouvé"
            exit 1
        fi
        
        # Vérifier que Docker est installé
        if ! command -v docker &> /dev/null; then
            echo "❌ Docker non installé"
            exit 1
        fi
        
        # Vérifier que Docker Compose est installé
        if ! command -v docker-compose &> /dev/null; then
            echo "❌ Docker Compose non installé"
            exit 1
        fi
        
        echo "✅ Environnement vérifié"
        echo ""
        echo "📊 État actuel des services:"
        docker-compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
EOF
}

# Décommissionnement des services
decommission_services() {
    local ip="$1"
    
    if [ "$SKIP_DECOMMISSION" = "true" ]; then
        log_warning "Décommissionnement ignoré (--skip-decommission)"
        return 0
    fi
    
    log_info "Décommissionnement des services actuels..."
    
    # Vérifier que le script de décommissionnement existe
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    DECOMMISSION_SCRIPT="$SCRIPT_DIR/decommission-services.sh"
    
    if [ ! -f "$DECOMMISSION_SCRIPT" ]; then
        log_error "Script de décommissionnement non trouvé: $DECOMMISSION_SCRIPT"
        exit 1
    fi
    
    # Construire la commande
    CMD="$DECOMMISSION_SCRIPT $ip --force"
    
    if [ "$VERBOSE" = "true" ]; then
        CMD="$CMD --verbose"
    fi
    
    # Exécuter le script de décommissionnement
    if [ "$DRY_RUN" = "true" ]; then
        log_info "Mode --dry-run: Simulation du décommissionnement"
        log_info "Commande qui serait exécutée: $CMD"
    else
        eval "$CMD"
    fi
}

# Mise à jour des services
update_services() {
    local ip="$1"
    log_info "Mise à jour des services avec les nouvelles versions..."
    
    # Vérifier que le script de mise à jour existe
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    UPDATE_SCRIPT="$SCRIPT_DIR/update-gateway-frontend.sh"
    
    if [ ! -f "$UPDATE_SCRIPT" ]; then
        log_error "Script de mise à jour non trouvé: $UPDATE_SCRIPT"
        exit 1
    fi
    
    # Construire la commande
    CMD="$UPDATE_SCRIPT $ip"
    
    if [ "$FORCE_REFRESH" = "true" ]; then
        CMD="$CMD --force-refresh"
    fi
    
    if [ "$SKIP_HEALTH_CHECK" = "true" ]; then
        CMD="$CMD --skip-health-check"
    fi
    
    if [ "$VERBOSE" = "true" ]; then
        CMD="$CMD --verbose"
    fi
    
    # Exécuter le script de mise à jour
    if [ "$DRY_RUN" = "true" ]; then
        log_info "Mode --dry-run: Simulation de la mise à jour"
        log_info "Commande qui serait exécutée: $CMD"
    else
        eval "$CMD"
    fi
}

# Vérification finale
final_verification() {
    local ip="$1"
    log_info "Vérification finale de la mise à jour..."
    
    ssh -o StrictHostKeyChecking=no root@$ip << 'EOF'
        cd /opt/meeshy
        echo "🔍 VÉRIFICATION FINALE"
        echo "======================"
        
        echo "📊 État final des services:"
        docker-compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
        
        echo ""
        echo "🔍 Tests de connectivité:"
        
        # Test Gateway
        if curl -f -s http://localhost:3000/health >/dev/null 2>&1; then
            echo "✅ Gateway: Endpoint /health accessible"
        else
            echo "❌ Gateway: Endpoint /health inaccessible"
        fi
        
        # Test Frontend
        if curl -f -s http://localhost:3100 >/dev/null 2>&1; then
            echo "✅ Frontend: Accessible sur le port 3100"
        else
            echo "❌ Frontend: Non accessible sur le port 3100"
        fi
        
        # Test via Traefik
        if curl -f -s -H "Host: gate.meeshy.me" http://localhost/health >/dev/null 2>&1; then
            echo "✅ Gateway: Accessible via Traefik"
        else
            echo "⚠️  Gateway: Non accessible via Traefik"
        fi
        
        if curl -f -s -H "Host: meeshy.me" http://localhost >/dev/null 2>&1; then
            echo "✅ Frontend: Accessible via Traefik"
        else
            echo "⚠️  Frontend: Non accessible via Traefik"
        fi
        
        echo ""
        echo "📋 Versions des images:"
        docker images | grep -E "(gateway|frontend)" | head -5
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
    
    log_info "🚀 Démarrage de la mise à jour production complète sur $DROPLET_IP"
    
    if [ "$DRY_RUN" = "true" ]; then
        log_warning "Mode --dry-run activé: Aucune modification ne sera effectuée"
    fi
    
    # VALIDATION CRITIQUE DE LA CONFIGURATION (NOUVEAU)
    log_info "Validation de la configuration avant mise à jour"
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    VALIDATE_SCRIPT="$SCRIPT_DIR/deployment/deploy-validate-config.sh"
    
    if [ -f "$VALIDATE_SCRIPT" ]; then
        if ! "$VALIDATE_SCRIPT" "env.production"; then
            log_error "Validation de configuration échouée - Mise à jour annulée"
            log_error "Corrigez les erreurs de configuration avant de continuer"
            exit 1
        fi
        log_success "Configuration validée avec succès"
    else
        log_warning "Script de validation non trouvé: $VALIDATE_SCRIPT"
        log_warning "Continuer sans validation de configuration (non recommandé)"
        read -p "Voulez-vous continuer sans validation? (yes/NO): " confirm
        if [ "$confirm" != "yes" ]; then
            log_info "Mise à jour annulée par l'utilisateur"
            exit 0
        fi
    fi
    
    log_info "Services à mettre à jour: Gateway et Frontend uniquement"
    log_warning "⚠️  La base de données et l'infrastructure ne seront PAS modifiées"
    
    # Test de connexion
    test_ssh_connection "$DROPLET_IP" || exit 1
    
    # Vérification préliminaire
    preliminary_check "$DROPLET_IP"
    
    # Décommissionnement des services
    decommission_services "$DROPLET_IP"
    
    # Mise à jour des services
    update_services "$DROPLET_IP"
    
    # Vérification finale
    final_verification "$DROPLET_IP"
    
    # Résumé final
    echo ""
    echo "🎉 MISE À JOUR PRODUCTION COMPLÈTE TERMINÉE AVEC SUCCÈS !"
    echo "========================================================"
    echo "✅ Gateway: Mis à jour et opérationnel"
    echo "✅ Frontend: Mis à jour et opérationnel"
    echo "✅ Base de données: Préservée (données intactes)"
    echo "✅ Infrastructure: Préservée (Traefik, Redis, MongoDB opérationnels)"
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
    echo ""
    
    if [ "$DRY_RUN" = "true" ]; then
        log_warning "Mode --dry-run: Aucune modification n'a été effectuée"
        log_info "Pour exécuter réellement la mise à jour, relancez sans --dry-run"
    fi
}

# Exécuter le script principal
main "$@"
