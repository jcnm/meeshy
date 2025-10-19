# MMR AI-Friendly Format Documentation

## 🤖 Overview

The `ai` output format is specifically designed for AI agents, RAG systems, and automated processes that need clean, structured message data without UI decoration.

## 🎯 Key Features

### 1. **Consistent Structure**
Every message has the exact same JSON structure, making it predictable for AI processing.

### 2. **Essential Data Only**
No verbose metadata, UI formatting, or decoration - just the information needed for context building and decision making.

### 3. **Flattened Hierarchy**
Sender information is flattened for easier access without nested navigation.

### 4. **Time-Accurate Filtering**
Client-side timestamp filtering ensures you get only messages from the exact time range requested.

## 📋 JSON Structure

```json
[
  {
    "id": "string",           // Unique message ID
    "timestamp": "ISO8601",   // When the message was sent
    "sender": {
      "id": "string",         // Sender's unique ID
      "username": "string",   // Sender's username
      "displayName": "string|null"  // Sender's display name
    },
    "content": "string",      // Message content in original language
    "language": "string",     // ISO 639-1 language code (e.g., "en", "fr")
    "type": "string",         // Message type ("text", "image", "file", etc.)
    "translations": [
      {
        "language": "string", // Target language code
        "content": "string"   // Translated content
      }
    ],
    "hasAttachments": boolean,  // Quick check for attachments
    "attachments": [
      {
        "filename": "string",
        "type": "string",     // MIME type
        "size": number,       // Size in bytes
        "url": "string"       // Download URL
      }
    ],
    "replyTo": {              // null if not a reply
      "id": "string",
      "content": "string",
      "sender": "string"
    },
    "reactions": [
      {
        "emoji": "string",
        "count": number,
        "users": ["string"]   // Array of usernames
      }
    ]
  }
]
```

## 🚀 Usage Examples

### Basic Retrieval

```bash
# Get last 100 messages in AI format
./mmr.sh -n 100 -f ai > messages.json

# Get messages from last 2 hours
./mmr.sh -t 2h -f ai > recent_context.json

# Get messages from specific conversation
./mmr.sh -c tech-team -n 50 -f ai > team_messages.json
```

### RAG/LLM Context Building

```bash
# Extract just message content for embeddings
./mmr.sh -n 200 -f ai | jq -r '.[].content' > training_data.txt

# Get content with sender context
./mmr.sh -t 1d -f ai | jq -r '.[] | "\(.sender.username): \(.content)"' > conversation.txt

# Extract multilingual content
./mmr.sh -n 100 -f ai | jq -r '.[] | .content, (.translations[].content)' > multilingual.txt
```

### Analysis & Processing

```bash
# Count messages per sender
./mmr.sh -n 500 -f ai | jq -r '.[].sender.username' | sort | uniq -c

# Find messages with attachments
./mmr.sh -n 200 -f ai | jq '.[] | select(.hasAttachments == true)'

# Get all messages in a specific language
./mmr.sh -n 100 -f ai | jq '.[] | select(.language == "fr")'

# Extract thread conversations (replies)
./mmr.sh -n 50 -f ai | jq '.[] | select(.replyTo != null)'
```

### Time-Based Intelligence

```bash
# Last hour of activity
./mmr.sh -t 1h -f ai > last_hour.json

# Daily digest
./mmr.sh -t 1d -f ai | jq -r '.[] | "\(.timestamp): \(.sender.username) - \(.content)"'

# Recent messages by timeframe
./mmr.sh -t 30m -f ai > last_30min.json
```

## 🤖 AI Agent Integration Examples

### Python RAG System

```python
import json
import subprocess

def get_conversation_context(hours=2, conversation_id="general"):
    """Retrieve recent messages for RAG context"""
    cmd = [
        "./mmr.sh",
        "-t", f"{hours}h",
        "-c", conversation_id,
        "-f", "ai"
    ]
    
    result = subprocess.run(cmd, capture_output=True, text=True, env={
        "MEESHY_PASSWORD": os.getenv("MEESHY_PASSWORD")
    })
    
    messages = json.loads(result.stdout)
    
    # Build context string
    context = []
    for msg in messages:
        sender = msg["sender"]["displayName"] or msg["sender"]["username"]
        context.append(f"{sender}: {msg['content']}")
    
    return "\n".join(context)

# Use in your LLM
conversation_history = get_conversation_context(hours=2)
response = llm.generate(f"Context:\n{conversation_history}\n\nUser question: {question}")
```

### Node.js/TypeScript Agent

```typescript
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface AIMessage {
  id: string;
  timestamp: string;
  sender: {
    id: string;
    username: string;
    displayName: string | null;
  };
  content: string;
  language: string;
  type: string;
  translations: Array<{
    language: string;
    content: string;
  }>;
  hasAttachments: boolean;
  attachments: any[];
  replyTo: any;
  reactions: any[];
}

async function getRecentMessages(timeframe: string = "2h"): Promise<AIMessage[]> {
  const { stdout } = await execAsync(
    `./mmr.sh -t ${timeframe} -f ai 2>/dev/null`,
    {
      env: { ...process.env, MEESHY_PASSWORD: process.env.MEESHY_PASSWORD }
    }
  );
  
  return JSON.parse(stdout);
}

// Build conversation summary
async function buildConversationSummary(): Promise<string> {
  const messages = await getRecentMessages("1d");
  
  return messages
    .map(m => `[${m.timestamp}] ${m.sender.username}: ${m.content}`)
    .join("\n");
}
```

### LangChain Integration

```python
from langchain.document_loaders import JSONLoader
from langchain.embeddings import OpenAIEmbeddings
from langchain.vectorstores import Chroma
import subprocess
import json
import tempfile

class MeeshyMessageLoader:
    def __init__(self, conversation_id="general", timeframe="1d"):
        self.conversation_id = conversation_id
        self.timeframe = timeframe
    
    def load_documents(self):
        """Load messages as LangChain documents"""
        # Get messages
        result = subprocess.run(
            ["./mmr.sh", "-c", self.conversation_id, "-t", self.timeframe, "-f", "ai"],
            capture_output=True,
            text=True,
            env={"MEESHY_PASSWORD": os.getenv("MEESHY_PASSWORD")}
        )
        
        messages = json.loads(result.stdout)
        
        # Convert to LangChain documents
        documents = []
        for msg in messages:
            doc_content = f"""
            Sender: {msg['sender']['username']}
            Time: {msg['timestamp']}
            Language: {msg['language']}
            
            {msg['content']}
            """
            
            metadata = {
                "id": msg["id"],
                "sender": msg["sender"]["username"],
                "timestamp": msg["timestamp"],
                "language": msg["language"],
                "hasAttachments": msg["hasAttachments"]
            }
            
            documents.append(Document(page_content=doc_content, metadata=metadata))
        
        return documents

# Usage in RAG pipeline
loader = MeeshyMessageLoader(conversation_id="tech-team", timeframe="7d")
documents = loader.load_documents()

embeddings = OpenAIEmbeddings()
vectorstore = Chroma.from_documents(documents, embeddings)

# Query the conversation history
query = "What were the recent deployments discussed?"
results = vectorstore.similarity_search(query, k=5)
```

### Slack Bot Integration

```bash
#!/bin/bash

# Monitor Meeshy and forward to Slack
while true; do
    # Get messages from last 5 minutes
    MESSAGES=$(./mmr.sh -t 5m -f ai 2>/dev/null)
    
    # Check if there are new messages
    COUNT=$(echo "$MESSAGES" | jq 'length')
    
    if [ "$COUNT" -gt 0 ]; then
        # Format for Slack
        echo "$MESSAGES" | jq -r '.[] | 
            "*\(.sender.username)*: \(.content)\n_\(.timestamp)_\n"
        ' | while IFS= read -r message; do
            # Post to Slack
            curl -X POST "$SLACK_WEBHOOK_URL" \
                -H 'Content-Type: application/json' \
                -d "{\"text\":\"$message\"}"
        done
    fi
    
    # Wait 5 minutes
    sleep 300
done
```

### Discord Bot Integration

```python
import discord
import subprocess
import json
import asyncio

class MeeshyBot(discord.Client):
    async def on_ready(self):
        print(f'Logged in as {self.user}')
        self.bg_task = self.loop.create_task(self.monitor_meeshy())
    
    async def monitor_meeshy(self):
        """Monitor Meeshy and forward to Discord"""
        await self.wait_until_ready()
        channel = self.get_channel(DISCORD_CHANNEL_ID)
        
        while not self.is_closed():
            # Get recent messages
            result = subprocess.run(
                ["./mmr.sh", "-t", "5m", "-f", "ai"],
                capture_output=True,
                text=True,
                env={"MEESHY_PASSWORD": os.getenv("MEESHY_PASSWORD")}
            )
            
            messages = json.loads(result.stdout)
            
            for msg in messages:
                embed = discord.Embed(
                    description=msg["content"],
                    color=0x00ff00,
                    timestamp=datetime.fromisoformat(msg["timestamp"].replace("Z", "+00:00"))
                )
                embed.set_author(name=msg["sender"]["username"])
                
                await channel.send(embed=embed)
            
            await asyncio.sleep(300)  # 5 minutes
```

## 📊 Comparison with Other Formats

| Feature | `ai` | `json` | `compact` | `raw` |
|---------|------|--------|-----------|-------|
| Clean structure | ✅ | ❌ | ❌ | ❌ |
| Consistent fields | ✅ | ❌ | N/A | N/A |
| Flattened data | ✅ | ❌ | ❌ | N/A |
| No UI decoration | ✅ | ❌ | ❌ | ✅ |
| Parseable | ✅ | ✅ | ❌ | ❌ |
| Translations included | ✅ | ✅ | ❌ | ❌ |
| Attachment info | ✅ | ✅ | ❌ | ❌ |
| Reply context | ✅ | ✅ | ❌ | ❌ |
| AI-ready | ✅ | ❌ | ❌ | ⚠️ |

## 🎓 Best Practices

### 1. Time Filtering Accuracy

```bash
# ✅ Good: Use specific timeframes
./mmr.sh -t 2h -f ai

# ❌ Avoid: Fetching too many messages unnecessarily
./mmr.sh -n 10000 -f ai  # May include old messages
```

### 2. Language Processing

```bash
# Get original language content
jq -r '.[].content' messages.json

# Get all available translations
jq -r '.[] | .content, (.translations[].content)' messages.json

# Get specific language translation
jq -r '.[] | .translations[] | select(.language == "es") | .content' messages.json
```

### 3. Context Window Management

```bash
# For LLM context (last 2 hours is usually enough)
./mmr.sh -t 2h -f ai | jq -r '.[-20:] | .[] | "\(.sender.username): \(.content)"'

# For embedding/RAG (longer history)
./mmr.sh -t 7d -f ai > weekly_context.json
```

### 4. Efficient Polling

```bash
# ✅ Good: Poll with reasonable intervals
./mmr.sh -t 5m -f ai  # Every 5 minutes

# ❌ Avoid: Too frequent polling
./mmr.sh -t 10s -f ai  # May hit rate limits
```

## 🔧 Troubleshooting

### No Messages Returned

```bash
# Check with verbose mode
./mmr.sh -t 1h -f ai -v 2>&1 | grep "Filtered"

# Try increasing timeframe
./mmr.sh -t 6h -f ai
```

### Invalid JSON Output

```bash
# Ensure stderr is redirected
./mmr.sh -t 2h -f ai 2>/dev/null | jq '.'

# Check for authentication issues
./mmr.sh -t 1h -f ai -v 2>&1 | grep "ERROR"
```

### Performance Issues

```bash
# Use count filter for large datasets
./mmr.sh -n 500 -f ai

# Limit scope to specific conversation
./mmr.sh -c specific-channel -t 1d -f ai
```

## 📝 Schema Reference

See the JSON structure section above for the complete schema.

All fields are guaranteed to be present in every message, with `null` or empty arrays as defaults for optional fields.

---

**Perfect for**: RAG systems, LLM context building, automated agents, conversation analysis, multi-language processing, and any AI-powered application that needs clean, structured message data.
