'use client';

import { ProtectedRoute } from '@/components/auth';
import { ConversationLayoutResponsive } from '@/components/conversations/ConversationLayoutResponsive';

export default function ConversationsPage() {
  return (
    <ProtectedRoute>
      <ConversationLayoutResponsive />
    </ProtectedRoute>
  );
}
