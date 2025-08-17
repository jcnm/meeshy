'use client';

import { ConversationLayoutWrapper } from '../../components/conversations/ConversationLayoutWrapper';
import { Suspense } from 'react';

// Désactiver le prerendering pour éviter les problèmes avec Sharp
export const dynamic = 'force-dynamic';

function ConversationsPageContent() {
  return <ConversationLayoutWrapper />;
}

export default function ConversationsPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ConversationsPageContent />
    </Suspense>
  );
}
