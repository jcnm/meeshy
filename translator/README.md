# 🌍 Service de Traduction Meeshy

Service de traduction gRPC unifié utilisant les modèles NLLB de production.

## 🏗️ Architecture Propre

```
translation-service/
├── main.py                    # Point d'entrée principal
├── run.sh                     # Script de démarrage
├── requirements.txt           # Dépendances Python
├── translation.proto          # Définition gRPC
├── test_interactive.py        # Test interactif
└── src/
    ├── translation_service.py # Service gRPC unifié
    ├── translation_pb2.py     # Code généré gRPC
    └── translation_pb2_grpc.py
```

## 🚀 Démarrage Rapide

### 1. Démarrer le serveur
```bash
# Avec le script bash
./run.sh

# Ou directement avec Python
python main.py
python src/translation_service.py
```

### 2. Tester le service
```bash
python test_interactive.py
```

## 🧠 Service de Traduction

**Le service utilise les VRAIS modèles NLLB** du dossier `backend/translator/` :
- ✅ Modèles NLLB 600M et 3.3B 
- ✅ Cache intelligent 
- ✅ Sélection automatique du modèle
- ✅ Support de 8 langues : fr, en, es, de, pt, zh, ja, ar

## 🔧 Fonctionnalités

### ✅ Traduction en Temps Réel
- Traduction avec vrais modèles NLLB
- Cache pour performances optimales
- Métadonnées complètes (temps, modèle, confiance)

### ✅ Détection de Langue
- Détection basée sur patterns linguistiques
- Alternatives avec scores de confiance

### ✅ Monitoring de Santé
- État du service en temps réel
- Statistiques de performance
- Informations système

## 🔌 API gRPC

### TranslateText
```protobuf
rpc TranslateText(TranslateRequest) returns (TranslateResponse);
```

### DetectLanguage  
```protobuf
rpc DetectLanguage(DetectLanguageRequest) returns (DetectLanguageResponse);
```

### HealthCheck
```protobuf
rpc HealthCheck(HealthCheckRequest) returns (HealthCheckResponse);
```

## 📊 Test Interactif

Le script `test_interactive.py` permet de :
1. 📝 Saisir des messages à traduire
2. 🔤 Choisir les langues source et cible  
3. 🌟 Voir la traduction en temps réel
4. 📊 Consulter les métadonnées (modèle, temps, cache)

## 🛠️ Intégration

Le service utilise directement le **TranslationService** du dossier `backend/translator/` qui contient :
- Configuration des modèles NLLB
- Gestionnaire de modèles avec GPU/CPU
- Cache intelligent
- API de traduction complète

## 📋 Prérequis

- Python 3.8+
- PyTorch 
- Transformers (Hugging Face)
- gRPC

Les modèles NLLB seront téléchargés automatiquement au premier démarrage.

## 🎯 Architecture Unifiée

Cette version **élimine tous les mocks** et utilise uniquement :
1. **Service NLLB réel** du dossier `backend/translator/`
2. **Serveur gRPC unifié** pour l'interface
3. **Test interactif** pour validation utilisateur

**Aucun mock, aucune simulation** - Service 100% fonctionnel prêt pour la production ! 🚀
