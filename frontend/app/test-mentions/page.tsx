'use client';

import { MarkdownMessage } from '@/components/messages/MarkdownMessage';
import { mentionsToLinks } from '@/shared/types/mention';

export default function TestMentionsPage() {
  // Test 1: Mention validée
  const content1 = "Bonjour @atabeth comment vas-tu ?";
  const validUsernames1 = ["atabeth"];
  const transformed1 = mentionsToLinks(content1, '/u/{username}', validUsernames1);

  // Test 2: Mention non validée
  const content2 = "Salut @fakeuser et @atabeth !";
  const validUsernames2 = ["atabeth"];
  const transformed2 = mentionsToLinks(content2, '/u/{username}', validUsernames2);

  // Test 3: Aucune mention validée
  const content3 = "Hello @nobody !";
  const validUsernames3: string[] = [];
  const transformed3 = mentionsToLinks(content3, '/u/{username}', validUsernames3);

  return (
    <div className="container mx-auto p-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-8">Test du Système de Mentions</h1>

      <div className="space-y-8">
        {/* Test 1 */}
        <div className="border rounded-lg p-6 bg-white dark:bg-gray-800">
          <h2 className="text-xl font-semibold mb-4">Test 1: Mention Validée</h2>
          <div className="mb-2">
            <span className="font-mono text-sm text-gray-600 dark:text-gray-400">Input:</span>
            <pre className="bg-gray-100 dark:bg-gray-900 p-2 rounded mt-1">{content1}</pre>
          </div>
          <div className="mb-2">
            <span className="font-mono text-sm text-gray-600 dark:text-gray-400">Valid usernames:</span>
            <pre className="bg-gray-100 dark:bg-gray-900 p-2 rounded mt-1">{JSON.stringify(validUsernames1)}</pre>
          </div>
          <div className="mb-2">
            <span className="font-mono text-sm text-gray-600 dark:text-gray-400">Transformed (markdown):</span>
            <pre className="bg-gray-100 dark:bg-gray-900 p-2 rounded mt-1">{transformed1}</pre>
          </div>
          <div className="mt-4">
            <span className="font-mono text-sm text-gray-600 dark:text-gray-400">Rendered:</span>
            <div className="border-l-4 border-blue-500 pl-4 py-2 mt-1">
              <MarkdownMessage content={transformed1} />
            </div>
          </div>
          <p className="mt-2 text-sm text-green-600 dark:text-green-400">
            ✓ @atabeth devrait apparaître avec fond bleu et être cliquable
          </p>
        </div>

        {/* Test 2 */}
        <div className="border rounded-lg p-6 bg-white dark:bg-gray-800">
          <h2 className="text-xl font-semibold mb-4">Test 2: Mention Mixte (validée + non validée)</h2>
          <div className="mb-2">
            <span className="font-mono text-sm text-gray-600 dark:text-gray-400">Input:</span>
            <pre className="bg-gray-100 dark:bg-gray-900 p-2 rounded mt-1">{content2}</pre>
          </div>
          <div className="mb-2">
            <span className="font-mono text-sm text-gray-600 dark:text-gray-400">Valid usernames:</span>
            <pre className="bg-gray-100 dark:bg-gray-900 p-2 rounded mt-1">{JSON.stringify(validUsernames2)}</pre>
          </div>
          <div className="mb-2">
            <span className="font-mono text-sm text-gray-600 dark:text-gray-400">Transformed (markdown):</span>
            <pre className="bg-gray-100 dark:bg-gray-900 p-2 rounded mt-1">{transformed2}</pre>
          </div>
          <div className="mt-4">
            <span className="font-mono text-sm text-gray-600 dark:text-gray-400">Rendered:</span>
            <div className="border-l-4 border-blue-500 pl-4 py-2 mt-1">
              <MarkdownMessage content={transformed2} />
            </div>
          </div>
          <p className="mt-2 text-sm text-green-600 dark:text-green-400">
            ✓ @atabeth avec fond bleu, @fakeuser en texte normal
          </p>
        </div>

        {/* Test 3 */}
        <div className="border rounded-lg p-6 bg-white dark:bg-gray-800">
          <h2 className="text-xl font-semibold mb-4">Test 3: Aucune Mention Validée</h2>
          <div className="mb-2">
            <span className="font-mono text-sm text-gray-600 dark:text-gray-400">Input:</span>
            <pre className="bg-gray-100 dark:bg-gray-900 p-2 rounded mt-1">{content3}</pre>
          </div>
          <div className="mb-2">
            <span className="font-mono text-sm text-gray-600 dark:text-gray-400">Valid usernames:</span>
            <pre className="bg-gray-100 dark:bg-gray-900 p-2 rounded mt-1">{JSON.stringify(validUsernames3)}</pre>
          </div>
          <div className="mb-2">
            <span className="font-mono text-sm text-gray-600 dark:text-gray-400">Transformed (markdown):</span>
            <pre className="bg-gray-100 dark:bg-gray-900 p-2 rounded mt-1">{transformed3}</pre>
          </div>
          <div className="mt-4">
            <span className="font-mono text-sm text-gray-600 dark:text-gray-400">Rendered:</span>
            <div className="border-l-4 border-blue-500 pl-4 py-2 mt-1">
              <MarkdownMessage content={transformed3} />
            </div>
          </div>
          <p className="mt-2 text-sm text-green-600 dark:text-green-400">
            ✓ @nobody reste en texte normal (pas de fond bleu)
          </p>
        </div>

        {/* Légende */}
        <div className="border rounded-lg p-6 bg-blue-50 dark:bg-blue-900/20">
          <h2 className="text-xl font-semibold mb-4">Légende</h2>
          <ul className="space-y-2">
            <li className="flex items-start">
              <span className="mr-2">🔵</span>
              <div>
                <strong>Mention validée:</strong> Fond bleu, cliquable, lien vers /u/username
              </div>
            </li>
            <li className="flex items-start">
              <span className="mr-2">⚪</span>
              <div>
                <strong>Mention non validée:</strong> Texte normal @username (pas de lien)
              </div>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
