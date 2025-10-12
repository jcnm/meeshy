#!/bin/bash

# Script pour mettre à jour les clés i18n des composants common

echo "🔄 Mise à jour des clés i18n pour les composants common..."

# bubble-stream-page.tsx - utilise bubbleStream
sed -i '' "s/t('websocketConnected')/t('bubbleStream.websocketConnected')/g" frontend/components/common/bubble-stream-page.tsx
sed -i '' "s/t('connected')/t('bubbleStream.connected')/g" frontend/components/common/bubble-stream-page.tsx
sed -i '' "s/t('websocketEstablished')/t('bubbleStream.websocketEstablished')/g" frontend/components/common/bubble-stream-page.tsx
sed -i '' "s/t('loading')/t('bubbleStream.loading')/g" frontend/components/common/bubble-stream-page.tsx
sed -i '' "s/t('connecting')/t('bubbleStream.connecting')/g" frontend/components/common/bubble-stream-page.tsx
sed -i '' "s/t('initializing')/t('bubbleStream.initializing')/g" frontend/components/common/bubble-stream-page.tsx
sed -i '' "s/t('typing\.single'/t('bubbleStream.typing.single'/g" frontend/components/common/bubble-stream-page.tsx
sed -i '' "s/t('typing\.double'/t('bubbleStream.typing.double'/g" frontend/components/common/bubble-stream-page.tsx
sed -i '' "s/t('typing\.multiple'/t('bubbleStream.typing.multiple'/g" frontend/components/common/bubble-stream-page.tsx
sed -i '' "s/t('realTimeMessages')/t('bubbleStream.realTimeMessages')/g" frontend/components/common/bubble-stream-page.tsx
sed -i '' "s/t('connectionInProgress')/t('bubbleStream.connectionInProgress')/g" frontend/components/common/bubble-stream-page.tsx
sed -i '' "s/t('reconnecting')/t('bubbleStream.reconnecting')/g" frontend/components/common/bubble-stream-page.tsx
sed -i '' "s/t('emptyStateMessage')/t('bubbleStream.emptyStateMessage')/g" frontend/components/common/bubble-stream-page.tsx
sed -i '' "s/t('emptyStateDescription')/t('bubbleStream.emptyStateDescription')/g" frontend/components/common/bubble-stream-page.tsx
sed -i '' "s/t('activeLanguages')/t('bubbleStream.activeLanguages')/g" frontend/components/common/bubble-stream-page.tsx

# message-composer.tsx - utilise conversationSearch
sed -i '' "s/t('shareMessage')/t('conversationSearch.shareMessage')/g" frontend/components/common/message-composer.tsx

# user-selector.tsx - utilise conversationUI
sed -i '' "s/t('autoTranslation')/t('conversationUI.autoTranslation')/g" frontend/components/common/user-selector.tsx
sed -i '' "s/t('enabled')/t('conversationUI.enabled')/g" frontend/components/common/user-selector.tsx
sed -i '' "s/t('disabled')/t('conversationUI.disabled')/g" frontend/components/common/user-selector.tsx

echo "✅ Mise à jour des clés i18n des composants common terminée"

