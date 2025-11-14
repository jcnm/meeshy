'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface PrivacyModeStore {
  isPrivacyMode: boolean;
  togglePrivacyMode: () => void;
  setPrivacyMode: (enabled: boolean) => void;
}

/**
 * Hook pour gérer le mode de confidentialité dans l'admin
 * Active par défaut pour masquer les données sensibles dans les screenshots
 */
export const usePrivacyMode = create<PrivacyModeStore>()(
  persist(
    (set) => ({
      isPrivacyMode: true, // Activé par défaut pour la sécurité
      togglePrivacyMode: () => set((state) => ({ isPrivacyMode: !state.isPrivacyMode })),
      setPrivacyMode: (enabled: boolean) => set({ isPrivacyMode: enabled }),
    }),
    {
      name: 'admin-privacy-mode',
    }
  )
);
