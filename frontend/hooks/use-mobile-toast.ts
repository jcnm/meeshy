/**
 * Hook personnalisé pour gérer les toasts avec désactivation mobile
 */

import { toast as sonnerToast } from 'sonner';
import { useCallback } from 'react';

// Fonction utilitaire pour détecter mobile
const isMobile = () => typeof window !== 'undefined' && window.innerWidth <= 768;

interface ToastOptions {
  description?: string;
  duration?: number;
  icon?: React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export const useMobileToast = () => {
  const toast = useCallback((message: string, options?: ToastOptions) => {
    // Désactiver les toasts sur mobile
    if (isMobile()) {
      return;
    }
    
    return sonnerToast(message, options);
  }, []);

  const success = useCallback((message: string, options?: ToastOptions) => {
    if (isMobile()) {
      return;
    }
    
    return sonnerToast.success(message, options);
  }, []);

  const error = useCallback((message: string, options?: ToastOptions) => {
    if (isMobile()) {
      return;
    }
    
    return sonnerToast.error(message, options);
  }, []);

  const warning = useCallback((message: string, options?: ToastOptions) => {
    if (isMobile()) {
      return;
    }
    
    return sonnerToast.warning(message, options);
  }, []);

  const info = useCallback((message: string, options?: ToastOptions) => {
    if (isMobile()) {
      return;
    }
    
    return sonnerToast.info(message, options);
  }, []);

  const loading = useCallback((message: string, options?: ToastOptions) => {
    if (isMobile()) {
      return;
    }
    
    return sonnerToast.loading(message, options);
  }, []);

  const promise = useCallback((promise: Promise<any>, options: {
    loading: string;
    success: string | ((data: any) => string);
    error: string | ((error: any) => string);
  }) => {
    if (isMobile()) {
      return promise; // Retourner la promesse sans toast sur mobile
    }
    
    return sonnerToast.promise(promise, options);
  }, []);

  const dismiss = useCallback((toastId?: string | number) => {
    return sonnerToast.dismiss(toastId);
  }, []);

  return {
    toast,
    success,
    error,
    warning,
    info,
    loading,
    promise,
    dismiss,
    isMobile: isMobile()
  };
};
