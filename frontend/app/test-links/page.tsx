'use client';

import { MessageWithLinks } from '@/components/chat/message-with-links';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function TestLinksPage() {
  const testMessages = [
    {
      title: 'Lien normal HTTP',
      content: 'Regarde ce site https://example.com pour plus d\'infos',
    },
    {
      title: 'Lien m+<token> (tracking court)',
      content: 'Regarde ce lien m+aB3xY9 c\'est un lien trackable court',
    },
    {
      title: 'Lien meeshy.me/l/<token>',
      content: 'Clique sur https://meeshy.me/l/xY2wZ1 pour accéder',
    },
    {
      title: 'Message avec plusieurs liens',
      content: 'Regarde https://github.com et aussi https://google.com et m+test12',
    },
    {
      title: 'Texte sans lien',
      content: 'Ceci est un message normal sans aucun lien dedans',
    },
  ];

  return (
    <div className="container mx-auto p-8 space-y-6">
      <h1 className="text-3xl font-bold mb-6">Test des Liens Cliquables</h1>

      <div className="space-y-4">
        {testMessages.map((msg, index) => (
          <Card key={index}>
            <CardHeader>
              <CardTitle className="text-lg">{msg.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-2">
                <strong>Contenu original:</strong>
                <pre className="bg-gray-100 dark:bg-gray-800 p-2 rounded text-xs mt-1">
                  {msg.content}
                </pre>
              </div>
              <div>
                <strong>Rendu avec MessageWithLinks:</strong>
                <div className="bg-white dark:bg-gray-900 p-4 rounded border border-gray-200 dark:border-gray-700 mt-1">
                  <MessageWithLinks
                    content={msg.content}
                    enableTracking={true}
                    onLinkClick={(url, isTracking) => {
                      alert(`Link clicked: ${url}\nIs tracking: ${isTracking}`);
                    }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-8 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded border border-yellow-200 dark:border-yellow-700">
        <h2 className="font-bold mb-2">📋 Instructions de Test</h2>
        <ol className="list-decimal list-inside space-y-1 text-sm">
          <li>Ouvrez la console du navigateur (F12)</li>
          <li>Cliquez sur les différents liens</li>
          <li>Vérifiez les logs dans la console</li>
          <li>Les liens devraient être bleus et cliquables</li>
          <li>Les liens mshy:// devraient afficher une alerte puis enregistrer le clic</li>
        </ol>
      </div>
    </div>
  );
}

