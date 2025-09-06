/**
 * Composant de démonstration pour tester les toasts traduits
 * Ce composant peut être utilisé pour tester que les toasts s'affichent dans la bonne langue
 */

'use client';

import { Button } from '@/components/ui/button';
import { useTranslatedToast } from '@/hooks/use-translated-toast';

export function ToastDemo() {
  const {
    toastSuccess,
    toastError,
    toastWarning,
    toastInfo,
    toastSuccessWithVars,
  } = useTranslatedToast();

  const testConnectionToasts = () => {
    toastSuccess('toasts.connection.established');
    setTimeout(() => toastError('toasts.connection.disconnected'), 1000);
    setTimeout(() => toastWarning('toasts.connection.lost'), 2000);
    setTimeout(() => toastInfo('toasts.connection.reconnecting'), 3000);
  };

  const testMessageToasts = () => {
    toastSuccess('toasts.messages.sent');
    setTimeout(() => toastError('toasts.messages.sendError'), 1000);
    setTimeout(() => toastInfo('toasts.messages.editSoon'), 2000);
    setTimeout(() => toastSuccessWithVars('toasts.messages.translationSuccess', { model: 'GPT-4' }), 3000);
  };

  const testAuthToasts = () => {
    toastSuccess('toasts.auth.logoutSuccess');
    setTimeout(() => toastError('toasts.auth.fillAllFields'), 1000);
    setTimeout(() => toastError('toasts.auth.connectionError'), 2000);
  };

  return (
    <div className="p-6 space-y-4">
      <h2 className="text-2xl font-bold">Toast Translation Demo</h2>
      <p className="text-muted-foreground">
        Testez les toasts traduits dans différentes langues
      </p>
      
      <div className="space-x-2">
        <Button onClick={testConnectionToasts}>
          Test Connection Toasts
        </Button>
        <Button onClick={testMessageToasts}>
          Test Message Toasts
        </Button>
        <Button onClick={testAuthToasts}>
          Test Auth Toasts
        </Button>
      </div>
    </div>
  );
}
