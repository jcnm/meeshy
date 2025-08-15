import { AuthGuard } from '@/components/auth';
import { ConversationLayoutWrapper } from '../../components/conversations/ConversationLayoutWrapper';

// Désactiver le prerendering pour éviter les problèmes avec Sharp
export const dynamic = 'force-dynamic';

export default function ConversationsPage() {
  return (
    <AuthGuard>
      <ConversationLayoutWrapper />
    </AuthGuard>
  );
}
