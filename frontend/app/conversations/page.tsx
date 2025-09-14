'use client';

import ConversationLayoutWrapper from '../../components/conversations/ConversationLayoutWrapper';
import { AuthGuard } from '@/components/auth/auth-guard';
import { Suspense } from 'react';
import { useTranslations } from '@/hooks/useTranslations';

// Désactiver le prerendering pour éviter les problèmes avec Sharp

function ConversationsPageContent() {
  return (
    <AuthGuard>
      <ConversationLayoutWrapper />
    </AuthGuard>
  );
}

function ConversationsPageFallback() {
  const { t } = useTranslations('conversations');
  return <div>{t('loading')}</div>;
}

export default function ConversationsPage() {
  return (
    <Suspense fallback={<ConversationsPageFallback />}>
      <ConversationsPageContent />
    </Suspense>
  );
}
