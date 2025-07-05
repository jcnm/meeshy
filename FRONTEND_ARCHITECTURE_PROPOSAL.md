# 🗂️ Nouvelle Architecture Proposée pour /src/components

## Structure Recommandée

```
src/components/
├── common/                     # Composants réutilisables
│   ├── Avatar/
│   ├── Button/
│   ├── Card/
│   ├── Modal/
│   ├── Input/
│   └── index.ts
│
├── layout/                     # Composants de mise en page
│   ├── ResponsiveLayout/
│   ├── Navigation/
│   ├── Sidebar/
│   └── Header/
│
├── auth/                       # Authentification
│   ├── LoginForm/
│   ├── RegisterForm/
│   ├── ProtectedRoute/
│   └── index.ts
│
├── dashboard/                  # Dashboard spécifique
│   ├── StatsCard/
│   ├── QuickActions/
│   ├── RecentActivity/
│   └── index.ts
│
├── conversations/              # Gestion conversations
│   ├── ConversationList/
│   ├── ConversationView/
│   ├── MessageBubble/
│   ├── MessageInput/
│   ├── TypingIndicator/
│   └── index.ts
│
├── groups/                     # Gestion groupes
│   ├── GroupList/
│   ├── GroupView/
│   ├── GroupSettings/
│   ├── MemberList/
│   └── index.ts
│
├── translation/                # Traduction
│   ├── TranslationToggle/
│   ├── LanguageSelector/
│   ├── ModelSelector/
│   ├── TranslationStats/
│   └── index.ts
│
├── settings/                   # Paramètres
│   ├── LanguageSettings/
│   ├── NotificationSettings/
│   ├── PrivacySettings/
│   ├── ThemeSettings/
│   └── index.ts
│
├── notifications/              # Notifications
│   ├── NotificationCenter/
│   ├── NotificationItem/
│   ├── NotificationSettings/
│   └── index.ts
│
└── ui/                        # Composants UI de base (shadcn/ui)
    ├── button.tsx
    ├── card.tsx
    ├── dialog.tsx
    └── ...
```

## Avantages
✅ Organisation claire par domaine métier
✅ Composants réutilisables
✅ Facilite la maintenance
✅ Améliore l'import et l'export
✅ Tests plus faciles à organiser
