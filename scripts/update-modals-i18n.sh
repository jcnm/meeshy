#!/bin/bash

# Script pour mettre à jour les clés i18n des modals

echo "🔄 Mise à jour des clés i18n pour les modals..."

# create-link-modal.tsx
sed -i '' "s/t('errors\./t('createLinkModal.errors./g" frontend/components/conversations/create-link-modal.tsx
sed -i '' "s/t('successMessages\./t('createLinkModal.successMessages./g" frontend/components/conversations/create-link-modal.tsx
sed -i '' "s/t('steps\./t('createLinkModal.steps./g" frontend/components/conversations/create-link-modal.tsx
sed -i '' "s/t('stepDescriptions\./t('createLinkModal.stepDescriptions./g" frontend/components/conversations/create-link-modal.tsx
sed -i '' "s/t('createNewConversation\./t('createLinkModal.createNewConversation./g" frontend/components/conversations/create-link-modal.tsx
sed -i '' "s/t('search\./t('createLinkModal.search./g" frontend/components/conversations/create-link-modal.tsx

# link-copy-modal.tsx
sed -i '' "s/t('noExpiration')/t('createLinkButton.noExpiration')/g" frontend/components/conversations/link-copy-modal.tsx
sed -i '' "s/t('enabled')/t('createLinkButton.enabled')/g" frontend/components/conversations/link-copy-modal.tsx
sed -i '' "s/t('disabled')/t('createLinkButton.disabled')/g" frontend/components/conversations/link-copy-modal.tsx
sed -i '' "s/t('linkCreated')/t('createLinkButton.linkCreated')/g" frontend/components/conversations/link-copy-modal.tsx
sed -i '' "s/t('copyManually')/t('createLinkButton.copyManually')/g" frontend/components/conversations/link-copy-modal.tsx
sed -i '' "s/t('generatedLink')/t('createLinkButton.generatedLink')/g" frontend/components/conversations/link-copy-modal.tsx
sed -i '' "s/t('copied')/t('createLinkButton.copied')/g" frontend/components/conversations/link-copy-modal.tsx
sed -i '' "s/t('copy')/t('createLinkButton.copy')/g" frontend/components/conversations/link-copy-modal.tsx
sed -i '' "s/t('participants')/t('createLinkButton.participants')/g" frontend/components/conversations/link-copy-modal.tsx
sed -i '' "s/t('uses')/t('createLinkButton.uses')/g" frontend/components/conversations/link-copy-modal.tsx
sed -i '' "s/t('unlimited')/t('createLinkButton.unlimited')/g" frontend/components/conversations/link-copy-modal.tsx
sed -i '' "s/t('permissions')/t('createLinkButton.permissions')/g" frontend/components/conversations/link-copy-modal.tsx
sed -i '' "s/t('messages')/t('createLinkButton.messages')/g" frontend/components/conversations/link-copy-modal.tsx
sed -i '' "s/t('files')/t('createLinkButton.files')/g" frontend/components/conversations/link-copy-modal.tsx

# link-summary-modal.tsx
sed -i '' "s/t('/t('linkSummaryModal./g" frontend/components/conversations/link-summary-modal.tsx

# create-conversation-modal.tsx
sed -i '' "s/t('/t('createConversationModal./g" frontend/components/conversations/create-conversation-modal.tsx

# invite-user-modal.tsx - déjà 'conversations' donc pas besoin de préfixe

echo "✅ Mise à jour des clés i18n des modals terminée"

