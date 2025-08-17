'use client';

import { AuthGuard } from '@/components/auth';
import { ReactNode } from 'react';

interface ConversationsLayoutProps {
  children: ReactNode;
  modal: ReactNode;
}

export default function ConversationsLayout({ 
  children, 
  modal 
}: ConversationsLayoutProps) {
  return (
    <AuthGuard>
      {children}
      {modal}
    </AuthGuard>
  );
}
