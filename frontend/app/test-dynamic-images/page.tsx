import Link from 'next/link';

export default function TestDynamicImagesPage() {
  const testCases = [
    {
      type: 'affiliate',
      title: 'Rejoignez Meeshy avec Admin Manager',
      subtitle: 'Invitation d\'un ami',
      userFirstName: 'Admin',
      userLastName: 'Manager',
      userAvatar: 'http://localhost:3100/i/p/2025/10/avatar_1760868829853_iaopqt.jpg'
    },
    {
      type: 'conversation',
      title: 'Conversation Générale',
      subtitle: 'Rejoignez la discussion',
      userName: 'Utilisateur Test'
    },
    {
      type: 'join',
      title: 'Rejoignez notre communauté',
      subtitle: 'Connectez-vous avec le monde',
      userName: 'Meeshy Team'
    },
    {
      type: 'default',
      title: 'Meeshy',
      subtitle: 'Messagerie Multilingue'
    }
  ];

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-center mb-8">
          Test des Images Open Graph Dynamiques
        </h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {testCases.map((testCase, index) => {
            const imageParams = new URLSearchParams({
              type: testCase.type,
              title: testCase.title,
              subtitle: testCase.subtitle,
              ...(testCase.userFirstName && { userFirstName: testCase.userFirstName }),
              ...(testCase.userLastName && { userLastName: testCase.userLastName }),
              ...(testCase.userName && { userName: testCase.userName }),
              ...(testCase.userAvatar && { userAvatar: testCase.userAvatar })
            });
            
            const imageUrl = `/api/og-image-dynamic?${imageParams.toString()}`;
            
            return (
              <div key={index} className="bg-white rounded-lg shadow-lg p-6">
                <h2 className="text-xl font-semibold mb-4 capitalize">
                  Type: {testCase.type}
                </h2>
                <div className="space-y-2 mb-4">
                  <p><strong>Titre:</strong> {testCase.title}</p>
                  <p><strong>Sous-titre:</strong> {testCase.subtitle}</p>
                  {testCase.userFirstName && <p><strong>Prénom:</strong> {testCase.userFirstName}</p>}
                  {testCase.userLastName && <p><strong>Nom:</strong> {testCase.userLastName}</p>}
                  {testCase.userName && <p><strong>Nom d'utilisateur:</strong> {testCase.userName}</p>}
                </div>
                
                <div className="border rounded-lg overflow-hidden">
                  <img 
                    src={imageUrl} 
                    alt={`Test ${testCase.type}`}
                    className="w-full h-auto"
                    style={{ maxHeight: '315px', objectFit: 'cover' }}
                  />
                </div>
                
                <div className="mt-4 text-sm text-gray-600">
                  <p><strong>URL:</strong></p>
                  <code className="block bg-gray-100 p-2 rounded text-xs break-all">
                    {imageUrl}
                  </code>
                </div>
              </div>
            );
          })}
        </div>
        
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-800 mb-3">
            Tests de Pages avec Métadonnées Dynamiques
          </h3>
          <div className="space-y-2">
            <Link 
              href="/signin/affiliate/aff_1760904438255_6g0t8ovvkpc"
              className="block text-blue-600 hover:text-blue-800 underline"
            >
              Test Page Affiliation (Admin Manager)
            </Link>
            <Link 
              href="/test-metadata"
              className="block text-blue-600 hover:text-blue-800 underline"
            >
              Test Métadonnées Statiques
            </Link>
          </div>
        </div>
        
        <div className="mt-8 bg-green-50 border border-green-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-green-800 mb-3">
            Comment Tester
          </h3>
          <ol className="list-decimal list-inside space-y-2 text-green-700">
            <li>Ouvrez les liens dans un nouvel onglet</li>
            <li>Utilisez les outils de développement pour inspecter les métadonnées</li>
            <li>Testez avec des outils comme Facebook Debugger ou Twitter Card Validator</li>
            <li>Vérifiez que les images s'affichent correctement</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
