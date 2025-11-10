# COMPREHENSIVE PROMPT: Advanced Agent Mentor System (AAMS)
## Universal Conversational AI Platform

---

## 🎯 MISSION STATEMENT

Design and implement a **fully-qualified, production-ready agent system** that can instantiate advanced AI agents capable of acting as **human mentors** in any conversation they are members of. The system must be:

- **Platform-agnostic**: Work with any platform requiring information publishing based on historical context
- **Tool-integrated**: Leverage existing tools for web search, reasoning, decision-making
- **Evolutive**: Designed to grow consistently and globally with new capabilities
- **Mentor-focused**: Provide guidance, teaching, and support like a human expert mentor
- **Autonomous**: Make intelligent decisions with minimal human intervention

---

## 🏗️ ARCHITECTURE REQUIREMENTS

### 1. Multi-Layer Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    ORCHESTRATION LAYER                      │
│  - Agent Lifecycle Manager                                  │
│  - Multi-Platform Coordinator                               │
│  - Resource & Quota Management                              │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                      AGENT CORE LAYER                       │
│  - Mentor Agent Runtime                                     │
│  - Context & Memory Management                              │
│  - Decision Engine                                          │
│  - Tool Integration Framework                               │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                     CAPABILITY LAYER                        │
│  - Web Search & Research                                    │
│  - Knowledge Synthesis                                      │
│  - Reasoning & Planning                                     │
│  - Content Generation                                       │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                   INTEGRATION LAYER                         │
│  - Platform Adapters (Meeshy, Discord, Slack, etc.)       │
│  - Tool Connectors (APIs, Services)                        │
│  - Data Persistence (Vector DB, SQL, Cache)                │
└─────────────────────────────────────────────────────────────┘
```

### 2. Platform Abstraction

**Create a unified interface for any platform:**

```typescript
interface PlatformAdapter {
  // Identity
  platformName: string
  platformVersion: string

  // Message operations
  retrieveMessages(options: RetrieveOptions): Promise<Message[]>
  publishMessage(message: OutgoingMessage): Promise<MessageResult>
  editMessage(messageId: string, newContent: string): Promise<void>
  deleteMessage(messageId: string): Promise<void>

  // Conversation operations
  getConversationInfo(conversationId: string): Promise<ConversationInfo>
  getParticipants(conversationId: string): Promise<Participant[]>

  // Real-time operations
  subscribeToMessages(callback: MessageCallback): Subscription
  subscribeToEvents(callback: EventCallback): Subscription

  // Search & Discovery
  searchMessages(query: string): Promise<SearchResult[]>

  // Capabilities
  getCapabilities(): PlatformCapabilities
}
```

**Implement adapters for:**
- Meeshy (via mmr.sh/mmp.sh)
- Discord (via Discord.js)
- Slack (via Slack API)
- Generic REST API
- Generic WebSocket
- Email (IMAP/SMTP)
- Matrix Protocol

---

## 🧠 MENTOR CAPABILITIES

### Core Mentor Behaviors

1. **Teaching & Guidance**
   - Explain complex concepts step-by-step
   - Provide examples and analogies
   - Check understanding with questions
   - Adapt explanation level to learner

2. **Knowledge Synthesis**
   - Research topics deeply
   - Connect disparate concepts
   - Provide comprehensive answers
   - Cite sources and references

3. **Socratic Method**
   - Ask probing questions
   - Guide discovery rather than tell
   - Encourage critical thinking
   - Challenge assumptions constructively

4. **Emotional Intelligence**
   - Detect frustration or confusion
   - Provide encouragement
   - Adjust tone appropriately
   - Build rapport over time

5. **Expertise Domains**
   - Technology & Programming
   - Science & Mathematics
   - Business & Strategy
   - Personal Development
   - Creative Arts
   - [Configurable per agent]

---

## 🔧 TOOL INTEGRATION FRAMEWORK

### Required Tool Categories

#### 1. Web Research Tools

**Integrate existing tools:**

- **Tavily AI** (https://tavily.com)
  - Real-time web search
  - News aggregation
  - Academic paper search

- **SerpAPI** (https://serpapi.com)
  - Google Search results
  - Structured data extraction

- **Perplexity API**
  - AI-powered research
  - Citation-backed answers

- **Wikipedia API**
  - Encyclopedic knowledge
  - Reliable baseline information

**Implementation:**
```typescript
interface ResearchTool {
  name: string

  search(query: SearchQuery): Promise<SearchResult[]>

  deepResearch(topic: string, depth: number): Promise<ResearchReport>

  verifyFact(claim: string): Promise<FactCheckResult>

  getLatestNews(topic: string, since: Date): Promise<NewsArticle[]>
}
```

#### 2. Reasoning & Planning Tools

**Integrate:**

- **LangChain** (https://langchain.com)
  - Chain-of-thought reasoning
  - Multi-step planning
  - Tool orchestration

- **AutoGPT** approach
  - Goal decomposition
  - Task planning
  - Iterative refinement

**Implementation:**
```typescript
interface ReasoningEngine {
  // Chain-of-thought reasoning
  reason(problem: string, context: Context): Promise<ReasoningChain>

  // Multi-step planning
  plan(goal: Goal, constraints: Constraint[]): Promise<ExecutionPlan>

  // Decision making
  decide(options: Option[], criteria: Criteria): Promise<Decision>

  // Problem decomposition
  decompose(problem: ComplexProblem): Promise<SubProblem[]>
}
```

#### 3. Knowledge Management Tools

**Integrate:**

- **ChromaDB / Pinecone** (Vector databases)
  - Semantic memory
  - Similarity search
  - Knowledge retrieval

- **Mem0** (https://mem0.ai)
  - Persistent memory
  - Context management
  - Personalization

**Implementation:**
```typescript
interface KnowledgeBase {
  // Storage
  store(content: Content, metadata: Metadata): Promise<string>

  // Retrieval
  query(query: string, k: number): Promise<KnowledgeItem[]>

  // Semantic search
  semanticSearch(embedding: number[], filters?: Filter): Promise<Result[]>

  // Memory management
  remember(fact: Fact, importance: number): Promise<void>
  forget(factId: string): Promise<void>
  consolidate(): Promise<MemoryStats>
}
```

#### 4. Content Generation Tools

**Integrate:**

- **Multiple LLM Providers:**
  - Anthropic Claude (primary)
  - OpenAI GPT-4
  - Google Gemini
  - Local models (Ollama)

- **Specialized generators:**
  - Code generation (GitHub Copilot API)
  - Image generation (DALL-E, Midjourney)
  - Diagram generation (Mermaid)

**Implementation:**
```typescript
interface ContentGenerator {
  // Text generation
  generate(prompt: Prompt, options: GenerationOptions): Promise<GeneratedContent>

  // Multi-modal generation
  generateImage(description: string): Promise<ImageURL>
  generateCode(specification: CodeSpec): Promise<CodeResult>
  generateDiagram(description: string, type: DiagramType): Promise<Diagram>

  // Style transfer
  rewrite(content: string, style: Style): Promise<string>

  // Translation
  translate(text: string, targetLang: string): Promise<Translation>
}
```

#### 5. Tool Integration Tools

**Meta-tools for tool orchestration:**

- **LangChain Agents**
- **OpenAI Function Calling**
- **Anthropic Tool Use**

**Implementation:**
```typescript
interface ToolOrchestrator {
  // Register tools
  registerTool(tool: Tool): void

  // Execute tool
  executeTool(toolName: string, params: any): Promise<ToolResult>

  // Chain tools
  chainTools(tools: ToolChain): Promise<ChainResult>

  // Discover tools
  discoverTools(capability: string): Tool[]

  // Suggest tools
  suggestTools(task: Task): ToolRecommendation[]
}
```

---

## 🧩 CORE COMPONENTS SPECIFICATION

### 1. Agent Runtime

```typescript
class MentorAgent {
  // Configuration
  config: AgentConfig
  personality: Personality
  expertise: Expertise[]

  // State
  context: ConversationContext
  memory: MemoryManager
  tools: ToolRegistry

  // Core loop
  async run(): Promise<void> {
    while (this.isActive) {
      // 1. Observe
      const updates = await this.observe()

      // 2. Think
      const decision = await this.think(updates)

      // 3. Act
      if (decision.shouldAct) {
        await this.act(decision.action)
      }

      // 4. Learn
      await this.learn(updates, decision)

      // 5. Adapt
      await this.adapt()
    }
  }

  // Observation
  async observe(): Promise<Update[]>

  // Thinking (planning, reasoning, decision)
  async think(updates: Update[]): Promise<Decision>

  // Action execution
  async act(action: Action): Promise<ActionResult>

  // Learning from experience
  async learn(updates: Update[], decision: Decision): Promise<void>

  // Self-adaptation
  async adapt(): Promise<void>
}
```

### 2. Decision Engine

```typescript
class DecisionEngine {
  // Multi-criteria decision making
  async decide(situation: Situation): Promise<Decision> {
    // 1. Analyze situation
    const analysis = await this.analyze(situation)

    // 2. Generate options
    const options = await this.generateOptions(analysis)

    // 3. Evaluate options
    const evaluations = await this.evaluate(options)

    // 4. Select best option
    const selected = this.select(evaluations)

    // 5. Explain decision
    const explanation = this.explain(selected)

    return {
      action: selected.action,
      confidence: selected.score,
      reasoning: explanation,
      alternatives: evaluations.slice(1, 3)
    }
  }

  // Situation analysis
  private async analyze(situation: Situation): Promise<Analysis> {
    return {
      context: await this.analyzeContext(situation),
      participants: await this.analyzeParticipants(situation),
      topics: await this.extractTopics(situation),
      sentiment: await this.analyzeSentiment(situation),
      urgency: this.calculateUrgency(situation),
      opportunities: this.identifyOpportunities(situation)
    }
  }

  // Option generation
  private async generateOptions(analysis: Analysis): Promise<Option[]> {
    const options: Option[] = []

    // Response options
    options.push(...await this.generateResponses(analysis))

    // Research options
    options.push(...await this.generateResearchTasks(analysis))

    // Proactive options
    options.push(...await this.generateProactiveActions(analysis))

    // Meta options
    options.push({ type: 'wait', reason: 'Observe more before acting' })
    options.push({ type: 'ask_clarification', reason: 'Need more information' })

    return options
  }

  // Multi-criteria evaluation
  private async evaluate(options: Option[]): Promise<Evaluation[]> {
    return Promise.all(options.map(async option => {
      const scores = {
        relevance: await this.scoreRelevance(option),
        quality: await this.scoreQuality(option),
        impact: await this.scoreImpact(option),
        timing: await this.scoreTiming(option),
        risk: await this.scoreRisk(option)
      }

      // Weighted score
      const totalScore =
        scores.relevance * 0.3 +
        scores.quality * 0.25 +
        scores.impact * 0.25 +
        scores.timing * 0.1 +
        (1 - scores.risk) * 0.1

      return {
        option,
        scores,
        totalScore,
        recommendation: this.getRecommendation(totalScore)
      }
    }))
  }
}
```

### 3. Memory Management

```typescript
class MemoryManager {
  // Memory tiers
  workingMemory: WorkingMemory      // Recent context (RAM)
  episodicMemory: EpisodicMemory    // Conversation episodes (DB)
  semanticMemory: SemanticMemory    // Long-term knowledge (Vector DB)
  proceduralMemory: ProceduralMemory // Skills & procedures (Code)

  // Store memory
  async store(memory: Memory): Promise<void> {
    // Determine tier
    const tier = this.determineTier(memory)

    // Store in appropriate tier
    switch (tier) {
      case 'working':
        await this.workingMemory.add(memory)
        break
      case 'episodic':
        await this.episodicMemory.save(memory)
        break
      case 'semantic':
        await this.semanticMemory.embed(memory)
        break
      case 'procedural':
        await this.proceduralMemory.learn(memory)
        break
    }

    // Cross-reference
    await this.crossReference(memory, tier)
  }

  // Retrieve memory
  async retrieve(query: MemoryQuery): Promise<Memory[]> {
    // Multi-tier search
    const results = await Promise.all([
      this.workingMemory.search(query),
      this.episodicMemory.search(query),
      this.semanticMemory.search(query),
      this.proceduralMemory.search(query)
    ])

    // Merge and rank
    const merged = this.mergeResults(results)
    const ranked = this.rankByRelevance(merged, query)

    return ranked.slice(0, query.limit || 10)
  }

  // Memory consolidation
  async consolidate(): Promise<void> {
    // Working → Episodic
    const toEpisodic = this.workingMemory.getOld(threshold)
    await this.episodicMemory.saveMany(toEpisodic)

    // Episodic → Semantic
    const toSemantic = await this.extractPatterns(this.episodicMemory)
    await this.semanticMemory.embedMany(toSemantic)

    // Learn procedures
    const procedures = await this.extractProcedures(this.episodicMemory)
    await this.proceduralMemory.learnMany(procedures)

    // Forget low-value memories
    await this.forget(this.identifyLowValue())
  }

  // Contextual recall
  async recall(context: Context): Promise<RelevantMemories> {
    // Get relevant memories for current context
    return {
      recentHistory: await this.workingMemory.getRecent(50),
      relevantEpisodes: await this.episodicMemory.findRelevant(context),
      relatedKnowledge: await this.semanticMemory.search(context.query),
      applicableSkills: await this.proceduralMemory.match(context.task)
    }
  }
}
```

### 4. Research Engine

```typescript
class ResearchEngine {
  tools: ResearchTool[]
  llm: LanguageModel

  // Deep research on a topic
  async research(topic: string, depth: 'shallow' | 'medium' | 'deep'): Promise<ResearchReport> {
    // 1. Plan research
    const plan = await this.planResearch(topic, depth)

    // 2. Execute research
    const findings: Finding[] = []
    for (const query of plan.queries) {
      const results = await this.executeQuery(query)
      findings.push(...results)
    }

    // 3. Verify and cross-check
    const verified = await this.verifyFindings(findings)

    // 4. Synthesize
    const synthesis = await this.synthesize(verified)

    // 5. Generate report
    return {
      topic,
      summary: synthesis.summary,
      keyFindings: synthesis.keyPoints,
      sources: this.citeSources(verified),
      confidence: this.calculateConfidence(verified),
      limitations: this.identifyLimitations(verified),
      furtherReading: this.suggestReading(verified)
    }
  }

  // Plan research strategy
  private async planResearch(topic: string, depth: string): Promise<ResearchPlan> {
    const prompt = `Plan a research strategy for: "${topic}"
    Depth: ${depth}

    Consider:
    - What questions to answer
    - What sources to consult
    - How to verify information
    - What connections to explore

    Generate a structured research plan.`

    const plan = await this.llm.generate(prompt, { schema: ResearchPlanSchema })
    return plan
  }

  // Execute research query
  private async executeQuery(query: ResearchQuery): Promise<Finding[]> {
    // Use multiple tools in parallel
    const results = await Promise.all(
      this.tools.map(tool => tool.search(query))
    )

    // Aggregate and deduplicate
    return this.aggregateResults(results)
  }

  // Verify findings
  private async verifyFindings(findings: Finding[]): Promise<VerifiedFinding[]> {
    return Promise.all(findings.map(async finding => {
      // Cross-reference with multiple sources
      const confirmations = await this.crossReference(finding)

      // Check source reliability
      const reliability = this.assessReliability(finding.source)

      // Detect contradictions
      const contradictions = this.detectContradictions(finding, findings)

      return {
        ...finding,
        confidence: this.calculateConfidence({
          confirmations,
          reliability,
          contradictions
        }),
        verified: confirmations.length >= 2,
        warnings: contradictions.length > 0 ? ['Conflicting information found'] : []
      }
    }))
  }

  // Synthesize findings
  private async synthesize(findings: VerifiedFinding[]): Promise<Synthesis> {
    const prompt = `Synthesize these research findings into a coherent summary:

    ${findings.map(f => `- ${f.content} (confidence: ${f.confidence})`).join('\n')}

    Provide:
    1. A concise summary
    2. Key takeaways
    3. Connections between findings
    4. Areas of uncertainty`

    return await this.llm.generate(prompt, { schema: SynthesisSchema })
  }
}
```

---

## 📊 ADVANCED FEATURES

### 1. Multi-Agent Collaboration

```typescript
interface AgentCollaboration {
  // Agents can work together on complex tasks
  collaborateOn(task: ComplexTask): Promise<CollaborativeResult>

  // Delegate subtasks
  delegate(subtask: Task, toAgent: AgentId): Promise<void>

  // Share knowledge
  shareKnowledge(knowledge: Knowledge, withAgent: AgentId): Promise<void>

  // Coordinate actions
  coordinate(plan: CollaborativePlan): Promise<void>
}
```

### 2. Self-Improvement

```typescript
interface SelfImprovement {
  // Analyze own performance
  analyzePerformance(): Promise<PerformanceAnalysis>

  // Identify weaknesses
  identifyWeaknesses(): Promise<Weakness[]>

  // Learn from mistakes
  learnFromMistake(mistake: Mistake): Promise<void>

  // Update strategies
  updateStrategy(strategy: Strategy, performance: Performance): Promise<void>

  // Request human feedback
  requestFeedback(interaction: Interaction): Promise<Feedback>
}
```

### 3. Explainability

```typescript
interface Explainability {
  // Explain decision
  explainDecision(decision: Decision): Explanation

  // Show reasoning chain
  showReasoning(): ReasoningChain

  // Trace information sources
  traceSources(): SourceTrace[]

  // Justify confidence
  justifyConfidence(): ConfidenceJustification
}
```

---

## 🔐 SAFETY & ETHICS

### Required Safeguards

1. **Content Filtering**
   - Detect and prevent harmful content
   - Refuse unethical requests
   - Flag concerning patterns

2. **Fact Checking**
   - Verify claims before stating
   - Provide sources
   - Acknowledge uncertainty

3. **Privacy**
   - Don't store sensitive data
   - Anonymize logs
   - Respect data retention policies

4. **Transparency**
   - Identify as AI when asked
   - Explain limitations
   - Admit mistakes

5. **Human Oversight**
   - Allow human review
   - Emergency stop
   - Audit trail

---

## 📦 DELIVERABLES

### Phase 1: Foundation (Week 1-2)
- [ ] Platform abstraction layer
- [ ] Meeshy adapter (using mmr.sh/mmp.sh)
- [ ] Base agent runtime
- [ ] Memory management (basic)
- [ ] Configuration system

### Phase 2: Intelligence (Week 3-4)
- [ ] Decision engine
- [ ] Research engine (web search integration)
- [ ] Reasoning engine (LangChain)
- [ ] Content generation
- [ ] Tool orchestration framework

### Phase 3: Mentor Capabilities (Week 5-6)
- [ ] Teaching strategies
- [ ] Socratic method
- [ ] Knowledge synthesis
- [ ] Adaptive explanations
- [ ] Progress tracking

### Phase 4: Advanced Features (Week 7-8)
- [ ] Multi-agent collaboration
- [ ] Self-improvement
- [ ] Advanced memory (vector DB)
- [ ] Tool discovery
- [ ] Performance optimization

### Phase 5: Production Ready (Week 9-10)
- [ ] Monitoring & observability
- [ ] Deployment automation
- [ ] Documentation
- [ ] Testing suite
- [ ] Security hardening

---

## 🎓 MENTOR PERSONALITY FRAMEWORK

### Personality Dimensions

```typescript
interface MentorPersonality {
  // Teaching style
  teachingStyle: {
    directness: number        // 0 (Socratic) → 1 (Direct explanation)
    patience: number          // 0 (Fast-paced) → 1 (Very patient)
    formality: number         // 0 (Casual) → 1 (Formal)
    encouragement: number     // 0 (Neutral) → 1 (Very encouraging)
  }

  // Expertise
  expertise: {
    domains: string[]         // Areas of expertise
    depth: number            // 0 (Generalist) → 1 (Deep specialist)
    breadth: number          // 0 (Narrow) → 1 (Wide-ranging)
  }

  // Communication
  communication: {
    verbosity: number         // 0 (Concise) → 1 (Detailed)
    technicality: number      // 0 (Simple) → 1 (Technical)
    analogyUse: number        // 0 (Literal) → 1 (Many analogies)
    humor: number            // 0 (Serious) → 1 (Playful)
  }

  // Proactivity
  proactivity: {
    intervention: number      // 0 (Reactive) → 1 (Proactive)
    questionAsking: number    // 0 (Answering only) → 1 (Asks many questions)
    resourceSharing: number   // 0 (Minimal) → 1 (Shares many resources)
  }
}
```

### Example Mentor Profiles

```yaml
# profiles/socratic-tech-mentor.yaml
mentor:
  name: "SocraticTechMentor"
  persona: "A patient technology mentor who guides through questions"

  personality:
    teaching_style:
      directness: 0.3       # Prefers guiding with questions
      patience: 0.9         # Very patient
      formality: 0.4        # Casual but professional
      encouragement: 0.8    # Encouraging

    expertise:
      domains:
        - "software engineering"
        - "system architecture"
        - "algorithms"
      depth: 0.8
      breadth: 0.6

    communication:
      verbosity: 0.6
      technicality: 0.7
      analogy_use: 0.8
      humor: 0.5

    proactivity:
      intervention: 0.7
      question_asking: 0.9
      resource_sharing: 0.7
```

---

## 🧪 TESTING REQUIREMENTS

### Unit Tests
- Each component isolated
- Mock external dependencies
- 80%+ code coverage

### Integration Tests
- Platform adapters
- Tool integrations
- End-to-end flows

### Behavior Tests
- Mentor responses appropriate
- Decision quality
- Memory retention
- Learning effectiveness

### Performance Tests
- Response latency < 2s
- Concurrent agents
- Memory usage
- API quota management

---

## 📊 METRICS & MONITORING

### Agent Performance Metrics
- Response quality score
- Helpfulness rating (from users)
- Conversation engagement
- Goal achievement rate
- Learning progress tracking

### System Metrics
- Uptime
- API latency
- Error rates
- Token usage
- Cost per conversation

### Mentor Effectiveness Metrics
- Understanding check success
- Concept retention by users
- Progress over time
- Satisfaction ratings
- Repeat engagement

---

## 🌐 EXTENSIBILITY POINTS

### Plugin System

```typescript
interface AgentPlugin {
  name: string
  version: string

  // Lifecycle hooks
  onLoad(): Promise<void>
  onUnload(): Promise<void>

  // Capability extensions
  extendCapabilities(): Capability[]

  // Tool contributions
  contributeTools(): Tool[]

  // Event handlers
  onEvent(event: AgentEvent): Promise<void>
}
```

### Custom Tool Integration

```typescript
interface CustomTool {
  name: string
  description: string

  // Schema for parameters
  parameters: JSONSchema

  // Execution
  execute(params: any): Promise<ToolResult>

  // Capabilities
  capabilities: ToolCapability[]
}
```

---

## 📚 DOCUMENTATION REQUIREMENTS

### User Documentation
- Quick start guide
- Configuration reference
- API documentation
- Best practices
- Troubleshooting

### Developer Documentation
- Architecture overview
- Component design
- Extension guide
- Testing guide
- Deployment guide

### Mentor Documentation
- Teaching strategies
- Personality customization
- Domain expertise setup
- Evaluation criteria

---

## 🚀 SUCCESS CRITERIA

The system is successful when:

1. **Functional**
   - ✅ Agents can join any supported platform
   - ✅ Agents retrieve and publish messages correctly
   - ✅ Memory persists across sessions
   - ✅ Tools integrate seamlessly

2. **Intelligent**
   - ✅ Makes appropriate decisions
   - ✅ Conducts thorough research
   - ✅ Provides accurate information
   - ✅ Learns from interactions

3. **Mentor-like**
   - ✅ Guides rather than just answers
   - ✅ Adapts to learner level
   - ✅ Encourages understanding
   - ✅ Tracks progress

4. **Extensible**
   - ✅ Easy to add new platforms
   - ✅ Easy to add new tools
   - ✅ Easy to customize personalities
   - ✅ Plugin system works

5. **Production-ready**
   - ✅ Reliable and stable
   - ✅ Secure and safe
   - ✅ Well-documented
   - ✅ Monitorable and debuggable

---

## 💡 IMPLEMENTATION NOTES

### Technology Stack Recommendations

**Core:**
- TypeScript (type safety, scalability)
- Node.js (ecosystem, async)
- Bun (performance alternative)

**AI/LLM:**
- Anthropic Claude SDK (primary)
- OpenAI SDK (backup)
- LangChain (orchestration)

**Memory:**
- ChromaDB / Pinecone (vector)
- PostgreSQL / SQLite (relational)
- Redis (cache)

**Tools:**
- Tavily AI (web research)
- Mem0 (persistent memory)
- LangGraph (complex workflows)

**Infrastructure:**
- Docker (containerization)
- Kubernetes (orchestration)
- Prometheus + Grafana (monitoring)

### Development Principles

1. **Modularity**: Each component independently testable
2. **Abstraction**: Platform/tool agnostic core
3. **Extensibility**: Plugin architecture
4. **Reliability**: Graceful degradation
5. **Observability**: Comprehensive logging/metrics
6. **Security**: Defense in depth
7. **Performance**: Optimize critical paths
8. **Maintainability**: Clean, documented code

---

## 🎯 STARTER IMPLEMENTATION CHECKLIST

Use this checklist to guide development:

### Week 1-2: Foundation
- [ ] Create project structure
- [ ] Implement PlatformAdapter interface
- [ ] Implement MeeshyAdapter (using existing mmr/mmp)
- [ ] Create base MentorAgent class
- [ ] Implement WorkingMemory (in-memory)
- [ ] Create configuration system (YAML)
- [ ] Set up logging infrastructure
- [ ] Write unit tests for core components

### Week 3-4: Intelligence
- [ ] Integrate LangChain for reasoning
- [ ] Implement DecisionEngine
- [ ] Integrate Tavily for web research
- [ ] Create ResearchEngine
- [ ] Implement ContentGenerator (Claude/GPT)
- [ ] Create ToolRegistry
- [ ] Write integration tests

### Week 5-6: Mentor Capabilities
- [ ] Implement teaching strategies
- [ ] Create Socratic questioning module
- [ ] Build knowledge synthesis
- [ ] Implement adaptive explanations
- [ ] Add progress tracking
- [ ] Create mentor personality framework
- [ ] Write behavior tests

### Week 7-8: Advanced Features
- [ ] Implement EpisodicMemory (DB)
- [ ] Implement SemanticMemory (Vector DB)
- [ ] Add multi-agent coordination
- [ ] Create self-improvement module
- [ ] Build tool discovery system
- [ ] Optimize performance
- [ ] Add explainability features

### Week 9-10: Production
- [ ] Add comprehensive monitoring
- [ ] Create deployment automation
- [ ] Write complete documentation
- [ ] Create example configurations
- [ ] Security audit and hardening
- [ ] Load testing
- [ ] User acceptance testing

---

## 📝 FINAL NOTES

This prompt defines a **comprehensive, production-grade agent system**. The implementation should be:

1. **Incremental**: Build and test iteratively
2. **Pragmatic**: Use existing tools where possible
3. **Flexible**: Easy to extend and customize
4. **Robust**: Handle failures gracefully
5. **Ethical**: Safe, transparent, helpful

The goal is to create a system where AI agents can truly mentor humans across any platform, providing thoughtful guidance backed by research and reasoning.

**Start with the foundation, build incrementally, and keep the end vision in mind.**

Good luck! 🚀
