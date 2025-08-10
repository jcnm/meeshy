# Service Translator Meeshy - Base de données intégrée

## Nouvelles fonctionnalités

### 🗄️ Service de base de données Prisma intégré

Le service Translator inclut maintenant un service de base de données dédié qui :

- **Teste automatiquement la connexion** à la base de données au démarrage
- **Log les tentatives de connexion** avec retry automatique
- **Vérifie la santé** de la connexion avec des requêtes de test
- **Intègre proprement** avec les autres services (Translation, Message)
- **Gère les erreurs** et basculements en mode dégradé

### 📁 Nouveaux fichiers

- `src/services/database_service.py` - Service principal de gestion de la base de données
- `test_database_connection.py` - Script de test de connexion
- `diagnostic_startup.py` - Diagnostic complet du démarrage
- `DATABASE_INTEGRATION.md` - Cette documentation

## Utilisation

### 🚀 Démarrage normal

```bash
# Démarrage du service (avec test de DB automatique)
python main.py
```

### 🧪 Tests de connectivité

```bash
# Test simple de la connexion à la base de données
python test_database_connection.py

# Diagnostic complet du système
python diagnostic_startup.py
```

### 📊 Logs de démarrage

Le service affiche maintenant des logs détaillés au démarrage :

```
🗄️  Initialisation du service de base de données...
🔄 Tentative de connexion à la base de données (1/5)...
✅ Connexion Prisma établie
🧪 Test de la connexion à la base de données...
✅ Test 1: Requête raw réussie
✅ Test 2: Comptage des utilisateurs réussi (0 utilisateurs)
✅ Test 3: Comptage des messages réussi (0 messages)
✅ Test 4: Comptage des traductions réussi (0 traductions)
🎯 Tous les tests de connexion à la base de données sont terminés
✅ Service de base de données initialisé avec succès
📊 Base de données connectée après 1 tentative(s)
```

## Architecture

### 🔗 Intégration des services

```
MeeshyTranslationServer
├── DatabaseService (nouveau)
│   ├── Test de connexion automatique
│   ├── Retry avec backoff
│   └── Health checks
├── TranslationService 
│   └── Utilise DatabaseService
├── MessageService
│   └── Utilise DatabaseService
├── ZMQServer
└── FastAPI
```

### 🔄 Gestion des erreurs

- **Mode dégradé** : Si la base de données n'est pas disponible, les services continuent de fonctionner
- **Retry automatique** : Jusqu'à 5 tentatives avec délai croissant
- **Logs détaillés** : Chaque étape est loggée pour le debugging
- **Health checks** : Vérification continue de la connectivité

## Configuration

### Variables d'environnement

Le service utilise la variable `DATABASE_URL` du fichier `.env.docker` :

```bash
DATABASE_URL="postgresql://meeshy_user:meeshy_password@postgres:5432/meeshy_db?schema=public"
```

### Paramètres de connexion

- **Timeout de connexion** : 30 secondes
- **Nombre de retry** : 5 tentatives maximum
- **Délai entre retry** : 2s, puis 3s, puis 4.5s, etc. (max 10s)
- **Logs de requêtes** : Activés en développement

## API du DatabaseService

### Méthodes principales

```python
# Initialisation avec test de connexion
await database_service.initialize()

# Health check
health = await database_service.health_check()

# Statistiques de connexion
stats = await database_service.get_connection_stats()

# Reconnexion manuelle
await database_service.reconnect()

# Nettoyage
await database_service.cleanup()

# Accès au client Prisma
prisma = database_service.get_prisma_client()
```

### Exemple d'utilisation

```python
from services.database_service import DatabaseService

# Créer le service
db_service = DatabaseService()

# Initialiser avec tests automatiques
if await db_service.initialize():
    print("Base de données connectée !")
    
    # Utiliser Prisma
    prisma = db_service.get_prisma_client()
    if prisma:
        users = await prisma.user.find_many()
        print(f"Nombre d'utilisateurs: {len(users)}")

# Nettoyer
await db_service.cleanup()
```

## Monitoring

### Health checks

Le service expose des informations de santé via l'API :

```json
{
  "database_connected": true,
  "prisma_client_initialized": true,
  "connection_retries": 0,
  "database_responsive": true,
  "last_ping": "2025-01-10T10:30:00.000Z"
}
```

### Métriques de performance

- Temps de connexion initial
- Nombre de retry effectués  
- Temps de réponse des requêtes de test
- Statut de la connexion en temps réel

## Troubleshooting

### Base de données non accessible

Si la base de données n'est pas accessible :

1. **Vérifiez la variable `DATABASE_URL`**
2. **Utilisez le diagnostic** : `python diagnostic_startup.py`
3. **Vérifiez les logs** dans `logs/translation_service.log`
4. **Le service continue en mode dégradé**

### Erreurs de connexion

```bash
# Logs typiques d'erreur
❌ Tentative 1 échouée: connection refused
⏳ Nouvelle tentative dans 2 secondes...
❌ Tentative 2 échouée: timeout
⏳ Nouvelle tentative dans 3 secondes...
```

### Mode dégradé

En mode dégradé, le service :
- ✅ Continue de fonctionner pour les traductions
- ⚠️ Ne peut pas enregistrer en base de données
- 📝 Log toutes les tentatives de reconnexion
- 🔄 Peut être reconnecté manuellement

## Prochaines étapes

- [ ] Ajout de métriques Prometheus pour la base de données
- [ ] Cache de reconnexion automatique en arrière-plan
- [ ] Support de pools de connexions multiples
- [ ] Dashboard de monitoring de la base de données
