'use client';

import { Suspense } from 'react';
import { SearchPageContent } from './SearchPageContent';

// Désactiver le pré-rendu statique pour cette page client
export const dynamic = 'force-dynamic';

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen">Chargement...</div>}>
      <SearchPageContent />
    </Suspense>
  );
}
