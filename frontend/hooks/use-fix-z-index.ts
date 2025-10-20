'use client';

import { useEffect } from 'react';
import { Z_INDEX } from '@/lib/z-index';

/**
 * Hook pour forcer les bons z-index sur les composants Radix UI
 * Solution définitive avec MutationObserver global
 */
export function useFixRadixZIndex() {
  useEffect(() => {
    // Fonction complète pour appliquer les z-index corrects et garantir le portail
    const fixZIndex = () => {
      // 1. Popovers - Z-index maximum avec forçage du portail
      const popoverWrappers = document.querySelectorAll('[data-radix-popper-content-wrapper]');
      popoverWrappers.forEach((element) => {
        const el = element as HTMLElement;
        el.style.setProperty('z-index', '99999', 'important');
        el.style.setProperty('position', 'fixed', 'important');
        // Force portal to body for BubbleStream
        if (!el.closest('body')) {
          document.body.appendChild(el);
        }
      });

      const popoverContents = document.querySelectorAll('[data-radix-popover-content]');
      popoverContents.forEach((element) => {
        const el = element as HTMLElement;
        el.style.setProperty('z-index', '99999', 'important');
        el.style.setProperty('position', 'fixed', 'important');
        el.style.setProperty('overflow', 'visible', 'important');
        el.classList.add('radix-popover-fixed');
        // Force visibility above mobile containers
        el.style.setProperty('pointer-events', 'auto', 'important');
      });

      // 2. Dropdown Menus
      const dropdownContents = document.querySelectorAll('[data-radix-dropdown-menu-content]');
      dropdownContents.forEach((element) => {
        const el = element as HTMLElement;
        el.style.setProperty('z-index', '99998', 'important');
        el.style.setProperty('position', 'fixed', 'important');
        el.style.setProperty('overflow', 'visible', 'important');
        el.style.setProperty('pointer-events', 'auto', 'important');
      });

      // 3. Tooltips
      const tooltipContents = document.querySelectorAll('[data-radix-tooltip-content]');
      tooltipContents.forEach((element) => {
        const el = element as HTMLElement;
        el.style.setProperty('z-index', '99997', 'important');
        el.style.setProperty('position', 'fixed', 'important');
        el.style.setProperty('overflow', 'visible', 'important');
        el.style.setProperty('pointer-events', 'auto', 'important');
      });

      // 4. Dialogs/Modals
      const dialogOverlays = document.querySelectorAll('[data-radix-dialog-overlay]');
      dialogOverlays.forEach((element) => {
        const el = element as HTMLElement;
        el.style.setProperty('z-index', '9996', 'important');
      });

      const dialogContents = document.querySelectorAll('[data-radix-dialog-content]');
      dialogContents.forEach((element) => {
        const el = element as HTMLElement;
        el.style.setProperty('z-index', '9997', 'important');
      });

      // 5. Portails Radix - Forcer au niveau racine
      const portals = document.querySelectorAll('[data-radix-portal]');
      portals.forEach((element) => {
        const el = element as HTMLElement;
        el.style.setProperty('z-index', '99999', 'important');
      });

      if (popoverContents.length > 0 || dropdownContents.length > 0 || tooltipContents.length > 0) {
        console.log('🎯 Z-Index appliqués:', {
          popovers: popoverContents.length,
          dropdowns: dropdownContents.length,
          tooltips: tooltipContents.length,
          portals: portals.length
        });
      }
    };

    // Appliquer immédiatement
    fixZIndex();

    // Observer les changements dans le DOM de manière agressive
    const observer = new MutationObserver(() => {
      // Utiliser requestAnimationFrame pour optimiser les performances
      requestAnimationFrame(fixZIndex);
    });

    // Observer tout le document
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-state', 'data-radix-popover-content']
    });

    // Ré-appliquer périodiquement au cas où (fallback)
    const interval = setInterval(fixZIndex, 1000);

    return () => {
      observer.disconnect();
      clearInterval(interval);
    };
  }, []);
}

/**
 * Hook spécialisé pour les popovers de traduction
 */
export function useFixTranslationPopoverZIndex() {
  useEffect(() => {
    const fixTranslationPopovers = () => {
      // Cibler spécifiquement les popovers de traduction
      const translationPopovers = document.querySelectorAll('.bubble-message [data-radix-popover-content]');
      
      translationPopovers.forEach((element) => {
        const htmlElement = element as HTMLElement;
        htmlElement.style.zIndex = Z_INDEX.MAX.toString();
        htmlElement.style.position = 'fixed'; // S'assurer que le positionnement est correct
        
        // Ajouter une classe pour identification
        htmlElement.classList.add('translation-popover');
      });

      // Aussi forcer les wrappers
      const translationWrappers = document.querySelectorAll('.bubble-message [data-radix-popper-content-wrapper]');
      translationWrappers.forEach((element) => {
        (element as HTMLElement).style.zIndex = Z_INDEX.MAX.toString();
      });
    };

    // Fixer immédiatement
    fixTranslationPopovers();

    // Observer spécifiquement les changements dans les messages
    const observer = new MutationObserver(() => {
      setTimeout(fixTranslationPopovers, 10);
    });

    // Observer les containers de messages
    const messageContainers = document.querySelectorAll('.bubble-message');
    messageContainers.forEach(container => {
      observer.observe(container, {
        childList: true,
        subtree: true
      });
    });

    return () => {
      observer.disconnect();
    };
  }, []);
}
