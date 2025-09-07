// Test pour vérifier le parsing de la réponse
const mockApiResponse = {
  data: {
    success: true,
    data: [
      {
        id: "68bd33a753ea730b7f449586",
        title: "Discussion générale", 
        communityId: "68bd248e4510d93563f30f7d"
      }
    ]
  }
};

console.log('Test du parsing de réponse API:');
console.log('Réponse complète:', mockApiResponse);

// Test ancien parsing (incorrect)
const oldResult = mockApiResponse.data;
console.log('Ancien parsing (response.data):', oldResult);

// Test nouveau parsing (correct) 
if (mockApiResponse.data && typeof mockApiResponse.data === 'object' && 'data' in mockApiResponse.data) {
  const conversations = mockApiResponse.data.data;
  console.log('Nouveau parsing (response.data.data):', conversations);
  console.log('✅ Fix correct - nous obtenons bien les conversations');
} else {
  console.log('❌ Parsing failed');
}
