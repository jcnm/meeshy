'use client';

import { useEffect } from 'react';
import { Z_INDEX } from '@/lib/z-index';

/**
 * Hook pour forcer les bons z-index sur les composants Radix UI
 * Utile pour corriger les problèmes de superposition
 */
export function useFixRadixZIndex() {
  useEffect(() => {
    // Fonction pour appliquer les z-index corrects
    const fixZIndex = () => {
      // Popovers
      const popoverWrappers = document.querySelectorAll('[data-radix-popper-content-wrapper]');
      popoverWrappers.forEach((element) => {
        (element as HTMLElement).style.zIndex = Z_INDEX.POPOVER.toString();
      });

      const popoverContents = document.querySelectorAll('[data-radix-popover-content]');
      popoverContents.forEach((element) => {
        (element as HTMLElement).style.zIndex = Z_INDEX.POPOVER.toString();
      });

      // Dropdown Menus
      const dropdownContents = document.querySelectorAll('[data-radix-dropdown-menu-content]');
      dropdownContents.forEach((element) => {
        (element as HTMLElement).style.zIndex = Z_INDEX.DROPDOWN_MENU.toString();
      });

      // Tooltips
      const tooltipContents = document.querySelectorAll('[data-radix-tooltip-content]');
      tooltipContents.forEach((element) => {
        (element as HTMLElement).style.zIndex = Z_INDEX.TOOLTIP.toString();
      });

      console.log('🎯 Z-Index fixés:', {
        popovers: popoverContents.length,
        dropdowns: dropdownContents.length,
        tooltips: tooltipContents.length
      });
    };

    // Appliquer immédiatement
    fixZIndex();

    // Observer les changements dans le DOM pour les nouveaux éléments
    const observer = new MutationObserver((mutations) => {
      let shouldFix = false;
      
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element;
            if (
              element.hasAttribute('data-radix-popper-content-wrapper') ||
              element.hasAttribute('data-radix-popover-content') ||
              element.hasAttribute('data-radix-dropdown-menu-content') ||
              element.hasAttribute('data-radix-tooltip-content') ||
              element.querySelector('[data-radix-popper-content-wrapper]') ||
              element.querySelector('[data-radix-popover-content]') ||
              element.querySelector('[data-radix-dropdown-menu-content]') ||
              element.querySelector('[data-radix-tooltip-content]')
            ) {
              shouldFix = true;
            }
          }
        });
      });

      if (shouldFix) {
        // Petit délai pour laisser les composants se monter
        setTimeout(fixZIndex, 10);
      }
    });

    // Observer tout le document
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    return () => {
      observer.disconnect();
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
        htmlElement.style.zIndex = Z_INDEX.TRANSLATION_POPOVER.toString();
        htmlElement.style.position = 'fixed'; // S'assurer que le positionnement est correct
        
        // Ajouter une classe pour identification
        htmlElement.classList.add('translation-popover');
      });

      console.log(`🌐 ${translationPopovers.length} popovers de traduction fixés`);
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
