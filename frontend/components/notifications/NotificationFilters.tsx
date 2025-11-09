'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export type NotificationType = 'all' | 'new_message' | 'missed_call' | 'system' | 'conversation';

interface NotificationFiltersProps {
  selectedType: NotificationType;
  onTypeChange: (type: NotificationType) => void;
  counts?: {
    all: number;
    new_message: number;
    missed_call: number;
    system: number;
    conversation: number;
  };
}

export function NotificationFilters({ selectedType, onTypeChange, counts }: NotificationFiltersProps) {
  const filters: { label: string; value: NotificationType; icon: string }[] = [
    { label: 'Toutes', value: 'all', icon: '📬' },
    { label: 'Messages', value: 'new_message', icon: '💬' },
    { label: 'Appels manqués', value: 'missed_call', icon: '📞' },
    { label: 'Système', value: 'system', icon: '⚙️' },
    { label: 'Conversations', value: 'conversation', icon: '👥' },
  ];

  return (
    <div className="flex flex-wrap gap-2 mb-6">
      {filters.map((filter) => (
        <Button
          key={filter.value}
          variant={selectedType === filter.value ? 'default' : 'outline'}
          size="sm"
          onClick={() => onTypeChange(filter.value)}
          className="flex items-center space-x-2"
        >
          <span>{filter.icon}</span>
          <span>{filter.label}</span>
          {counts && counts[filter.value] > 0 && (
            <Badge variant="secondary" className="ml-1">
              {counts[filter.value]}
            </Badge>
          )}
        </Button>
      ))}
    </div>
  );
}
