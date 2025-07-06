'use client';

import { ProtectedRoute } from '@/components/auth';
import { ConversationLayout } from '@/components/conversations/ConversationLayoutSimple';

export default function ConversationsPage() {
  return (
    <ProtectedRoute>
      <ConversationLayout />
    </ProtectedRoute>
  );
}
