'use client';

import { ProtectedRoute } from '@/components/auth';
import { ConversationLayout } from '@/components/conversations';

export default function ConversationsPage() {
  return (
    <ProtectedRoute>
      <ConversationLayout />
    </ProtectedRoute>
  );
}
