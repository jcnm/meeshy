// Script pour vérifier le nombre de listeners sur le ZMQ client
const { ZMQSingleton } = require('./src/services/zmq-translation-client-singleton');

async function checkListeners() {
  try {
    console.log('🔍 Vérification des listeners ZMQ...\n');
    
    const zmqClient = await ZMQSingleton.getInstance();
    
    console.log('📊 État du ZMQ Client:');
    console.log(`   Instance: ${zmqClient ? 'OK' : 'NULL'}`);
    
    // Vérifier les listeners
    const translationCompletedListeners = zmqClient.listenerCount('translationCompleted');
    const translationErrorListeners = zmqClient.listenerCount('translationError');
    
    console.log(`\n📡 Listeners enregistrés:`);
    console.log(`   'translationCompleted': ${translationCompletedListeners} listener(s)`);
    console.log(`   'translationError': ${translationErrorListeners} listener(s)`);
    
    if (translationCompletedListeners > 1) {
      console.log(`\n❌ PROBLÈME: ${translationCompletedListeners} listeners sur 'translationCompleted'!`);
      console.log(`   → Chaque traduction sera traitée ${translationCompletedListeners} fois`);
      console.log(`   → Cela crée des doublons en base de données`);
    } else {
      console.log(`\n✅ Nombre correct de listeners`);
    }
    
    console.log('');
    
  } catch (error) {
    console.error('❌ Erreur:', error);
  }
}

checkListeners();

