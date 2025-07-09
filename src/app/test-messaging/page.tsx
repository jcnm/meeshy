/**
 * Page de test pour vérifier l'architecture messaging unifiée
 */

import { MessagingDebugger } from '@/components/debug/messaging-debugger';

export default function MessagingTestPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <MessagingDebugger />
    </div>
  );
}
