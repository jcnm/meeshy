'use client';

import { AuthGuard } from '@/components/auth';
import { ConversationLayoutWrapper } from '../../components/conversations/ConversationLayoutWrapper';
import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, Suspense } from 'react';

// Désactiver le prerendering pour éviter les problèmes avec Sharp
export const dynamic = 'force-dynamic';

function ConversationsPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const newParam = searchParams.get('new');

  useEffect(() => {
    // Si le paramètre new=true est présent, rediriger vers la page de création
    if (newParam === 'true') {
      router.replace('/conversations/new');
    }
  }, [newParam, router]);

  // Si on a le paramètre new, ne rien afficher pendant la redirection
  if (newParam === 'true') {
    return null;
  }

  return (
    <AuthGuard>
      <ConversationLayoutWrapper />
    </AuthGuard>
  );
}

export default function ConversationsPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ConversationsPageContent />
    </Suspense>
  );
}
