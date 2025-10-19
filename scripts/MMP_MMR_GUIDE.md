# Meeshy CLI Tools - MMP & MMR

## 📚 Overview

Two complementary command-line tools for complete interaction with the Meeshy messaging platform:

- **MMP (Meeshy Message Publisher)** - Send/publish messages
- **MMR (Meeshy Message Receiver)** - Retrieve/read messages

## 🔄 Tool Comparison

| Feature | MMP (Publisher) | MMR (Receiver) |
|---------|----------------|----------------|
| **Primary Function** | Send messages | Retrieve messages |
| **Input Source** | File or inline text | API query |
| **Output** | Confirmation message | Message display |
| **Filtering** | N/A | Count or time-based |
| **Display Formats** | N/A | Pretty, JSON, Compact, Raw |
| **File Operations** | Read, backup, cleanup | N/A |
| **Permission Check** | Write access | Read access |
| **Use Cases** | Announcements, automation | Monitoring, archiving, analysis |

## 🚀 Quick Start Examples

### Publishing Messages (MMP)

```bash
# Set credentials
export MEESHY_PASSWORD="your_password"

# Publish from default POST file
./mmp.sh

# Publish specific file
./mmp.sh -f announcement.txt

# Publish inline message
./mmp.sh "New release available!"

# Publish to specific conversation
./mmp.sh -c team-updates -f post.txt
```

### Retrieving Messages (MMR)

```bash
# Set credentials
export MEESHY_PASSWORD="your_password"

# Get last 50 messages (default)
./mmr.sh

# Get last 200 messages
./mmr.sh -n 200

# Get messages from last 2 hours
./mmr.sh -t 2h

# Get messages from last week
./mmr.sh -t 1w

# Get messages in JSON format
./mmr.sh -f json -n 100
```

## 📊 Common Workflows

### 1. Announcement Workflow

**Send announcement:**
```bash
# Create announcement
cat > announcement.txt << EOF
🎉 New Feature Released!

We're excited to announce the availability of...
EOF

# Publish to announcements channel
./mmp.sh -c announcements -f announcement.txt -y
```

**Verify reception:**
```bash
# Check if message was received
./mmr.sh -c announcements -n 1 -f compact
```

### 2. Conversation Monitoring

**Monitor recent activity:**
```bash
# Check last 5 minutes
./mmr.sh -t 5m -f compact

# Watch for new messages (loop)
watch -n 60 "./mmr.sh -t 1m -f compact"
```

### 3. Data Export & Backup

**Export conversation history:**
```bash
# Export as JSON
./mmr.sh -c tech-team -n 10000 -f json > backup_$(date +%Y%m%d).json

# Export raw content
./mmr.sh -c general -n 5000 -f raw > messages.txt
```

### 4. Message Analysis

**Analyze conversation:**
```bash
# Get all messages with metadata
./mmr.sh -n 1000 -f json --show-metadata > data.json

# Count messages per sender
./mmr.sh -n 1000 -f json | jq -r '.[] | .sender.username' | sort | uniq -c | sort -nr

# Find messages with attachments
./mmr.sh -n 500 -f json | jq '.[] | select(.attachments | length > 0)'

# Search for keywords
./mmr.sh -n 500 -f raw | grep -i "deployment"
```

### 5. Automated Publishing

**Daily digest script:**
```bash
#!/bin/bash

# Generate daily summary
SUMMARY=$(cat << EOF
📅 Daily Summary - $(date +%Y-%m-%d)

Key highlights:
- Feature X deployed
- Bug fixes completed
- Next sprint planning

Stay tuned for more updates!
EOF
)

# Publish to team channel
echo "$SUMMARY" | ./mmp.sh -c daily-updates -y
```

### 6. Integration Testing

**Send and verify:**
```bash
#!/bin/bash

# Send test message
TEST_MSG="Test message at $(date)"
echo "$TEST_MSG" > test_post.txt
./mmp.sh -f test_post.txt -y

# Wait a bit
sleep 2

# Verify message received
RECEIVED=$(./mmr.sh -n 1 -f raw 2>/dev/null)

if [[ "$RECEIVED" == "$TEST_MSG" ]]; then
    echo "✅ Test passed"
else
    echo "❌ Test failed"
fi
```

## 🔧 Shared Configuration

Both tools use the same environment variables:

```bash
# Required
export MEESHY_PASSWORD="your_password"

# Optional (defaults shown)
export MEESHY_USERNAME="meeshy"
export MEESHY_API_URL="https://gate.meeshy.me"
export MEESHY_FRONTEND_URL="https://meeshy.me"
export MEESHY_CONVERSATION_ID="meeshy"

# Network tuning
export MEESHY_CONNECT_TIMEOUT=10
export MEESHY_MAX_TIMEOUT=30
export MEESHY_MAX_RETRIES=3
```

## 🎨 Output Format Comparison

### MMP Output

```
╔════════════════════════════════════════════════════════════════╗
║        Meeshy Message Publisher (MMP) v1.0.1                   ║
╚════════════════════════════════════════════════════════════════╝

Configuration:
  API URL: https://gate.meeshy.me
  Username: meeshy
  Conversation: meeshy
  Language: en
  Source: File POST

Message preview:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
New feature available...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[STEP] Step 1/4: Authentication...
[SUCCESS] Authentication successful (User: meeshy)
[STEP] Step 2/4: Checking permissions...
[SUCCESS] Conversation found: Meeshy Global
[STEP] Step 3/4: Sending message...
[SUCCESS] Message published successfully!
[STEP] Step 4/4: Cleanup...
[SUCCESS] File cleaned: POST

╔════════════════════════════════════════════════════════════════╗
║                  Publication successful!                      ║
╚════════════════════════════════════════════════════════════════╝
```

### MMR Output (Pretty Format)

```
╔════════════════════════════════════════════════════════════════════════════╗
║                              Messages                                      ║
╚════════════════════════════════════════════════════════════════════════════╝

From: john (2h ago)
Time: 2025-10-19 14:30:45
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
New feature available! Please test and provide feedback.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

From: sarah (3h ago)
Time: 2025-10-19 13:15:22
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Working on the integration tests.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

End of messages (2 total)
```

## 🛡️ Security Best Practices

Both tools follow the same security principles:

1. **Password Management**
   - Never hardcode passwords
   - Use environment variables
   - Consider using a secure vault

2. **Secure Cleanup**
   - Temporary files are securely overwritten
   - Cookie files are automatically removed
   - POST files are backed up before deletion

3. **Network Security**
   - HTTPS only
   - Proper timeout handling
   - Retry with exponential backoff

## 📋 Use Case Matrix

| Use Case | Tool | Command Example |
|----------|------|----------------|
| Send announcement | MMP | `./mmp.sh -f announcement.txt` |
| Check recent messages | MMR | `./mmr.sh -t 30m` |
| Export conversation | MMR | `./mmr.sh -n 10000 -f json > backup.json` |
| Publish daily update | MMP | `./mmp.sh -c daily "Update message"` |
| Monitor activity | MMR | `./mmr.sh -t 5m -f compact` |
| Bulk messaging | MMP | `for f in posts/*.txt; do ./mmp.sh -f "$f"; done` |
| Search messages | MMR | `./mmr.sh -n 500 -f raw \| grep "keyword"` |
| Verify delivery | MMR | `./mmr.sh -n 1 -f json` |

## 🔗 Integration Examples

### Slack Bridge

**Send Meeshy messages to Slack:**
```bash
#!/bin/bash
./mmr.sh -t 5m -f json | jq -c '.[]' | while read msg; do
    CONTENT=$(echo "$msg" | jq -r '.content')
    SENDER=$(echo "$msg" | jq -r '.sender.username')
    
    curl -X POST "$SLACK_WEBHOOK_URL" \
        -H 'Content-Type: application/json' \
        -d "{\"text\":\"*${SENDER}*: ${CONTENT}\"}"
done
```

**Send Slack messages to Meeshy:**
```bash
# Slack slash command handler
SLACK_MESSAGE="$1"
echo "$SLACK_MESSAGE" > temp_post.txt
./mmp.sh -f temp_post.txt -y
rm temp_post.txt
```

### Git Commit Notifications

```bash
#!/bin/bash
# Post-commit hook

COMMIT_MSG=$(git log -1 --pretty=%B)
AUTHOR=$(git log -1 --pretty=%an)

./mmp.sh "🔄 New commit by ${AUTHOR}:\n${COMMIT_MSG}" -c dev-updates -y
```

### Monitoring & Alerting

```bash
#!/bin/bash
# Check for error messages

ERRORS=$(./mmr.sh -t 5m -f raw | grep -i "error\|failed\|exception" | wc -l)

if [ $ERRORS -gt 0 ]; then
    ./mmp.sh "⚠️ ${ERRORS} errors detected in the last 5 minutes!" -c alerts -y
fi
```

## 🐛 Troubleshooting Guide

### Common Issues

| Issue | Tool | Solution |
|-------|------|----------|
| Authentication failed | Both | Check MEESHY_PASSWORD env var |
| Conversation not found | Both | Verify conversation ID with -c |
| Permission denied | MMP | Verify write access to conversation |
| No messages found | MMR | Check time filter or increase count |
| Network timeout | Both | Increase MEESHY_MAX_TIMEOUT |
| JSON parse error | MMR | Use `2>/dev/null` to suppress logs |

### Debug Mode

Both tools support verbose mode:

```bash
# MMP debug
./mmp.sh -v -f post.txt

# MMR debug
./mmr.sh -v -n 10
```

## 📚 Advanced Tips

### 1. Pipeline Processing

```bash
# Get messages, filter, and republish
./mmr.sh -t 1d -f json | \
    jq '.[] | select(.sender.username == "important-user") | .content' | \
    ./mmp.sh -c archive -y
```

### 2. Scheduled Tasks

```bash
# Crontab entry for hourly summary
0 * * * * cd /path/to/scripts && ./mmr.sh -t 1h -f compact > /var/log/meeshy/hourly.log
```

### 3. Message Templating

```bash
# Template with variables
cat > template.txt << 'EOF'
🚀 Deployment Alert

Environment: ${ENV}
Version: ${VERSION}
Status: ${STATUS}
EOF

# Fill template and publish
ENV="production" VERSION="v1.2.3" STATUS="success" \
    envsubst < template.txt | ./mmp.sh -c deployments -y
```

## 📊 Performance Considerations

| Operation | Tool | Max Throughput | Notes |
|-----------|------|----------------|-------|
| Single message | MMP | 1-2 msg/sec | Includes verification |
| Bulk messages | MMP | ~10 msg/sec | Without verification |
| Message retrieval | MMR | 10k msg/request | API limit |
| Time-based query | MMR | Variable | Depends on timeframe |

## 🔄 Version Compatibility

- **MMP**: v1.0.1
- **MMR**: v1.0.0
- **API**: Meeshy v1.x
- **Bash**: 4.0+
- **Dependencies**: curl, jq, date, mktemp

## 📝 License & Support

Both tools are part of the Meeshy project.

- Documentation: https://docs.meeshy.me
- Issues: GitHub Issues
- Community: Meeshy Global conversation

---

**Meeshy - Breaking language barriers** 🌐
