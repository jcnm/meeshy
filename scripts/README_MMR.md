# Meeshy Message Receiver (MMR)

## 📖 Overview

**MMR (Meeshy Message Receiver)** is a powerful command-line tool for retrieving and displaying messages from Meeshy conversations. It complements the **MMP (Meeshy Message Publisher)** tool, providing a complete solution for interacting with the Meeshy platform from the terminal.

## 🎯 Key Features

### Flexible Filtering
- **Count-based**: Retrieve a specific number of messages (e.g., last 200 messages)
- **Time-based**: Retrieve messages from a time period (e.g., last 10 hours, 3 days, 1 week)

### Multiple Output Formats
- **Pretty**: Human-readable formatted output with colors (default)
- **JSON**: Raw JSON for programmatic processing
- **Compact**: One-line per message for quick scanning
- **Raw**: Pure message content only

### Rich Display Options
- Show message translations in multiple languages
- Display message metadata (ID, type, status, language)
- Show attachments with details
- Relative and absolute timestamps
- Color-coded output for better readability

### Production-Ready
- Secure credential handling
- Automatic retry with exponential backoff
- Comprehensive error handling
- ANSI color support with fallbacks
- Cross-platform compatibility (macOS, Linux)

## 🚀 Quick Start

### Basic Usage

```bash
# Set your password
export MEESHY_PASSWORD="your_password"

# Get last 50 messages (default)
./mmr.sh

# Get last 200 messages
./mmr.sh -n 200

# Get messages from last 10 minutes
./mmr.sh -t 10m

# Get messages from last 2 hours
./mmr.sh -t 2h

# Get messages from last 3 days
./mmr.sh -t 3d

# Get messages from last week
./mmr.sh -t 1w
```

## 📊 Filtering Options

### Count-Based Filtering

Retrieve a specific number of messages:

```bash
# Last 50 messages (default)
./mmr.sh

# Last 100 messages
./mmr.sh -n 100

# Last 500 messages
./mmr.sh --count 500
```

### Time-Based Filtering

Retrieve messages from a specific time period:

```bash
# Minutes
./mmr.sh -t 10m      # Last 10 minutes
./mmr.sh -t 30min    # Last 30 minutes
./mmr.sh -t 45minutes # Last 45 minutes

# Hours
./mmr.sh -t 2h       # Last 2 hours
./mmr.sh -t 5hour    # Last 5 hours
./mmr.sh -t 12hours  # Last 12 hours

# Days
./mmr.sh -t 1d       # Last day
./mmr.sh -t 7day     # Last 7 days
./mmr.sh -t 14days   # Last 14 days

# Weeks
./mmr.sh -t 1w       # Last week
./mmr.sh -t 2week    # Last 2 weeks
./mmr.sh -t 4weeks   # Last 4 weeks

# Months (approximate: 30 days)
./mmr.sh -t 1M       # Last month
./mmr.sh -t 2month   # Last 2 months
./mmr.sh -t 6months  # Last 6 months
```

## 🎨 Output Formats

### Pretty Format (Default)

Human-readable output with colors and formatting:

```bash
./mmr.sh -f pretty
```

Output example:
```
╔════════════════════════════════════════════════════════════════════════════╗
║                              Messages                                      ║
╚════════════════════════════════════════════════════════════════════════════╝

From: john (2h ago)
Time: 2025-10-19 14:30:45
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Hello team! New version is ready for testing.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### JSON Format

Raw JSON output for processing:

```bash
./mmr.sh -f json

# Process with jq
./mmr.sh -f json | jq '.[] | {sender: .sender.username, content: .content}'
```

### Compact Format

One-line per message:

```bash
./mmr.sh -f compact
```

Output example:
```
[2h ago] john: Hello team! New version is ready for testing.
[3h ago] sarah: Great! I'll start testing now.
[4h ago] mike: Any breaking changes?
```

### Raw Format

Pure message content only:

```bash
./mmr.sh -f raw

# Save to file
./mmr.sh -f raw -n 100 > messages.txt
```

## 🔍 Advanced Options

### Show Translations

Display all available translations for each message:

```bash
./mmr.sh --show-translations
```

Output includes:
```
From: jean (1h ago)
Time: 2025-10-19 15:30:45
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Bonjour à tous!

Translations:
  [en] Hello everyone!
  [es] ¡Hola a todos!
  [de] Hallo zusammen!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Show Metadata

Display message metadata (ID, type, status, language):

```bash
./mmr.sh --show-metadata
```

Output includes:
```
From: john (2h ago)
Time: 2025-10-19 14:30:45
ID: msg_abc123xyz
Type: text
Language: en
Status: delivered
```

### Show Attachments

Display attachments with details:

```bash
./mmr.sh --show-attachments
```

Output includes:
```
From: sarah (1h ago)
Time: 2025-10-19 15:30:45
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Check out this screenshot

Attachments (2):
  📎 screenshot.png (image/png, 245678 bytes)
     https://meeshy.me/uploads/screenshot.png
  📎 report.pdf (application/pdf, 1245678 bytes)
     https://meeshy.me/uploads/report.pdf
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Combined Options

Combine multiple display options:

```bash
# Full details view
./mmr.sh --show-metadata --show-translations --show-attachments -n 20

# Compact with translations
./mmr.sh -f compact --show-translations -t 1h

# JSON with all messages from last day
./mmr.sh -f json -t 1d > daily_messages.json
```

## 🔧 Configuration

### Command-Line Options

```bash
General:
  -h, --help              Show help message
  -v, --verbose           Verbose mode (show debug information)
  -u, --username USER     Username (default: meeshy)
  -p, --password PASS     Password (or use MEESHY_PASSWORD)
  -c, --conversation ID   Conversation ID (default: meeshy)
  -a, --api-url URL       API URL (default: https://gate.meeshy.me)

Filtering:
  -n, --count N           Number of messages (default: 50, max: 10000)
  -t, --time PERIOD       Time period (e.g., 10m, 2h, 3d, 1w, 2M)

Display:
  -f, --format FORMAT     Output format (pretty, json, compact, raw)
  --show-translations     Show message translations
  --show-metadata         Show message metadata
  --show-attachments      Show message attachments
```

### Environment Variables

```bash
# Required
export MEESHY_PASSWORD="your_password"

# Optional (with defaults)
export MEESHY_USERNAME="meeshy"
export MEESHY_API_URL="https://gate.meeshy.me"
export MEESHY_FRONTEND_URL="https://meeshy.me"
export MEESHY_CONVERSATION_ID="meeshy"

# Network tuning
export MEESHY_CONNECT_TIMEOUT=10
export MEESHY_MAX_TIMEOUT=30
export MEESHY_MAX_RETRIES=3
```

## 📋 Common Use Cases

### Daily Standup Review

Check messages from the last 24 hours:

```bash
./mmr.sh -c standup -t 1d -f compact
```

### Export Conversation History

Export all messages as JSON:

```bash
./mmr.sh -c tech-team -n 10000 -f json > team_history.json
```

### Monitor Recent Activity

Quick check of recent messages:

```bash
./mmr.sh -t 30m -f compact
```

### Search in Messages

Get raw content and search:

```bash
./mmr.sh -n 500 -f raw | grep -i "deployment"
```

### Multi-language Review

Review messages with all translations:

```bash
./mmr.sh -c international-team --show-translations -t 1d
```

### Analyze Message Content

Extract specific fields with jq:

```bash
# Get sender statistics
./mmr.sh -f json -n 1000 | jq -r '.[] | .sender.username' | sort | uniq -c | sort -nr

# Get message timestamps
./mmr.sh -f json -n 100 | jq -r '.[] | {time: .createdAt, sender: .sender.username}'

# Find messages with attachments
./mmr.sh -f json -n 500 | jq '.[] | select(.attachments | length > 0)'
```

## 🛡️ Security Features

- **Secure credential handling**: Passwords never logged or displayed
- **Temporary file cleanup**: Automatic secure deletion
- **Permission verification**: Checks conversation access before retrieval
- **Input validation**: All inputs sanitized and validated
- **Secure HTTP requests**: Proper timeout and retry logic

## 🔄 Integration Examples

### With MMP (Message Publisher)

Send and receive messages:

```bash
# Send announcement
./mmp.sh -c team-updates -f announcement.txt

# Verify reception
./mmr.sh -c team-updates -n 1
```

### Automated Monitoring

Monitor conversation in real-time:

```bash
#!/bin/bash
while true; do
    clear
    ./mmr.sh -t 5m -f compact
    sleep 60
done
```

### Backup Script

Daily backup of all conversations:

```bash
#!/bin/bash
DATE=$(date +%Y%m%d)
CONVERSATIONS=("general" "tech-team" "announcements")

for conv in "${CONVERSATIONS[@]}"; do
    ./mmr.sh -c "$conv" -n 10000 -f json > "backup_${conv}_${DATE}.json"
done
```

### Slack Integration

Forward Meeshy messages to Slack:

```bash
#!/bin/bash
MESSAGES=$(./mmr.sh -c tech-team -t 5m -f json)

if [ ! -z "$MESSAGES" ]; then
    echo "$MESSAGES" | jq -c '.[]' | while read msg; do
        CONTENT=$(echo "$msg" | jq -r '.content')
        SENDER=$(echo "$msg" | jq -r '.sender.username')
        
        curl -X POST "$SLACK_WEBHOOK_URL" \
            -H 'Content-Type: application/json' \
            -d "{\"text\":\"*${SENDER}*: ${CONTENT}\"}"
    done
fi
```

## 🐛 Troubleshooting

### Authentication Issues

```bash
# Verbose mode for debugging
./mmr.sh -v -n 10

# Check credentials
echo "Testing with username: meeshy"
export MEESHY_PASSWORD="your_password"
./mmr.sh -n 1
```

### Network Issues

```bash
# Increase timeouts
export MEESHY_CONNECT_TIMEOUT=30
export MEESHY_MAX_TIMEOUT=60
export MEESHY_MAX_RETRIES=5

./mmr.sh -v
```

### No Messages Retrieved

```bash
# Check conversation access
./mmr.sh -c your-conversation -v

# Verify conversation ID
./mmr.sh --help  # Check correct conversation ID format
```

### Time Filter Issues

```bash
# Verify time format
./mmr.sh -t 10m   # Correct
./mmr.sh -t 10    # Incorrect (missing unit)

# Supported units: m, h, d, w, M
```

## 📊 Exit Codes

```
0   - Success
1   - General error
64  - Usage error (invalid arguments)
65  - Data format error
67  - Authentication error
69  - Service unavailable
77  - Permission denied
78  - Configuration error
```

## 🔄 Version History

### v1.0.0 (2025-10-19)
- Initial release
- Count-based and time-based filtering
- Multiple output formats (pretty, json, compact, raw)
- Translation and metadata display
- Attachment support
- Secure credential handling
- Comprehensive error handling

## 🤝 Companion Tools

- **MMP (mmp.sh)**: Meeshy Message Publisher - Send messages to conversations
- **MMR (mmr.sh)**: Meeshy Message Receiver - Retrieve and display messages

## 📚 Additional Resources

- [Meeshy Documentation](https://docs.meeshy.me)
- [API Reference](https://gate.meeshy.me/api/docs)
- [GitHub Repository](https://github.com/meeshy/meeshy)

## 📝 License

This tool is part of the Meeshy project and follows the same license.

---

**Meeshy - Breaking language barriers** 🌐
