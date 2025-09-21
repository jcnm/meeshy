'use client';

import React from 'react';
import { useUser } from '@/context/UnifiedProvider';
import { ConversationLayoutResponsive } from './ConversationLayoutResponsive';

interface ConversationLayoutWrapperProps {
  selectedConversationId?: string;
}

const ConversationLayoutWrapper: React.FC<ConversationLayoutWrapperProps> = ({ 
  selectedConversationId 
}) => {
  const { user, isAuthChecking } = useUser();

  if (isAuthChecking) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Authentication Required</h2>
          <p className="text-gray-600">Please log in to access conversations.</p>
        </div>
      </div>
    );
  }

  return <ConversationLayoutResponsive selectedConversationId={selectedConversationId} />;
};

export default ConversationLayoutWrapper;
export { ConversationLayoutWrapper };
