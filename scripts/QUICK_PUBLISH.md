# Quick Publish Guide - Meeshy Announcement

## Ready to Publish! ✅

Your announcement is ready in `scripts/POST` (467 characters).

## Steps to Publish

### 1. Set Your Password

```bash
export MEESHY_PASSWORD="your_meeshy_password"
```

### 2. Publish the Announcement

```bash
cd scripts
./mmp.sh
```

That's it! The script will:
- Use the default API URL: `https://gate.meeshy.me` (backend)
- Publish your message
- Display the frontend URL: `https://meeshy.me/conversations/meeshy`

## What Happens

1. **Authentication** - Connects to gate.meeshy.me API
2. **Permission Check** - Verifies access to conversation
3. **Publication** - Posts the message
4. **Confirmation** - Shows the public URL (meeshy.me)

## After Publication

Your message will be visible at:
**https://meeshy.me/conversations/meeshy**

(Note: The API is at gate.meeshy.me, but users access content at meeshy.me)

## Troubleshooting

### Missing password
```bash
export MEESHY_PASSWORD="your_password"
```

### Wrong API URL
```bash
export MEESHY_API_URL="https://gate.meeshy.me"
```

### Custom frontend URL
```bash
export MEESHY_FRONTEND_URL="https://custom.meeshy.me"
```

## Advanced Options

### Non-interactive mode (for scripts)
```bash
export MEESHY_PASSWORD="password"
./mmp.sh -y
```

### Verbose mode (for debugging)
```bash
./mmp.sh -v
```

### Keep the POST file after publishing
```bash
./mmp.sh --no-cleanup
```

---

Ready to launch Meeshy! 🚀
