# Chinese Translations - TODO

## Status: 🚧 Structure Only - Translations Needed

This directory contains the Chinese (ZH) translation structure for Meeshy.

**Current State**: The JSON files currently contain French translations as placeholders.

**Action Required**: All files need to be translated from French to Chinese (Simplified).

## Files to Translate (12 modules)

1. ✅ **common.json** - Common translations (buttons, errors, validation)
2. ✅ **auth.json** - Authentication (login, register, join)
3. ✅ **landing.json** - Landing page
4. ✅ **dashboard.json** - Dashboard
5. ✅ **conversations.json** - Conversations and chat
6. ✅ **settings.json** - Settings page
7. ✅ **pages.json** - Static pages (about, contact, partners)
8. ✅ **components.json** - UI components
9. ✅ **modals.json** - Modal dialogs
10. ✅ **features.json** - Features and functionality
11. ✅ **legal.json** - Legal documents (privacy, terms)
12. ✅ **header.json** - Header navigation

## Translation Instructions

1. Open each JSON file
2. Keep the JSON structure intact (keys must not change)
3. Translate only the string values from French to Chinese (Simplified)
4. Maintain parameter placeholders like `{name}`, `{count}`, etc.
5. Test with the application to ensure proper formatting

## Example

```json
// BEFORE (French placeholder)
{
  "common": {
    "loading": "Chargement...",
    "save": "Enregistrer"
  }
}

// AFTER (Chinese translation)
{
  "common": {
    "loading": "加载中...",
    "save": "保存"
  }
}
```

## Priority Order

Translate in this order for maximum impact:
1. common.json (used everywhere)
2. auth.json (critical user flow)
3. landing.json (first impression)
4. dashboard.json, conversations.json
5. Other files

## Testing

After translation, test the application with Chinese language selected:
- All UI elements should display in Chinese
- No French text should remain
- All placeholders should work correctly

Last updated: January 9, 2026

