# Meeshy Agent System (MAS) - Architecture

## Vue d'ensemble

Le **Meeshy Agent System (MAS)** est un système d'agents conversationnels intelligents conçu pour :
- Participer activement aux conversations Meeshy
- Analyser et comprendre le contexte des échanges
- Répondre de manière pertinente (collective, individuelle, avec/sans reply)
- Stimuler les conversations en apportant du contenu pertinent
- Mesurer et optimiser la qualité et densité des échanges

## Architecture Globale

```
┌─────────────────────────────────────────────────────────────────┐
│                     Meeshy Agent System (MAS)                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────┐      ┌──────────────────┐                │
│  │  Agent Manager   │◄────►│  Config Manager  │                │
│  └────────┬─────────┘      └──────────────────┘                │
│           │                                                     │
│           │ manages                                             │
│           ▼                                                     │
│  ┌──────────────────────────────────────────────────────┐      │
│  │            Conversation Agent Instance               │      │
│  ├──────────────────────────────────────────────────────┤      │
│  │                                                      │      │
│  │  ┌────────────────┐    ┌──────────────────────┐    │      │
│  │  │ Message Reader │◄───┤ Message Analyzer     │    │      │
│  │  │  (MMR wrapper) │    │ - Sentiment          │    │      │
│  │  └────────────────┘    │ - Topics             │    │      │
│  │                        │ - Engagement         │    │      │
│  │  ┌────────────────┐    └──────────────────────┘    │      │
│  │  │ Message Sender │                                │      │
│  │  │  (MMP wrapper) │    ┌──────────────────────┐    │      │
│  │  └────────────────┘    │ Context Manager      │    │      │
│  │                        │ - Memory             │    │      │
│  │  ┌────────────────┐    │ - History            │    │      │
│  │  │ Response       │    │ - User Profiles      │    │      │
│  │  │ Decision Engine│◄───┴──────────────────────┘    │      │
│  │  │ - Collective   │                                │      │
│  │  │ - Individual   │    ┌──────────────────────┐    │      │
│  │  │ - Reply        │    │ Metrics Engine       │    │      │
│  │  └────────┬───────┘    │ - Density            │    │      │
│  │           │            │ - Quality            │    │      │
│  │           ▼            │ - Engagement         │    │      │
│  │  ┌────────────────┐    │ - Response Time      │    │      │
│  │  │ Proactive      │◄───┴──────────────────────┘    │      │
│  │  │ Topic Engine   │                                │      │
│  │  │ - News         │    ┌──────────────────────┐    │      │
│  │  │ - Historical   │    │ System Prompt        │    │      │
│  │  │ - Stimulation  │◄───┤ Builder              │    │      │
│  │  └────────────────┘    │ - Conv Description   │    │      │
│  │                        │ - Context            │    │      │
│  │                        │ - Style              │    │      │
│  │                        └──────────────────────┘    │      │
│  └──────────────────────────────────────────────────────┘      │
│                                                                 │
│  ┌──────────────────────────────────────────────────────┐      │
│  │                   External Integrations              │      │
│  ├──────────────────────────────────────────────────────┤      │
│  │  - Meeshy API (via mmr.sh, mmp.sh)                  │      │
│  │  - LLM Provider (Claude, GPT, etc.)                 │      │
│  │  - Vector DB (conversation memory)                  │      │
│  │  - News APIs (for proactive content)                │      │
│  └──────────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────┘
```

## Composants Principaux

### 1. Agent Manager
**Responsabilités :**
- Lifecycle management des agents
- Configuration et initialisation
- Monitoring et health checks
- Scaling et load balancing

**API :**
```typescript
interface AgentManager {
  createAgent(config: AgentConfig): Promise<ConversationAgent>
  destroyAgent(agentId: string): Promise<void>
  getAgent(agentId: string): ConversationAgent | null
  listAgents(): ConversationAgent[]
  healthCheck(): HealthStatus
}
```

### 2. Conversation Agent
**Responsabilités :**
- Gestion d'une conversation spécifique
- Cycle d'analyse-décision-action
- Maintien du contexte conversationnel

**Configuration :**
```typescript
interface AgentConfig {
  conversationId: string
  username: string
  password: string

  // Comportement
  personality: AgentPersonality
  expertise: string[]
  responseStyle: ResponseStyle

  // Fréquence
  pollingInterval: {
    min: number  // ms
    max: number  // ms
    adaptive: boolean
  }

  // Métriques cibles
  targetMetrics: {
    density: number    // 0-1
    quality: number    // 0-1
  }

  // Limites
  maxMessagesPerHour: number
  maxConsecutiveReplies: number
}
```

### 3. Message Analyzer
**Responsabilités :**
- Analyse sémantique des messages
- Détection de topics et entités
- Analyse de sentiment
- Scoring d'engagement

**Métriques Analysées :**
- Sentiment (positive/negative/neutral)
- Topics principaux
- Questions posées
- Mentions/références
- Niveau d'engagement
- Qualité linguistique

### 4. Context Manager
**Responsabilités :**
- Gestion de la mémoire conversationnelle
- Historique des messages
- Profils des participants
- Relations entre messages

**Stockage :**
```typescript
interface ConversationContext {
  // Historique récent (sliding window)
  recentMessages: Message[]

  // Résumés périodiques (long-term memory)
  summaries: ConversationSummary[]

  // Profils utilisateurs
  participants: Map<string, UserProfile>

  // Topics actifs
  activeTopics: Topic[]

  // État de la conversation
  state: ConversationState
}
```

### 5. Response Decision Engine
**Responsabilités :**
- Décider si et comment répondre
- Choisir le type de réponse (collective, individuelle, reply)
- Générer le contenu de la réponse

**Modes de Réponse :**

#### A. Réponse Collective
- Adresse l'ensemble des participants
- Synthétise plusieurs points de discussion
- Apporte une perspective globale

#### B. Réponse Individuelle
- Adresse un participant spécifique
- Répond à une question directe
- Continue un thread de discussion

#### C. Réponse avec Reply
- Quote un message précédent
- Apporte une précision
- Construit sur une idée

**Algorithme de Décision :**
```python
def should_respond(context, new_messages):
    # Facteurs à considérer
    factors = {
        'direct_mention': check_mentions(new_messages, agent.username),
        'question_asked': detect_questions(new_messages),
        'topic_relevance': calculate_topic_match(new_messages, agent.expertise),
        'conversation_stale': time_since_last_activity(context) > threshold,
        'density_low': current_density(context) < target_density,
        'recent_activity': count_recent_agent_messages(context) < max_consecutive
    }

    # Calcul du score de décision
    score = weighted_sum(factors, weights)

    return score > decision_threshold
```

### 6. Metrics Engine
**Responsabilités :**
- Calcul des métriques de conversation
- Suivi des tendances
- Alertes sur dégradation

#### Métrique Principale 1 : DENSITÉ
**Définition :** Mesure la fréquence et continuité des échanges

**Formule :**
```
Densité = (messages_per_hour / optimal_messages_per_hour) × continuity_factor

où :
- optimal_messages_per_hour = baseline pour ce type de conversation
- continuity_factor = mesure des "trous" dans la conversation (0-1)
```

**Métriques Intermédiaires :**
- `message_frequency`: Messages par heure
- `participation_rate`: % de participants actifs
- `response_time`: Temps moyen entre messages
- `continuity_score`: Absence de longs silences
- `peak_hours`: Heures de forte activité

#### Métrique Principale 2 : QUALITÉ
**Définition :** Mesure la pertinence et profondeur des échanges

**Formule :**
```
Qualité = weighted_average([
    content_quality,      # 30% - Longueur, complexité, cohérence
    relevance,            # 25% - Pertinence au sujet
    engagement,           # 20% - Interactions (replies, reactions)
    sentiment,            # 15% - Positivité des échanges
    diversity             # 10% - Variété des participants et topics
])
```

**Métriques Intermédiaires :**
- `content_quality`: Score linguistique et sémantique
- `topic_coherence`: Cohérence des sujets discutés
- `engagement_rate`: Taux de réponses/réactions
- `sentiment_score`: Score de sentiment moyen
- `diversity_index`: Diversité des participants et sujets

#### Métriques Complémentaires
- `agent_contribution_rate`: % de messages de l'agent
- `topic_variety`: Nombre de topics uniques
- `thread_depth`: Profondeur moyenne des discussions
- `user_satisfaction`: Basé sur réactions et engagement

### 7. Proactive Topic Engine
**Responsabilités :**
- Initier de nouveaux sujets de discussion
- Apporter des informations pertinentes
- Relancer les conversations stagnantes

**Stratégies :**

#### A. News-Based Initiation
```typescript
async function initiateFromNews(context: ConversationContext) {
  // 1. Récupérer actualités pertinentes
  const news = await fetchRelevantNews(context.topics, context.expertise)

  // 2. Filtrer par pertinence
  const relevant = news.filter(n => relevanceScore(n, context) > threshold)

  // 3. Générer message d'introduction
  const message = await generateNewsIntroduction(relevant[0], context)

  return message
}
```

#### B. Historical Context Initiation
```typescript
async function initiateFromHistory(context: ConversationContext) {
  // 1. Analyser l'historique de la conversation
  const history = context.summaries

  // 2. Identifier patterns et topics récurrents
  const patterns = findRecurringPatterns(history)

  // 3. Trouver angle nouveau sur topic familier
  const angle = findNewAngle(patterns, context.state)

  // 4. Générer message
  const message = await generateHistoricalCallback(angle, context)

  return message
}
```

#### C. Stimulation Strategy
```typescript
async function stimulateConversation(context: ConversationContext) {
  // Détecter raisons de stagnation
  const stagnationReason = analyzeStagnation(context)

  switch(stagnationReason) {
    case 'topic_exhausted':
      return initiateFromNews(context)

    case 'low_participation':
      return askEngagingQuestion(context)

    case 'time_gap':
      return reconnectToLastTopic(context)

    case 'lack_direction':
      return proposeDiscussionStructure(context)
  }
}
```

### 8. System Prompt Builder
**Responsabilités :**
- Construire le prompt système dynamiquement
- Intégrer description de conversation
- Adapter le ton et style

**Template :**
```
Tu es un expert conversationnel participant à "{conversation_title}".

CONTEXTE DE LA CONVERSATION :
{conversation_description}

TES EXPERTISES :
{agent_expertise}

ÉTAT ACTUEL :
- Participants actifs : {active_participants}
- Sujets récents : {recent_topics}
- Densité actuelle : {current_density}/1.0
- Qualité actuelle : {current_quality}/1.0

TON RÔLE :
- Participer de manière constructive
- Apporter ton expertise sur {expertise_areas}
- Stimuler les échanges quand nécessaire
- Maintenir un ton {tone}
- Objectif densité : {target_density}
- Objectif qualité : {target_quality}

CONTEXTE RÉCENT :
{recent_context}

INSTRUCTIONS :
{dynamic_instructions}
```

## Cycle d'Exécution

```
1. POLL (via mmr.sh)
   ↓
2. ANALYZE
   - Parse messages
   - Update context
   - Calculate metrics
   ↓
3. DECIDE
   - Should respond?
   - Response type?
   - Content strategy?
   ↓
4. GENERATE
   - Build prompt
   - Call LLM
   - Format response
   ↓
5. PUBLISH (via mmp.sh)
   ↓
6. UPDATE
   - Update context
   - Record metrics
   - Adjust parameters
   ↓
7. ADAPT
   - Adjust polling frequency
   - Update decision thresholds
   - Optimize for metrics
   ↓
[LOOP back to 1]
```

## Gestion Dynamique de la Fréquence

**Principe :** L'agent adapte sa fréquence d'analyse et réponse en fonction de l'activité de la conversation.

**Algorithme :**
```typescript
function calculateNextPollInterval(context: ConversationContext): number {
  const baseInterval = config.pollingInterval.min
  const maxInterval = config.pollingInterval.max

  // Facteurs d'ajustement
  const factors = {
    // Plus d'activité = polling plus fréquent
    activity: mapRange(
      context.messagesLastHour,
      [0, 60],
      [maxInterval, baseInterval]
    ),

    // Densité basse = polling plus fréquent pour stimuler
    density: mapRange(
      context.metrics.density,
      [0, 1],
      [baseInterval, maxInterval]
    ),

    // Si agent a récemment parlé = polling moins fréquent
    agentRecency: context.lastAgentMessage
      ? Math.min(maxInterval, Date.now() - context.lastAgentMessage)
      : baseInterval
  }

  return weightedAverage(factors)
}
```

## Gestion de la Mémoire

**Niveaux de Mémoire :**

### 1. Working Memory (court terme)
- Derniers 50-100 messages
- Stockage : En RAM
- TTL : Session active

### 2. Episode Memory (moyen terme)
- Résumés par période (jour/semaine)
- Stockage : DB locale (SQLite)
- TTL : 30 jours

### 3. Semantic Memory (long terme)
- Embeddings de concepts clés
- Stockage : Vector DB (ChromaDB)
- TTL : Permanent

**Récupération de Contexte :**
```typescript
async function retrieveContext(query: string, depth: 'shallow' | 'deep') {
  // Récupération hybride
  const context = {
    // Working memory - toujours inclus
    recent: this.workingMemory.getRecent(50),

    // Semantic search dans embeddings
    relevant: await this.vectorDB.similaritySearch(query, k=10),

    // Episode summaries si deep
    ...(depth === 'deep' && {
      episodes: await this.episodeDB.getRelevantEpisodes(query, limit=5)
    })
  }

  return context
}
```

## Configuration et Déploiement

### Variables d'Environnement
```bash
# Meeshy API
MEESHY_API_URL=https://gate.meeshy.me
MEESHY_FRONTEND_URL=https://meeshy.me

# Agent credentials
AGENT_USERNAME=expert_bot
AGENT_PASSWORD=secure_password

# LLM Provider
LLM_PROVIDER=anthropic
LLM_API_KEY=sk-ant-...
LLM_MODEL=claude-3-5-sonnet-20241022

# Vector DB
VECTOR_DB_PATH=./data/vectordb
VECTOR_DB_TYPE=chromadb

# Storage
CONTEXT_DB_PATH=./data/context.db
LOGS_PATH=./logs

# Performance
MAX_WORKERS=4
POLL_INTERVAL_MIN=30000  # 30s
POLL_INTERVAL_MAX=300000 # 5min
```

### Fichier de Configuration Agent
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
    role: "Expert en technologie"
    tone: "professionnel mais accessible"
    expertise:
      - "intelligence artificielle"
      - "développement logiciel"
      - "architecture système"

  behavior:
    response_style: "detailed"
    proactivity_level: 0.7  # 0-1
    formality: 0.6          # 0-1

  targets:
    density: 0.8
    quality: 0.9

  limits:
    max_messages_per_hour: 10
    max_consecutive_replies: 3
    min_time_between_messages: 60000  # 1min

  adaptive:
    polling_interval:
      min: 30000
      max: 300000
      adaptive: true

    decision_thresholds:
      mention_response: 0.9
      question_response: 0.8
      proactive_initiation: 0.6
```

## Métriques et Monitoring

### Dashboards
1. **Agent Health**
   - Uptime
   - Response times
   - Error rates
   - API usage

2. **Conversation Metrics**
   - Density trend
   - Quality trend
   - Participant engagement
   - Topic diversity

3. **Agent Performance**
   - Message quality scores
   - Response relevance
   - Engagement generated
   - Target achievement

### Logs
```
[2024-01-15 10:30:00] [tech-expert-001] [INFO] Polling conversation tech-discussion
[2024-01-15 10:30:01] [tech-expert-001] [METRICS] Density: 0.65, Quality: 0.82
[2024-01-15 10:30:02] [tech-expert-001] [DECISION] Responding: YES (question detected, score: 0.87)
[2024-01-15 10:30:05] [tech-expert-001] [ACTION] Publishing message (type: individual_reply)
[2024-01-15 10:30:06] [tech-expert-001] [SUCCESS] Message published (id: msg_abc123)
```

## Sécurité et Éthique

### Garde-fous
- **Rate limiting** : Limite de messages par période
- **Content filtering** : Pas de contenu inapproprié
- **Fact checking** : Vérification des affirmations factuelles
- **Transparency** : L'agent s'identifie comme bot si demandé
- **Human override** : Possibilité de suspendre l'agent

### Privacy
- **Données personnelles** : Pas de stockage d'infos sensibles
- **Anonymisation** : Pseudonymisation dans les logs
- **Retention** : Politique de rétention limitée

## Évolutions Futures

### Phase 2
- Support multi-conversations par agent
- Learning from feedback
- A/B testing de stratégies
- Collaborative agents

### Phase 3
- Voice/audio support
- Multi-modal responses (images, liens)
- Real-time translation integration
- Custom agent personalities via UI
