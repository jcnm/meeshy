import { ProtectedRoute } from '../../components/auth/ProtectedRoute';
import { ConversationLayoutResponsive } from '../../components/conversations/ConversationLayoutResponsive';

// Désactiver le prerendering pour éviter les problèmes avec Sharp
export const dynamic = 'force-dynamic';

export default function ConversationsPage() {
  return (
    <ProtectedRoute>
      <ConversationLayoutResponsive />
    </ProtectedRoute>
  );
}
