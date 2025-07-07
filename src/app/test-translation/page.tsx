/**
 * Page de test pour la traduction Hugging Face
 */

import { HuggingFaceTranslationTest } from '@/components/models/huggingface-translation-test';

export default function TestTranslationPage() {
  return (
    <div className="min-h-screen bg-background">
      <HuggingFaceTranslationTest />
    </div>
  );
}
