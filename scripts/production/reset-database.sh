#!/bin/bash

# Script de reset de la base de données Digital Ocean pour Meeshy
# Ce script supprime complètement la base de données et la recrée
# ATTENTION: Ceci supprimera TOUTES les données existantes !

set -e

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"

# Variables par défaut
DROPLET_IP=""
FORCE_RESET=false
SKIP_CONFIRMATION=false
BACKUP_BEFORE_RESET=true

# Fonctions utilitaires
log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; }

# Fonction pour afficher l'aide
show_help() {
    echo -e "${BLUE}Script de Reset de Base de Données Digital Ocean${NC}"
    echo ""
    echo "Usage: $0 [OPTIONS] DROPLET_IP"
    echo ""
    echo "Arguments:"
    echo "  DROPLET_IP              IP du droplet Digital Ocean"
    echo ""
    echo "Options:"
    echo "  --force                 Forcer le reset sans confirmation"
    echo "  --no-backup             Ne pas créer de backup avant le reset"
    echo "  --help                  Afficher cette aide"
    echo ""
    echo "Description:"
    echo "  Ce script supprime complètement la base de données MongoDB"
    echo "  et la recrée avec les configurations de production."
    echo ""
    echo "  ⚠️  ATTENTION: Ceci supprimera TOUTES les données existantes !"
    echo ""
    echo "Exemples:"
    echo "  $0 157.230.15.51                    # Reset avec confirmation"
    echo "  $0 --force 157.230.15.51            # Reset forcé"
    echo "  $0 --no-backup 157.230.15.51        # Reset sans backup"
    echo ""
}

# Fonction pour tester la connexion SSH
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

# Fonction pour créer un backup de la base de données
create_database_backup() {
    local ip="$1"
    log_info "Création d'un backup de la base de données..."
    
    # Script de backup
    cat << 'EOF' > /tmp/backup-database.sh
#!/bin/bash
set -e

echo "📦 Création du backup de la base de données..."

# Créer le répertoire de backup
mkdir -p /opt/meeshy/backups
BACKUP_DIR="/opt/meeshy/backups"
BACKUP_FILE="$BACKUP_DIR/meeshy-backup-$(date +%Y%m%d-%H%M%S).tar.gz"

# Vérifier que MongoDB est en cours d'exécution
if ! docker-compose ps database | grep -q "Up"; then
    echo "❌ MongoDB n'est pas en cours d'exécution"
    exit 1
fi

# Créer le backup
echo "📦 Création du backup: $BACKUP_FILE"
docker-compose exec -T database mongodump --db meeshy --out /tmp/backup

# Compresser le backup
cd /tmp
tar -czf "$BACKUP_FILE" backup/
rm -rf /tmp/backup

echo "✅ Backup créé: $BACKUP_FILE"

# Lister les backups existants
echo "📋 Backups existants:"
ls -la "$BACKUP_DIR"/*.tar.gz 2>/dev/null || echo "Aucun backup trouvé"

# Nettoyer les anciens backups (garder les 5 derniers)
echo "🧹 Nettoyage des anciens backups..."
cd "$BACKUP_DIR"
ls -t *.tar.gz 2>/dev/null | tail -n +6 | xargs -r rm -f

echo "✅ Backup terminé avec succès"
EOF

    # Transférer et exécuter le script de backup
    scp -o StrictHostKeyChecking=no /tmp/backup-database.sh root@$ip:/tmp/
    ssh -o StrictHostKeyChecking=no root@$ip "chmod +x /tmp/backup-database.sh && cd /opt/meeshy && /tmp/backup-database.sh"
    
    # Nettoyer
    rm -f /tmp/backup-database.sh
    
    log_success "Backup de la base de données créé avec succès"
}

# Fonction pour reset la base de données
reset_database() {
    local ip="$1"
    log_info "Reset de la base de données..."
    
    # Script de reset
    cat << 'EOF' > /tmp/reset-database.sh
#!/bin/bash
set -e

echo "🔄 Reset de la base de données MongoDB..."

# Arrêter tous les services
echo "⏹️  Arrêt des services..."
docker-compose down --remove-orphans || true

# Supprimer les volumes de données
echo "🗑️  Suppression des volumes de données..."
docker volume rm meeshy_mongodb_data 2>/dev/null || true
docker volume rm meeshy_redis_data 2>/dev/null || true
docker volume rm meeshy_models_data 2>/dev/null || true

# Nettoyer le système Docker
echo "🧹 Nettoyage du système Docker..."
docker system prune -f || true
docker volume prune -f || true

# Redémarrer MongoDB
echo "🚀 Redémarrage de MongoDB..."
docker-compose up -d database

# Attendre que MongoDB soit prêt
echo "⏳ Attente que MongoDB soit prêt..."
for i in {1..30}; do
    if docker-compose exec -T database mongosh --eval "db.adminCommand('ping')" >/dev/null 2>&1; then
        echo "✅ MongoDB prêt"
        break
    fi
    echo "⏳ Tentative $i/30..."
    sleep 2
done

# Initialiser le replica set
echo "🔧 Initialisation du replica set..."
docker-compose exec -T database mongosh --eval "
    try {
        rs.initiate({
            _id: 'rs0',
            members: [
                { _id: 0, host: 'meeshy-database:27017' }
            ]
        });
        print('✅ Replica set rs0 initialisé avec succès');
    } catch (e) {
        if (e.message.includes('already initialized')) {
            print('⚠️  Replica set déjà initialisé');
        } else {
            print('❌ Erreur initialisation replica set: ' + e.message);
            throw e;
        }
    }
"

# Attendre que le replica set soit prêt
echo "⏳ Attente que le replica set soit prêt..."
for i in {1..20}; do
    if docker-compose exec -T database mongosh --eval "rs.status().ok" 2>/dev/null | grep -q "1"; then
        echo "✅ Replica set rs0 prêt"
        break
    fi
    echo "⏳ Tentative $i/20 pour le replica set..."
    sleep 3
done

# Vérifier la connexion à la base de données
echo "🔍 Vérification de la connexion à la base de données..."
if docker-compose exec -T database mongosh --eval "use meeshy; db.runCommand('ping')" >/dev/null 2>&1; then
    echo "✅ Base de données 'meeshy' accessible"
else
    echo "❌ Problème de connexion à la base de données"
    exit 1
fi

echo "✅ Reset de la base de données terminé avec succès"
EOF

    # Transférer et exécuter le script de reset
    scp -o StrictHostKeyChecking=no /tmp/reset-database.sh root@$ip:/tmp/
    ssh -o StrictHostKeyChecking=no root@$ip "chmod +x /tmp/reset-database.sh && cd /opt/meeshy && /tmp/reset-database.sh"
    
    # Nettoyer
    rm -f /tmp/reset-database.sh
    
    log_success "Reset de la base de données terminé avec succès"
}

# Fonction pour redémarrer les services avec les nouvelles configurations
restart_services() {
    local ip="$1"
    log_info "Redémarrage des services avec les nouvelles configurations..."
    
    # Script de redémarrage
    cat << 'EOF' > /tmp/restart-services.sh
#!/bin/bash
set -e

echo "🔄 Redémarrage des services avec les nouvelles configurations..."

# Redémarrer Redis
echo "🔴 Redémarrage de Redis..."
docker-compose up -d redis
sleep 2

# Vérifier Redis
for i in {1..10}; do
    if docker-compose exec -T redis redis-cli --no-auth-warning -a MeeshyRedis123 ping >/dev/null 2>&1; then
        echo "✅ Redis prêt"
        break
    fi
    echo "⏳ Tentative $i/10 pour Redis..."
    sleep 2
done

# Redémarrer Translator
echo "🌐 Redémarrage de Translator..."
docker-compose up -d translator
sleep 10

# Vérifier Translator
for i in {1..15}; do
    if curl -f -s http://localhost:8000/health >/dev/null 2>&1; then
        echo "✅ Translator prêt"
        break
    fi
    echo "⏳ Tentative $i/15 pour Translator..."
    sleep 2
done

# Redémarrer Gateway
echo "🚪 Redémarrage de Gateway..."
docker-compose up -d gateway
sleep 5

# Vérifier Gateway
for i in {1..15}; do
    if curl -f -s http://localhost:3000/health >/dev/null 2>&1; then
        echo "✅ Gateway prêt"
        break
    fi
    echo "⏳ Tentative $i/15 pour Gateway..."
    sleep 2
done

# Redémarrer Frontend
echo "🎨 Redémarrage de Frontend..."
docker-compose up -d frontend
sleep 5

# Vérifier Frontend
for i in {1..10}; do
    if docker-compose exec -T frontend curl -f -s http://localhost:3100 >/dev/null 2>&1; then
        echo "✅ Frontend prêt"
        break
    fi
    echo "⏳ Tentative $i/10 pour Frontend..."
    sleep 2
done

echo "📊 État final des services:"
docker-compose ps

echo "✅ Tous les services redémarrés avec succès"
EOF

    # Transférer et exécuter le script de redémarrage
    scp -o StrictHostKeyChecking=no /tmp/restart-services.sh root@$ip:/tmp/
    ssh -o StrictHostKeyChecking=no root@$ip "chmod +x /tmp/restart-services.sh && cd /opt/meeshy && /tmp/restart-services.sh"
    
    # Nettoyer
    rm -f /tmp/restart-services.sh
    
    log_success "Services redémarrés avec succès"
}

# Fonction pour vérifier la santé des services
verify_services_health() {
    local ip="$1"
    log_info "Vérification de la santé des services..."
    
    # Script de vérification
    cat << 'EOF' > /tmp/verify-health.sh
#!/bin/bash
set -e

echo "🏥 Vérification de la santé des services..."

# Vérifier MongoDB
echo "📊 Test MongoDB:"
if docker-compose exec -T database mongosh --eval "db.adminCommand('ping')" >/dev/null 2>&1; then
    echo "✅ MongoDB: Service accessible"
    
    # Vérifier la base de données meeshy
    if docker-compose exec -T database mongosh --eval "use meeshy; db.runCommand('ping')" >/dev/null 2>&1; then
        echo "✅ Base de données 'meeshy': Accessible"
        
        # Vérifier les collections
        collections=$(docker-compose exec -T database mongosh --eval "use meeshy; db.getCollectionNames()" --quiet 2>/dev/null | grep -v "MongoDB\|connecting\|switched" | head -5)
        if [ -n "$collections" ]; then
            echo "✅ Collections détectées: $collections"
        else
            echo "⚠️  Aucune collection détectée (base vide - normal après reset)"
        fi
    else
        echo "❌ Base de données 'meeshy': Non accessible"
        exit 1
    fi
else
    echo "❌ MongoDB: Service inaccessible"
    exit 1
fi

# Vérifier Redis
echo "🔴 Test Redis:"
if docker-compose exec -T redis redis-cli --no-auth-warning -a MeeshyRedis123 ping >/dev/null 2>&1; then
    echo "✅ Redis: Connecté et opérationnel"
else
    echo "❌ Redis: Problème de connexion"
    exit 1
fi

# Vérifier Gateway
echo "🚪 Test Gateway:"
if curl -f -s http://localhost:3000/health >/dev/null 2>&1; then
    echo "✅ Gateway: Health check OK"
else
    echo "❌ Gateway: Health check échoué"
    exit 1
fi

# Vérifier Translator
echo "🌐 Test Translator:"
if curl -f -s http://localhost:8000/health >/dev/null 2>&1; then
    echo "✅ Translator: Health check OK"
else
    echo "❌ Translator: Health check échoué"
    exit 1
fi

# Vérifier Frontend
echo "🎨 Test Frontend:"
if docker-compose exec -T frontend curl -f -s http://localhost:3100 >/dev/null 2>&1; then
    echo "✅ Frontend: Accessible"
else
    echo "❌ Frontend: Non accessible"
    exit 1
fi

echo "🎉 Tous les services sont opérationnels !"
EOF

    # Transférer et exécuter le script de vérification
    scp -o StrictHostKeyChecking=no /tmp/verify-health.sh root@$ip:/tmp/
    ssh -o StrictHostKeyChecking=no root@$ip "chmod +x /tmp/verify-health.sh && cd /opt/meeshy && /tmp/verify-health.sh"
    
    # Nettoyer
    rm -f /tmp/verify-health.sh
    
    log_success "Vérification de la santé des services terminée"
}

# Fonction pour demander confirmation
ask_confirmation() {
    if [ "$SKIP_CONFIRMATION" = true ]; then
        return 0
    fi
    
    echo -e "${RED}⚠️  ATTENTION: Cette opération va supprimer TOUTES les données de la base de données !${NC}"
    echo -e "${YELLOW}📋 Opérations qui seront effectuées:${NC}"
    echo -e "  • Arrêt de tous les services"
    echo -e "  • Suppression des volumes de données MongoDB"
    echo -e "  • Suppression des volumes de données Redis"
    echo -e "  • Suppression des volumes de modèles ML"
    echo -e "  • Nettoyage du système Docker"
    echo -e "  • Recréation de la base de données vide"
    echo -e "  • Redémarrage des services"
    echo ""
    
    if [ "$BACKUP_BEFORE_RESET" = true ]; then
        echo -e "${GREEN}✅ Un backup sera créé avant le reset${NC}"
    else
        echo -e "${RED}❌ Aucun backup ne sera créé${NC}"
    fi
    
    echo ""
    read -p "Êtes-vous sûr de vouloir continuer ? (tapez 'RESET' pour confirmer): " confirmation
    
    if [ "$confirmation" != "RESET" ]; then
        log_error "Opération annulée par l'utilisateur"
        exit 1
    fi
    
    log_success "Confirmation reçue, démarrage du reset..."
}

# Fonction principale
main() {
    # Parser les arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --help)
                show_help
                exit 0
                ;;
            --force)
                FORCE_RESET=true
                SKIP_CONFIRMATION=true
                shift
                ;;
            --no-backup)
                BACKUP_BEFORE_RESET=false
                shift
                ;;
            *)
                if [ -z "$DROPLET_IP" ]; then
                    DROPLET_IP="$1"
                else
                    log_error "Argument inconnu: $1"
                    show_help
                    exit 1
                fi
                shift
                ;;
        esac
    done
    
    # Vérifier que l'IP du droplet est fournie
    if [ -z "$DROPLET_IP" ]; then
        log_error "IP du droplet manquante"
        show_help
        exit 1
    fi
    
    echo -e "${BLUE}🔄 Script de Reset de Base de Données Digital Ocean${NC}"
    echo -e "${BLUE}================================================${NC}"
    echo ""
    echo -e "${YELLOW}🎯 Cible: ${CYAN}$DROPLET_IP${NC}"
    echo ""
    
    # Tester la connexion SSH
    test_ssh_connection "$DROPLET_IP" || exit 1
    
    # Demander confirmation
    ask_confirmation
    
    # Créer un backup si demandé
    if [ "$BACKUP_BEFORE_RESET" = true ]; then
        create_database_backup "$DROPLET_IP"
    fi
    
    # Reset de la base de données
    reset_database "$DROPLET_IP"
    
    # Redémarrer les services
    restart_services "$DROPLET_IP"
    
    # Vérifier la santé des services
    verify_services_health "$DROPLET_IP"
    
    # Afficher le résumé
    echo ""
    log_success "🎉 Reset de la base de données terminé avec succès !"
    echo ""
    echo -e "${BLUE}📋 Résumé des opérations:${NC}"
    echo -e "  • ✅ Connexion SSH établie"
    if [ "$BACKUP_BEFORE_RESET" = true ]; then
        echo -e "  • ✅ Backup de la base de données créé"
    fi
    echo -e "  • ✅ Base de données resetée"
    echo -e "  • ✅ Services redémarrés"
    echo -e "  • ✅ Santé des services vérifiée"
    echo ""
    echo -e "${YELLOW}🔐 Prochaines étapes:${NC}"
    echo -e "  • Utilisez le script de déploiement avec les nouvelles configurations"
    echo -e "  • Les utilisateurs par défaut seront créés automatiquement"
    echo -e "  • Vérifiez que tous les services fonctionnent correctement"
    echo ""
    echo -e "${GREEN}🚀 La base de données est prête pour le déploiement !${NC}"
}

# Exécuter le script principal
main "$@"
