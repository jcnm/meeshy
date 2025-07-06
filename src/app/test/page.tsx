'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { TranslationTest } from '@/components/translation/translation-test';
import { ModelManagerModal } from '@/components/models/model-manager-modal';
import { Settings } from 'lucide-react';

export default function TestPage() {
  const [modelModalOpen, setModelModalOpen] = useState(false);

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-center flex-1">
          Meeshy - Test de Traduction
        </h1>
        
        <ModelManagerModal open={modelModalOpen} onOpenChange={setModelModalOpen}>
          <Button variant="outline" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Gérer les Modèles
          </Button>
        </ModelManagerModal>
      </div>
      
      <TranslationTest />
    </div>
  );
}
