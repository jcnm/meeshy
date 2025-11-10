# AAMS Phase 1 - Foundation Layer ✅

Implementation of the **Foundation Layer** for the Advanced Agent Mentor System (AAMS).

## 🎯 Phase 1 Deliverables

### ✅ Completed Components

1. **Platform Abstraction Layer**
   - ✅ `PlatformAdapter` interface - Universal platform interface
   - ✅ `MeeshyAPIAdapter` - Direct API Gateway integration
   - ✅ `MeeshyCLIAdapter` - Shell script (mmr/mmp) integration
   - ✅ `PlatformRegistry` - Adapter management

2. **Agent Core**
   - ✅ `MentorAgent` class - Main agent runtime with observe-think-act-learn-adapt loop
   - ✅ `AgentConfig` types - Complete configuration types
   - ✅ Agent lifecycle management (start/stop/pause/resume)

3. **Memory System**
   - ✅ `WorkingMemory` - Short-term context management (RAM-based)
   - ✅ Message storage, retrieval, search
   - ✅ Automatic cleanup and compaction

4. **Metrics Engine** (from MAS)
   - ✅ Density calculation
   - ✅ Quality calculation
   - ✅ Intermediate metrics

5. **Infrastructure**
   - ✅ Production-grade logging system
   - ✅ Custom error classes with recovery hints
   - ✅ Retry logic with exponential backoff
   - ✅ YAML configuration system with env var support

6. **Testing**
   - ✅ Unit tests for WorkingMemory
   - ✅ Vitest configuration

## 🏗️ Architecture

```
src/
├── platform/
│   ├── PlatformRegistry.ts         # Adapter management
│   └── adapters/
│       ├── MeeshyAPIAdapter.ts     # API Gateway integration
│       └── MeeshyCLIAdapter.ts     # Shell script integration
│
├── core/
│   ├── MentorAgent.ts              # Main agent runtime
│   └── AgentConfig.ts              # Configuration types
│
├── memory/
│   └── WorkingMemory.ts            # Short-term memory
│
├── engines/
│   └── MetricsEngine.ts            # Metrics calculation
│
├── types/
│   ├── index.ts                    # Core types
│   └── platform.ts                 # Platform types
│
├── utils/
│   ├── logger.ts                   # Logging system
│   ├── errors.ts                   # Error handling
│   └── config-loader.ts            # YAML configuration
│
├── index.ts                        # Public API
└── cli.ts                          # CLI entry point
```

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your credentials
```

Required variables:
```bash
AGENT_USERNAME=your_username
AGENT_PASSWORD=your_password
```

### 3. Create Agent Configuration

```bash
cp config/agents/mentor-example.yaml config/agents/my-agent.yaml
# Edit my-agent.yaml
```

### 4. Run Agent

```bash
# Development mode (with hot reload)
npm run dev config/agents/my-agent.yaml

# Production mode
npm start config/agents/my-agent.yaml

# Or use the agent script
npm run agent config/agents/my-agent.yaml
```

## 📝 Configuration Example

```yaml
agent:
  id: my-mentor-001
  conversation_id: tech-discussion

  platform:
    adapter: api  # or 'cli'
    api_url: https://gate.meeshy.me

  credentials:
    username: ${AGENT_USERNAME}
    password: ${AGENT_PASSWORD}

  personality:
    name: "TechMentor"
    role: "Technology Expert"
    tone: "professional but friendly"
    expertise:
      - "software engineering"
      - "system design"
    proactivity_level: 0.7
    formality: 0.6

  behavior:
    response_style: detailed
    teaching_approach: mixed

  targets:
    density: 0.8
    quality: 0.9

  limits:
    max_messages_per_hour: 10
    max_consecutive_replies: 3
    min_time_between_messages: 60000

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

## 🧪 Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# With coverage
npm test -- --coverage
```

## 📊 Current Capabilities

### Implemented
- ✅ Connect to Meeshy (API or CLI)
- ✅ Retrieve messages
- ✅ Publish messages
- ✅ Store messages in working memory
- ✅ Calculate conversation metrics
- ✅ Make basic decisions (mention, question, proactive)
- ✅ Adaptive polling frequency
- ✅ Rate limiting
- ✅ Configuration via YAML
- ✅ Environment variable support
- ✅ Production logging

### Basic Decision Logic
The agent decides to respond based on:
1. **Direct mention** (threshold: 0.9)
2. **Question detected** (threshold: 0.8)
3. **Low density/quality** (threshold: 0.6)

Response is a placeholder for now (Phase 2 will add LLM integration).

## 🔧 Platform Adapters

### API Adapter (`MeeshyAPIAdapter`)
- Direct HTTP communication with gate.meeshy.me
- Full API capabilities
- Real-time potential
- Recommended for production

### CLI Adapter (`MeeshyCLIAdapter`)
- Uses existing mmr.sh / mmp.sh scripts
- Fallback option
- Limited capabilities (no edit/delete)
- Good for development/testing

## 💾 Memory System

### WorkingMemory
- RAM-based storage
- Fast access
- Automatic cleanup (by age and count)
- Search capabilities
- Statistics tracking

**Limits:**
- Default: 100 messages or 1 hour
- Configurable per instance

## 📈 Metrics

The agent tracks:
- **Density**: Conversation frequency and continuity
- **Quality**: Content quality and engagement
- Message frequency, participation rate, response time
- Content quality, topic coherence, engagement rate
- Sentiment, diversity

See `src/engines/MetricsEngine.ts` for details.

## 🔐 Security

- ✅ Environment variables for credentials
- ✅ No passwords in logs
- ✅ Request timeouts
- ✅ Retry with exponential backoff
- ✅ Input validation
- ✅ Error boundaries

## 🐛 Debugging

Set log level in `.env`:
```bash
LOG_LEVEL=debug  # debug, info, warn, error
```

Enable debug mode:
```bash
DEBUG=true npm start config/agents/my-agent.yaml
```

## 📝 Logging

Structured JSON logs with:
- Timestamp
- Log level
- Message
- Context (agent ID, conversation, etc.)
- Error details (if any)

Example:
```
[2024-01-15T10:30:00.000Z] [INFO] MentorAgent created {"agent":"mentor-001","conversation":"tech"}
[2024-01-15T10:30:05.000Z] [INFO] Messages retrieved successfully {"conversationId":"tech","count":15}
[2024-01-15T10:30:10.000Z] [INFO] Decision: Should respond {"confidence":"0.85","factors":{...}}
```

## 🚧 Limitations (Phase 1)

Phase 1 is the **foundation** - many features are placeholders:

**Not Yet Implemented:**
- ❌ LLM integration (placeholder responses)
- ❌ Deep message analysis (sentiment, NER, etc.)
- ❌ Research capabilities
- ❌ Episodic memory (DB)
- ❌ Semantic memory (Vector DB)
- ❌ Multi-agent coordination
- ❌ Self-improvement
- ❌ Teaching strategies
- ❌ Proactive topic generation

These will be added in **Phase 2** (Intelligence Layer) and beyond.

## 📚 Next Steps

### Phase 2 - Intelligence Layer (Weeks 3-4)
- Decision Engine with sophisticated analysis
- Research Engine (web search integration)
- LLM integration for response generation
- Tool Framework
- Advanced message analysis

See `docs/AAMS_ROADMAP.md` for full plan.

## 🤝 Contributing

Phase 1 provides the foundation. To extend:

1. **Add new platform adapter:**
   - Implement `PlatformAdapter` interface
   - Register with `PlatformRegistry`

2. **Add new memory tier:**
   - Extend memory system
   - Implement persistence

3. **Enhance decision logic:**
   - Modify `MentorAgent.think()`
   - Add new factors

## 📄 License

MIT

---

**Phase 1 Status:** ✅ Complete
**Next Phase:** Intelligence Layer (Decision Engine, Research, LLM)
