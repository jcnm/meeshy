# Scripts de Test - Architecture Haute Performance

Ce répertoire contient les scripts de test pour valider l'architecture de traduction haute performance de Meeshy.

## 🚀 Scripts Disponibles

### 1. Test Rapide (`quick_test.sh`)
Test rapide pour valider le fonctionnement de base de l'architecture.

```bash
# Test par défaut (10 requêtes)
./quick_test.sh

# Configuration personnalisée
ZMQ_HOST=localhost ZMQ_PORT=5555 ./quick_test.sh
```

**Objectif** : Valider que l'architecture fonctionne correctement
**Durée** : ~30 secondes
**Requêtes** : 10 traductions

### 2. Test de Stress (`test_stress_performance.sh`)
Test de stress complet pour valider les performances sous charge.

```bash
# Test par défaut (600 req/min pendant 60s)
./test_stress_performance.sh

# Test intensif (1200 req/min pendant 2 minutes)
./test_stress_performance.sh --requests-per-minute 1200 --duration 120

# Test avec plus de concurrence
./test_stress_performance.sh --concurrent 100 --requests-per-minute 1800

# Test long (5 minutes)
./test_stress_performance.sh --duration 300
```

**Objectifs** :
- ✅ **Gateway** : 10+ requêtes par seconde
- ✅ **Translator** : 100-1000 traductions par seconde
- ✅ **Fiabilité** : 95%+ de taux de succès

### 3. Monitoring Temps Réel (`monitor_performance.sh`)
Monitoring en temps réel des performances du service.

```bash
# Monitoring par défaut (rafraîchissement toutes les 5s)
./monitor_performance.sh

# Monitoring rapide (rafraîchissement toutes les 2s)
./monitor_performance.sh --interval 2

# Configuration personnalisée
ZMQ_HOST=translator MONITOR_INTERVAL=10 ./monitor_performance.sh
```

**Fonctionnalités** :
- 📊 Métriques en temps réel
- 🎯 Évaluation des objectifs
- 📈 Graphiques de performance
- 🚨 Alertes automatiques

## 📋 Prérequis

### Dépendances Système
```bash
# Ubuntu/Debian
sudo apt-get install python3 python3-pip curl jq netcat

# macOS
brew install python3 curl jq netcat

# CentOS/RHEL
sudo yum install python3 python3-pip curl jq nc
```

### Dépendances Python
```bash
pip3 install zmq asyncio
```

### Service Translator
Le service de traduction doit être démarré :
```bash
cd translator
python3 src/main.py
```

## 🎯 Scénarios de Test

### 1. Test de Validation (Recommandé en premier)
```bash
# Test rapide pour valider l'installation
./quick_test.sh
```

**Résultat attendu** :
```
✅ 1/10: Hello (en→fr) → task_123
✅ 2/10: Good morning (en→es) → task_124
...
🎉 Test réussi!
```

### 2. Test de Performance Standard
```bash
# Test de 600 requêtes par minute (10 req/sec)
./test_stress_performance.sh
```

**Résultats attendus** :
```
🎯 PERFORMANCES GATEWAY (objectif: 10+ req/sec)
Charge moyenne:
  • Requêtes/sec: 45.2
  • Taux de succès: 99.5%
  • Latence moyenne: 22.1ms

🎯 PERFORMANCES TRANSLATOR (objectif: 100-1000 req/sec)
Charge élevée:
  • Requêtes/sec: 250.8
  • Taux de succès: 98.2%
  • Latence moyenne: 15.3ms
```

### 3. Test de Stress Intensif
```bash
# Test de 1800 requêtes par minute (30 req/sec)
./test_stress_performance.sh \
  --requests-per-minute 1800 \
  --concurrent 100 \
  --duration 300
```

### 4. Monitoring Continu
```bash
# Dans un terminal
./monitor_performance.sh

# Dans un autre terminal, lancer des tests
./test_stress_performance.sh --requests-per-minute 1200
```

## 📊 Interprétation des Résultats

### Métriques Clés

| Métrique | Objectif | Excellent | Bon | Insuffisant |
|----------|----------|-----------|-----|-------------|
| **Gateway RPS** | 10+ | 50+ | 20-50 | <20 |
| **Translator RPS** | 100-1000 | 500+ | 200-500 | <200 |
| **Taux de succès** | 95%+ | 99%+ | 95-99% | <95% |
| **Latence moyenne** | <100ms | <50ms | 50-100ms | >100ms |

### Évaluation des Performances

#### 🎉 Performance Excellente
- Gateway : 50+ req/sec
- Translator : 500+ req/sec
- Taux de succès : 99%+
- Latence : <50ms

#### ✅ Performance Bonne
- Gateway : 20-50 req/sec
- Translator : 200-500 req/sec
- Taux de succès : 95-99%
- Latence : 50-100ms

#### ⚠️ Performance Insuffisante
- Gateway : <20 req/sec
- Translator : <200 req/sec
- Taux de succès : <95%
- Latence : >100ms

## 🔧 Configuration Avancée

### Variables d'Environnement

```bash
# Configuration du service
export ZMQ_HOST=localhost
export ZMQ_PORT=5555

# Configuration des tests
export TEST_DURATION=60
export REQUESTS_PER_MINUTE=600
export CONCURRENT_REQUESTS=50

# Configuration du monitoring
export MONITOR_INTERVAL=5
```

### Optimisation des Performances

#### Côté Translator
```bash
# Augmenter le nombre de workers
export TRANSLATION_WORKERS=50

# Augmenter la taille du cache
# Modifier dans src/services/translation_service.py
self.cache = TranslationCache(max_size=50000)
```

#### Côté Gateway
```bash
# Augmenter le pool de connexions
# Modifier dans gateway/src/services/zmq-translation-client.ts
this.zmqClient = new ZMQTranslationClient(
  undefined, // port
  undefined, // host
  30000, // timeout
  200, // max concurrent requests (au lieu de 100)
  20 // pool size (au lieu de 10)
);
```

## 📝 Logs et Résultats

### Fichiers de Logs
- `quick_test_YYYYMMDD_HHMMSS.log` : Logs du test rapide
- `stress_test_YYYYMMDD_HHMMSS.log` : Logs du test de stress
- `monitor_YYYYMMDD_HHMMSS.log` : Logs du monitoring
- `stress_test_results.json` : Résultats détaillés du test de stress

### Analyse des Résultats
```bash
# Analyser les résultats JSON
jq '.requests_per_second' stress_test_results.json
jq '.success_rate' stress_test_results.json
jq '.latencies | length' stress_test_results.json

# Calculer les statistiques
jq '.latencies | [.[] | select(. > 0)] | [mean, median, min, max]' stress_test_results.json
```

## 🚨 Dépannage

### Problèmes Courants

#### 1. Service non accessible
```bash
# Vérifier que le service est démarré
ps aux | grep python3

# Vérifier les ports
netstat -tlnp | grep 5555
```

#### 2. Erreurs ZMQ
```bash
# Vérifier les logs du service
tail -f translator.log

# Redémarrer le service
pkill -f "python3 src/main.py"
cd translator && python3 src/main.py
```

#### 3. Performances insuffisantes
```bash
# Vérifier les ressources système
htop
free -h
iostat

# Augmenter les workers
export TRANSLATION_WORKERS=50
```

### Commandes de Diagnostic
```bash
# Test de connectivité
nc -zv localhost 5555

# Test de santé du service
curl -f http://localhost:8000/health

# Vérifier les processus
ps aux | grep -E "(python3|node)" | grep -v grep
```

## 📈 Amélioration Continue

### Métriques à Surveiller
1. **Requêtes par seconde** : Objectif croissant
2. **Taux de succès** : Maintenir >95%
3. **Latence** : Maintenir <100ms
4. **Utilisation mémoire** : Éviter les fuites
5. **Taille de la file d'attente** : Maintenir <100

### Optimisations Recommandées
1. **Cache distribué** : Redis pour multi-instances
2. **Load balancing** : Plusieurs instances Translator
3. **Modèles GPU** : Accélération CUDA
4. **Monitoring avancé** : Prometheus + Grafana

## 🎯 Objectifs de Performance

### Phase 1 : Validation (Actuel)
- ✅ Gateway : 10+ req/sec
- ✅ Translator : 100-1000 req/sec
- ✅ Fiabilité : 95%+

### Phase 2 : Optimisation
- 🎯 Gateway : 50+ req/sec
- 🎯 Translator : 500+ req/sec
- 🎯 Fiabilité : 99%+

### Phase 3 : Production
- 🎯 Gateway : 100+ req/sec
- 🎯 Translator : 1000+ req/sec
- 🎯 Fiabilité : 99.9%+

## 📞 Support

Pour toute question ou problème :
1. Vérifier les logs dans les fichiers `*_YYYYMMDD_HHMMSS.log`
2. Consulter la documentation d'architecture
3. Exécuter les tests de diagnostic
4. Contacter l'équipe de développement
