'use client';

import { Suspense } from 'react';
import { AuthGuard } from '@/components/auth/auth-guard';
import { ConversationLayout } from '@/components/conversations/ConversationLayout';
import { useTranslations } from '@/hooks/useTranslations';
import { useParams } from 'next/navigation';

function ConversationsPageFallback() {
  const { t } = useTranslations('conversations');
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">{t('loading')}</p>
      </div>
    </div>
  );
}

function ConversationPageContent() {
  const params = useParams();
  const conversationId = Array.isArray(params.id) ? params.id[0] : params.id;

  console.log('[ConversationPage] Params depuis useParams:', { params, conversationId });

  return <ConversationLayout selectedConversationId={conversationId} />;
}

export default function ConversationPage() {
  return (
    <AuthGuard requireAuth={true} allowAnonymous={false}>
      <Suspense fallback={<ConversationsPageFallback />}>
        <ConversationPageContent />
      </Suspense>
    </AuthGuard>
  );
}
