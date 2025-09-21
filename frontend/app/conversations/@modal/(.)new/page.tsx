'use client';

import { useRouter } from 'next/navigation';
import { useUser } from '@/context/UnifiedProvider';
import { CreateConversationModal } from '@/components/conversations/create-conversation-modal';
import { toast } from 'sonner';

export default function NewConversationModal() {
  const { user } = useUser();
  const router = useRouter();

  const handleConversationCreated = (conversationId: string) => {
    console.log('Conversation créée avec succès');
    router.push(`/conversations/${conversationId}`);
  };

  const handleClose = () => {
    router.back(); // Retourne à la page précédente (/conversations)
  };

  if (!user) {
    return null;
  }

  return (
    <CreateConversationModal
      isOpen={true}
      onClose={handleClose}
      currentUser={user}
      onConversationCreated={handleConversationCreated}
    />
  );
}
