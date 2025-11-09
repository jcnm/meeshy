# Meeshy Agent System (MAS)

Un système d'agents conversationnels intelligents pour la plateforme Meeshy.

## 🎯 Objectif

Le **Meeshy Agent System** permet de créer des agents IA qui :
- Participent activement aux conversations Meeshy
- Analysent et comprennent le contexte des échanges
- Répondent de manière pertinente (collective, individuelle, avec/sans reply)
- Stimulent les conversations en apportant du contenu pertinent
- Mesurent et optimisent la **qualité** et **densité** des échanges

## 📊 Métriques Principales

### Densité (Target: 0.8)
Mesure la fréquence et continuité des échanges :
- **Message Frequency** : Messages par heure
- **Participation Rate** : % de participants actifs
- **Response Time** : Temps moyen entre messages
- **Continuity Score** : Absence de longs silences

**Formule** :
```
Densité = (freq_normalisée × 0.5) + (continuité × 0.3) + (participation × 0.2)
```

### Qualité (Target: 0.9)
Mesure la pertinence et profondeur des échanges :
- **Content Quality** : Longueur, complexité, cohérence (30%)
- **Topic Coherence** : Pertinence au sujet (25%)
- **Engagement Rate** : Interactions (replies, reactions) (20%)
- **Sentiment** : Positivité des échanges (15%)
- **Diversity** : Variété des participants et topics (10%)

## 🏗️ Architecture

```
Agent Manager
    ↓
Conversation Agent Instance
    ├── Message Reader (mmr.sh)
    ├── Message Analyzer
    ├── Context Manager (Memory)
    ├── Metrics Engine
    ├── Response Decision Engine
    ├── Proactive Topic Engine
    ├── System Prompt Builder
    └── Message Sender (mmp.sh)
```

Voir [docs/MAS_ARCHITECTURE.md](../docs/MAS_ARCHITECTURE.md) pour les détails complets.

## 🚀 Installation

### Prérequis
- Node.js >= 18.0.0
- Bash (pour mmr.sh et mmp.sh)
- curl, jq, date, mktemp, dd (généralement préinstallés)

### Installation
```bash
cd meeshy-agent-system
npm install
```

### Configuration
```bash
# Copier le fichier d'environnement
cp .env.example .env

# Éditer avec vos credentials
nano .env
```

Variables essentielles :
```bash
MEESHY_API_URL=https://gate.meeshy.me
AGENT_USERNAME=your_agent_username
AGENT_PASSWORD=your_secure_password

# LLM Provider (Anthropic Claude ou OpenAI)
LLM_PROVIDER=anthropic
LLM_API_KEY=sk-ant-...
LLM_MODEL=claude-3-5-sonnet-20241022
```

## 📝 Configuration d'un Agent

Créez un fichier YAML dans `config/agents/` :

```yaml
# config/agents/tech-expert.yaml
agent:
  id: tech-expert-001
  conversation_id: tech-discussion

  credentials:
    username: ${AGENT_USERNAME}
    password: ${AGENT_PASSWORD}

  personality:
    name: "TechExpert"
    role: "Expert en technologie et IA"
    tone: "professionnel mais accessible"
    expertise:
      - "intelligence artificielle"
      - "développement logiciel"
      - "architecture système"
      - "machine learning"

  behavior:
    response_style: "detailed"
    proactivity_level: 0.7  # 0-1
    formality: 0.6          # 0-1

  targets:
    density: 0.8   # Objectif de densité
    quality: 0.9   # Objectif de qualité

  limits:
    max_messages_per_hour: 10
    max_consecutive_replies: 3
    min_time_between_messages: 60000  # 1min

  adaptive:
    polling_interval:
      min: 30000    # 30s
      max: 300000   # 5min
      adaptive: true

    decision_thresholds:
      mention_response: 0.9       # Répond si mentionné
      question_response: 0.8      # Répond aux questions
      proactive_initiation: 0.6   # Initie proactivement
```

## 🎮 Utilisation

### Démarrer un Agent

```bash
npm run dev
```

### En Production

```bash
npm run build
npm start
```

### Tests

```bash
npm test
```

## 📚 Exemples de Code

### Créer un Client Meeshy

```typescript
import { MeeshyClient } from './src/core/MeeshyClient'

const client = new MeeshyClient({
  username: 'my_agent',
  password: 'secure_password',
  conversationId: 'tech-discussion',
})

// Récupérer les derniers messages
const messages = await client.retrieveMessages({
  count: 50,
})

// Publier un message
await client.publishMessage({
  content: 'Bonjour ! Je suis là pour discuter de technologie.',
  language: 'fr',
  skipConfirmation: true,
})
```

### Calculer les Métriques

```typescript
import { MetricsEngine } from './src/engines/MetricsEngine'

const metricsEngine = new MetricsEngine()

const metrics = metricsEngine.calculateMetrics(context)

console.log(`Densité: ${metrics.density.toFixed(2)}`)
console.log(`Qualité: ${metrics.quality.toFixed(2)}`)

// Vérifier si les objectifs sont atteints
const meetsTargets = metricsEngine.meetsTargets(metrics, {
  density: 0.8,
  quality: 0.9,
})
```

## 🔄 Cycle d'Exécution

```
1. POLL (via mmr.sh)
   ↓
2. ANALYZE
   - Parser messages
   - Mettre à jour contexte
   - Calculer métriques
   ↓
3. DECIDE
   - Faut-il répondre ?
   - Quel type de réponse ?
   - Stratégie de contenu ?
   ↓
4. GENERATE
   - Construire prompt système
   - Appeler LLM
   - Formater réponse
   ↓
5. PUBLISH (via mmp.sh)
   ↓
6. UPDATE
   - Mettre à jour contexte
   - Enregistrer métriques
   - Ajuster paramètres
   ↓
7. ADAPT
   - Ajuster fréquence de polling
   - Optimiser pour métriques
   ↓
[BOUCLE]
```

## 🎯 Types de Réponses

### Réponse Collective
Adresse l'ensemble des participants, synthétise plusieurs points.

**Quand ?**
- Plusieurs messages récents sur un topic
- Besoin de résumer ou clarifier
- Conversation manque de direction

### Réponse Individuelle
Adresse un participant spécifique.

**Quand ?**
- Question directe d'un utilisateur
- Réponse à une expertise spécifique
- Continuation d'un thread

### Réponse avec Reply
Quote un message précédent.

**Quand ?**
- Apporter une précision
- Construire sur une idée
- Corriger une information

### Initiation Proactive
L'agent initie un nouveau sujet.

**Quand ?**
- Conversation stagnante (densité < target)
- Topic épuisé
- Actualités pertinentes disponibles

## 📈 Monitoring

### Logs
```bash
tail -f logs/agent-tech-expert-001.log
```

Format JSON :
```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "agent": "tech-expert-001",
  "level": "info",
  "event": "decision_made",
  "data": {
    "shouldRespond": true,
    "responseType": "individual",
    "confidence": 0.87
  }
}
```

### Métriques en Temps Réel

Le système track automatiquement :
- ✅ Uptime et santé de l'agent
- 📊 Densité et qualité en temps réel
- 💬 Taux de réponse et engagement
- 🎯 Distance des objectifs
- ⚡ Performance (response time, API usage)

## 🔧 Scripts Shell (mmr & mmp)

Le système utilise les scripts shell optimisés :

### mmr.sh - Message Reader
```bash
# Récupérer les 50 derniers messages
./scripts/mmr.sh -n 50

# Messages des 2 dernières heures
./scripts/mmr.sh -t 2h

# Format AI-friendly (JSON structuré)
./scripts/mmr.sh -f ai -n 100 > context.json
```

### mmp.sh - Message Publisher
```bash
# Publier un message
./scripts/mmp.sh "Mon message ici"

# Publier depuis un fichier
echo "Contenu du message" > POST
./scripts/mmp.sh

# Non-interactif (automation)
./scripts/mmp.sh -y -f message.txt
```

Voir la documentation complète :
- [docs/MMP_MEESHY_MESSAGE_PUBLISHER.md](../docs/MMP_MEESHY_MESSAGE_PUBLISHER.md)
- [docs/MMP_SECURITY_BEST_PRACTICES.md](../docs/MMP_SECURITY_BEST_PRACTICES.md)

## 🛡️ Sécurité & Éthique

### Garde-fous
- ✅ **Rate limiting** : Maximum N messages/heure
- ✅ **Content filtering** : Pas de contenu inapproprié
- ✅ **Fact checking** : Vérification des affirmations
- ✅ **Transparency** : S'identifie comme bot si demandé
- ✅ **Human override** : Suspendable à tout moment

### Privacy
- Pas de stockage d'infos sensibles
- Anonymisation dans les logs
- Politique de rétention limitée (30 jours)

## 🔮 Roadmap

### Phase 1 (Actuel)
- ✅ Architecture de base
- ✅ Système de métriques
- ✅ Intégration mmr/mmp
- 🚧 Moteur d'analyse
- 🚧 Décision de réponse
- 🚧 Génération de réponses

### Phase 2
- Multi-conversations par agent
- Learning from feedback
- A/B testing de stratégies
- Agents collaboratifs

### Phase 3
- Support audio/vocal
- Réponses multi-modales (images, liens)
- Intégration traduction temps réel
- Personnalités custom via UI

## 🤝 Contribution

Les contributions sont bienvenues ! Voir [CONTRIBUTING.md](CONTRIBUTING.md).

## 📄 Licence

MIT

## 📞 Support

Pour toute question ou problème :
- 📧 Email: support@meeshy.me
- 💬 Discord: [Meeshy Community](https://discord.gg/meeshy)
- 🐛 Issues: [GitHub Issues](https://github.com/meeshy/meeshy-agent-system/issues)

---

Développé avec ❤️ par l'équipe Meeshy
