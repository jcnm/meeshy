'use client';

import { useParams } from 'next/navigation';
import { ProtectedRoute } from '@/components/auth';
import { ConversationLayoutResponsive } from '@/components/conversations/ConversationLayoutResponsive';

export default function ConversationPage() {
  const params = useParams();
  const conversationId = params.id as string;

  return (
    <ProtectedRoute>
      <ConversationLayoutResponsive selectedConversationId={conversationId} />
    </ProtectedRoute>
  );
}
