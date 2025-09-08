'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Link2, Plus } from 'lucide-react';
import { CreateLinkModalV2 } from './create-link-modal-v2';
import { toast } from 'sonner';

interface CreateLinkButtonV2Props {
  onLinkCreated?: () => void;
  variant?: 'default' | 'outline' | 'ghost' | 'secondary' | 'destructive';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
  children?: React.ReactNode;
}

export function CreateLinkButtonV2({
  onLinkCreated,
  variant = 'default',
  size = 'default',
  className,
  children
}: CreateLinkButtonV2Props) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleLinkCreated = () => {
    setIsModalOpen(false);
    console.log('Lien de partage créé avec succès !');
    onLinkCreated?.();
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={() => setIsModalOpen(true)}
        className={className}
      >
        {children || (
          <>
            <Link2 className="h-4 w-4 mr-2" />
            Créer un lien
          </>
        )}
      </Button>

      <CreateLinkModalV2
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onLinkCreated={handleLinkCreated}
      />
    </>
  );
}
