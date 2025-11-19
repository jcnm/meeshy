'use client';

import { Button } from '@/components/ui/button';
import {
  showMessageToast,
  showMentionToast,
  showNewConversationToast,
  showSystemToast,
  showSuccessToast,
  showErrorToast,
  showInfoToast,
} from '@/utils/custom-toast';
import type { Notification } from '@/services/notification.service';

export default function TestToastsPage() {
  const handleMessageToast = () => {
    const notification: Notification = {
      id: 'test-msg-1',
      type: 'new_message',
      title: 'Nouveau message',
      message: 'Salut ! Comment ça va ? Je voulais te parler de quelque chose d\'important...',
      senderName: 'Alice Dupont',
      senderUsername: 'alice.dupont',
      senderAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alice',
      conversationId: '123',
      messageId: 'msg-123',
      messagePreview: 'Salut ! Comment ça va ? Je voulais te parler de quelque chose d\'important...',
      timestamp: new Date(),
      isRead: false,
    };
    showMessageToast(notification);
  };

  const handleMentionToast = () => {
    const notification: Notification = {
      id: 'test-mention-1',
      type: 'message',
      title: 'Mention',
      message: '@vous a mentionné dans un message: "Hey @user, regarde cette photo !"',
      senderName: 'Bob Martin',
      senderUsername: 'bob.martin',
      senderAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Bob',
      conversationId: '456',
      messageId: 'msg-456',
      messagePreview: 'Hey @user, regarde cette photo !',
      timestamp: new Date(),
      isRead: false,
    };
    showMentionToast(notification);
  };

  const handleNewConversationToast = () => {
    const notification: Notification = {
      id: 'test-conv-1',
      type: 'new_conversation',
      title: 'Nouvelle conversation',
      message: 'Charlie a démarré une conversation avec vous',
      senderName: 'Charlie Wilson',
      senderUsername: 'charlie.wilson',
      senderAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Charlie',
      conversationId: '789',
      timestamp: new Date(),
      isRead: false,
    };
    showNewConversationToast(notification);
  };

  const handleSystemToast = () => {
    const notification: Notification = {
      id: 'test-sys-1',
      type: 'system',
      title: 'Mise à jour système',
      message: 'Nouvelle fonctionnalité disponible : compression automatique des vidéos !',
      timestamp: new Date(),
      isRead: false,
    };
    showSystemToast(notification);
  };

  const handleMissedCallToast = () => {
    const notification: Notification = {
      id: 'test-call-1',
      type: 'missed_call',
      title: 'Appel manqué',
      message: 'Diana vous a appelé il y a 5 minutes',
      senderName: 'Diana Lee',
      senderUsername: 'diana.lee',
      senderAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Diana',
      conversationId: '999',
      callSessionId: 'call-999',
      timestamp: new Date(),
      isRead: false,
    };
    showSystemToast(notification);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-2 text-gray-900 dark:text-white">
          Toast Notifications Test
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          Testez les différents types de notifications toast avec avatars
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Notifications utilisateur */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
              <span className="text-2xl">👤</span>
              Notifications utilisateur
            </h2>
            <div className="space-y-3">
              <Button onClick={handleMessageToast} className="w-full" variant="default">
                Nouveau message
              </Button>
              <Button onClick={handleMentionToast} className="w-full" variant="default">
                Mention
              </Button>
              <Button onClick={handleNewConversationToast} className="w-full" variant="default">
                Nouvelle conversation
              </Button>
            </div>
          </div>

          {/* Notifications système */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
              <span className="text-2xl">🔔</span>
              Notifications système
            </h2>
            <div className="space-y-3">
              <Button onClick={handleSystemToast} className="w-full" variant="outline">
                Notification système
              </Button>
              <Button onClick={handleMissedCallToast} className="w-full" variant="outline">
                Appel manqué
              </Button>
            </div>
          </div>

          {/* Toasts fonctionnels */}
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-6 rounded-lg shadow-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
            <h2 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white flex items-center gap-2">
              <span className="text-2xl">⚡</span>
              Toasts Fonctionnels
            </h2>
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">
              Simple, épuré, court - notifications de développement
            </p>
            <div className="space-y-3">
              <Button
                onClick={() => showSuccessToast('Enregistré')}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                Succès
              </Button>
              <Button
                onClick={() => showErrorToast('Échec')}
                className="w-full bg-red-600 hover:bg-red-700"
              >
                Erreur
              </Button>
              <Button
                onClick={() => showInfoToast('Chargement...')}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                Info
              </Button>
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-6 rounded-lg border-2 border-blue-200 dark:border-blue-800">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
              <span className="text-2xl">💡</span>
              Instructions
            </h2>
            <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
              <li className="flex items-start gap-2">
                <span className="text-blue-500 mt-0.5">▸</span>
                <span><strong>Position :</strong> Top (mobile) | Top-right (desktop)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-0.5">▸</span>
                <span><strong>Notifications Métier :</strong> Riches avec avatars, bordure colorée, cliquables</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-orange-500 mt-0.5">▸</span>
                <span><strong>Toasts Fonctionnels :</strong> Simples, épurés, courts (3s), fond coloré</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-500 mt-0.5">▸</span>
                <span><strong>Distinction visuelle :</strong> Les deux types sont clairement différenciés</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Test responsive */}
        <div className="mt-8 bg-yellow-50 dark:bg-yellow-900/20 p-6 rounded-lg border-2 border-yellow-200 dark:border-yellow-800">
          <h2 className="text-xl font-semibold mb-3 text-gray-900 dark:text-white flex items-center gap-2">
            <span className="text-2xl">📱</span>
            Test responsive
          </h2>
          <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
            Redimensionnez votre navigateur ou utilisez les DevTools pour tester le comportement sur différentes tailles d'écran.
          </p>
          <div className="flex flex-wrap gap-2">
            <span className="px-3 py-1 bg-white dark:bg-gray-800 rounded-full text-xs font-medium">
              Mobile: &lt; 640px → Top (centré)
            </span>
            <span className="px-3 py-1 bg-white dark:bg-gray-800 rounded-full text-xs font-medium">
              Desktop: ≥ 640px → Top-right
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
