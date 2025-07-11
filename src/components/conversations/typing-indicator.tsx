'use client';

import { useEffect, useState } from 'react';
import { useTypingIndicator } from '@/hooks/use-typing-indicator';
import { User } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';

interface TypingIndicatorProps {
  chatId: string;
  currentUserId?: string;
  users?: User[];
  className?: string;
}

export function TypingIndicator({ 
  chatId, 
  currentUserId, 
  users = [], 
  className = "" 
}: TypingIndicatorProps) {
  const { typingUsers } = useTypingIndicator(chatId, currentUserId || '');
  const [dots, setDots] = useState('');

  // Animation des points
  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => {
        if (prev === '...') return '';
        return prev + '.';
      });
    }, 500);

    return () => clearInterval(interval);
  }, []);

  // Filtrer les utilisateurs qui tapent dans ce chat (exclure l'utilisateur actuel)
  const usersTypingInChat = typingUsers.filter(typingUser => 
    typingUser.conversationId === chatId && 
    typingUser.userId !== currentUserId
  );

  if (usersTypingInChat.length === 0) {
    return null;
  }

  // Obtenir les noms des utilisateurs qui tapent
  const typingUserNames = usersTypingInChat.map(typingUser => {
    const user = users.find(u => u.id === typingUser.userId);
    return user?.username || typingUser.userId;
  });

  const renderTypingMessage = () => {
    if (typingUserNames.length === 1) {
      return `${typingUserNames[0]} est en train d'écrire${dots}`;
    } else if (typingUserNames.length === 2) {
      return `${typingUserNames[0]} et ${typingUserNames[1]} sont en train d'écrire${dots}`;
    } else {
      return `${typingUserNames.length} personnes sont en train d'écrire${dots}`;
    }
  };

  return (
    <div className={`flex items-center gap-2 text-sm text-muted-foreground ${className}`}>
      <div className="flex items-center gap-1">
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>{renderTypingMessage()}</span>
      </div>
    </div>
  );
}

// Composant plus simple pour afficher juste un badge
export function TypingBadge({ 
  userId, 
  chatId, 
  className = "" 
}: { 
  userId: string; 
  chatId: string; 
  className?: string; 
}) {
  const { typingUsers } = useTypingIndicator(chatId, userId);

  const isUserTyping = typingUsers.some(user => user.userId === userId && user.conversationId === chatId);

  if (!isUserTyping) {
    return null;
  }

  return (
    <Badge variant="secondary" className={`gap-1 ${className}`}>
      <Loader2 className="h-3 w-3 animate-spin" />
      Écrit...
    </Badge>
  );
}
