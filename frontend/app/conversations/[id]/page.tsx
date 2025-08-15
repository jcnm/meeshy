'use client';

import { useParams } from 'next/navigation';
import { AuthGuard } from '@/components/auth';
import { ConversationLayoutResponsive } from '@/components/conversations/ConversationLayoutResponsive';

export default function ConversationPage() {
  const params = useParams();
  const conversationId = params.id as string;

  return (
    <AuthGuard>
      <ConversationLayoutResponsive selectedConversationId={conversationId} />
    </AuthGuard>
  );
}
