'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ModelManager } from '@/components/model-manager';
import { TranslationTest } from '@/components/translation-test';

export default function TestPage() {
  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <h1 className="text-3xl font-bold mb-6 text-center">
        Meeshy - Tests du Système de Traduction
      </h1>
      
      <Tabs defaultValue="translation" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="translation">Test de Traduction</TabsTrigger>
          <TabsTrigger value="models">Gestion des Modèles</TabsTrigger>
        </TabsList>
        
        <TabsContent value="translation" className="mt-6">
          <TranslationTest />
        </TabsContent>
        
        <TabsContent value="models" className="mt-6">
          <ModelManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}
