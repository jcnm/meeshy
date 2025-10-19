'use client';

import { MetadataTest } from '@/components/common/metadata-test';

export default function TestMetadataPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Test des Métadonnées Open Graph</h1>
        
        <div className="space-y-6">
          <MetadataTest />
          
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="font-semibold mb-2">Instructions de test :</h3>
            <ol className="list-decimal list-inside space-y-1 text-sm">
              <li>Vérifiez que le backend fonctionne sur <code>localhost:3000</code></li>
              <li>Vérifiez que le frontend fonctionne sur <code>localhost:3100</code></li>
              <li>Testez l'API métadonnées avec le bouton "Test API Métadonnées"</li>
              <li>Testez la page HTML avec le bouton "Test Page HTML"</li>
              <li>Vérifiez que les images Open Graph s'affichent</li>
            </ol>
          </div>

          <div className="bg-green-50 p-4 rounded-lg">
            <h3 className="font-semibold mb-2">URLs de test :</h3>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li><code>http://localhost:3100/signin?affiliate=aff_1760904438255_6g0t8ovvkpc</code></li>
              <li><code>http://localhost:3100/test-metadata</code> (cette page)</li>
            </ul>
          </div>

          <div className="bg-yellow-50 p-4 rounded-lg">
            <h3 className="font-semibold mb-2">Outils de test externes :</h3>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li><a href="https://developers.facebook.com/tools/debug/" target="_blank" className="text-blue-600 hover:underline">Facebook Debugger</a></li>
              <li><a href="https://cards-dev.twitter.com/validator" target="_blank" className="text-blue-600 hover:underline">Twitter Card Validator</a></li>
              <li><a href="https://www.linkedin.com/post-inspector/" target="_blank" className="text-blue-600 hover:underline">LinkedIn Post Inspector</a></li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
