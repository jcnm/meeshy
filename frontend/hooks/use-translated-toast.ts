/**
 * Hook personnalisé pour les toasts traduits
 * Utilise le système de traduction i18n pour afficher les messages de toast dans la langue de l'utilisateur
 */

'use client';

import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

export function useTranslatedToast() {
  const t = useTranslations();

  const toastSuccess = (key: string, options?: any) => {
    toast.success(t(key), options);
  };

  const toastError = (key: string, options?: any) => {
    toast.error(t(key), options);
  };

  const toastWarning = (key: string, options?: any) => {
    toast.warning(t(key), options);
  };

  const toastInfo = (key: string, options?: any) => {
    toast.info(t(key), options);
  };

  const toastLoading = (key: string, options?: any) => {
    toast.loading(t(key), options);
  };

  // Méthodes avec interpolation de variables
  const toastSuccessWithVars = (key: string, vars: Record<string, any>, options?: any) => {
    toast.success(t(key, vars), options);
  };

  const toastErrorWithVars = (key: string, vars: Record<string, any>, options?: any) => {
    toast.error(t(key, vars), options);
  };

  const toastWarningWithVars = (key: string, vars: Record<string, any>, options?: any) => {
    toast.warning(t(key, vars), options);
  };

  const toastInfoWithVars = (key: string, vars: Record<string, any>, options?: any) => {
    toast.info(t(key, vars), options);
  };

  return {
    toastSuccess,
    toastError,
    toastWarning,
    toastInfo,
    toastLoading,
    toastSuccessWithVars,
    toastErrorWithVars,
    toastWarningWithVars,
    toastInfoWithVars,
  };
}
