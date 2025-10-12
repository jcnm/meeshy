#!/bin/bash

# Script pour migrer useTranslations → useI18n
# Date: 11 octobre 2025

cd /Users/smpceo/Documents/Services/Meeshy/meeshy/frontend

echo "🔄 Migration useTranslations → useI18n"
echo "======================================"
echo ""

# Fichiers à modifier
files=(
  "components/auth/login-form.tsx"
  "components/auth/join-conversation-form.tsx"
  "components/auth/register-form.tsx"
  "components/conversations/ConversationLayoutResponsive.tsx"
  "components/affiliate/share-affiliate-modal.tsx"
  "components/conversations/CreateConversationPage.tsx"
  "components/conversations/conversation-details-sidebar.tsx"
  "components/conversations/typing-indicator.tsx"
  "components/conversations/link-summary-modal.tsx"
  "components/conversations/link-copy-modal.tsx"
  "components/affiliate/share-affiliate-button.tsx"
  "components/conversations/conversation-participants-popover.tsx"
  "components/conversations/conversation-participants.tsx"
  "components/conversations/invite-user-modal.tsx"
  "components/common/bubble-stream-page.tsx"
  "components/common/bubble-message.tsx"
  "components/common/user-selector.tsx"
  "components/common/message-composer.tsx"
  "components/conversations/create-conversation-modal.tsx"
  "components/conversations/ConversationLayoutV2.tsx"
  "components/links/link-edit-modal.tsx"
  "components/groups/groups-layout.tsx"
  "components/conversations/create-link-modal.tsx"
  "components/layout/Header.tsx"
  "components/links/link-details-modal.tsx"
  "components/groups/groups-layout-responsive.tsx"
  "components/layout/Navigation.tsx"
  "components/layout/DashboardLayout.tsx"
  "components/layout/AppHeader.tsx"
  "components/chat/anonymous-chat.tsx"
  "components/chat/anonymous-chat-error-handler.tsx"
  "components/settings/complete-user-settings.tsx"
  "components/settings/theme-settings.tsx"
  "components/translation/language-settings.tsx"
  "components/settings/settings-layout.tsx"
  "components/settings/user-settings.tsx"
  "app/privacy/page.tsx"
  "app/about/page.tsx"
  "app/login/page.tsx"
  "app/notifications/page.tsx"
  "app/page.tsx"
  "app/join/[linkId]/page.tsx"
  "app/partners/page.tsx"
  "app/groups/page.tsx"
  "app/groups/[identifier]/page.tsx"
  "app/links/page.tsx"
  "app/conversations/[[...id]]/page.tsx"
  "app/signin/page.tsx"
  "app/dashboard/page.tsx"
  "app/terms/page.tsx"
  "app/contact/page.tsx"
  "app/settings/page.tsx"
  "app/chat/[conversationShareLinkId]/page.tsx"
  "app/contacts/page.tsx"
)

count=0
total=${#files[@]}

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    # Remplacer import { useTranslations } from '@/hooks/useTranslations';
    # par import { useI18n } from '@/hooks/useI18n';
    sed -i '' "s/import { useTranslations } from '@\/hooks\/useTranslations';/import { useI18n } from '@\/hooks\/useI18n';/g" "$file"
    
    # Remplacer const { ... } = useTranslations(...)
    # par const { ... } = useI18n(...)
    sed -i '' "s/= useTranslations(/= useI18n(/g" "$file"
    
    count=$((count + 1))
    echo "✅ [$count/$total] $file"
  else
    echo "⚠️  Fichier non trouvé: $file"
  fi
done

echo ""
echo "======================================"
echo "✅ Migration terminée: $count/$total fichiers modifiés"
echo ""
echo "📋 Prochaines étapes:"
echo "  1. Vérifier la compilation TypeScript"
echo "  2. Réactiver useMessageTranslation dans 2 fichiers"
echo "  3. Tester l'application"
