/**
 * Hook personnalisé pour les  // Méthodes avec interpolation de variables
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
 * Utilise notre système de traduction personnalisé pour afficher les messages de toast dans la langue de l'utilisateur
 */

'use client';

import { useTranslations } from './useTranslations';
import { toast } from 'sonner';

export function useTranslatedToast() {
  const { t } = useTranslations('common'); // Utiliser le namespace 'common' de nos traductions

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

  // Méthodes avec interpolation de variables (simplifiées)
  const toastSuccessWithVars = (key: string, vars: Record<string, any>, options?: any) => {
    toast.success(t(key), options);
  };

  const toastErrorWithVars = (key: string, vars: Record<string, any>, options?: any) => {
    toast.error(t(key), options);
  };

  const toastWarningWithVars = (key: string, vars: Record<string, any>, options?: any) => {
    toast.warning(t(key), options);
  };

  const toastInfoWithVars = (key: string, vars: Record<string, any>, options?: any) => {
    toast.info(t(key), options);
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
