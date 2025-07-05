'use client';

import { useParams } from 'next/navigation';
import { ProtectedRoute } from '@/components/auth';
import { ConversationLayout } from '@/components/conversations';

export default function ConversationPage() {
  const params = useParams();
  const conversationId = params.id as string;

  return (
    <ProtectedRoute>
      <ConversationLayout selectedConversationId={conversationId} />
    </ProtectedRoute>
  );
}
