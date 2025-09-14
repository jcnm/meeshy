'use client';

import { ConversationProvider } from '@/context/ConversationContext';
import { ConversationLayoutResponsiveRefactored } from '@/components/conversations/ConversationLayoutResponsiveRefactored';

export default function ConversationsPageRefactored() {
  return (
    <ConversationProvider>
      <ConversationLayoutResponsiveRefactored />
    </ConversationProvider>
  );
}
