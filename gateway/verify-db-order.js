// Vérifier directement dans la DB l'ordre des messages
const { PrismaClient } = require('./shared/prisma/client');

const prisma = new PrismaClient();

async function verifyDBOrder() {
  try {
    console.log('🔍 Test avec orderBy DESC...\n');
    
    const messagesDesc = await prisma.message.findMany({
      where: { conversationId: '68bc64071c7181d556cefce5' },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, content: true, createdAt: true }
    });
    
    console.log('Résultat avec orderBy DESC:');
    messagesDesc.forEach((msg, i) => {
      console.log(`[${i}] ${msg.createdAt.toISOString()} - "${msg.content.substring(0, 40)}..."`);
    });
    
    console.log('\n🔍 Test avec orderBy ASC...\n');
    
    const messagesAsc = await prisma.message.findMany({
      where: { conversationId: '68bc64071c7181d556cefce5' },
      orderBy: { createdAt: 'asc' },
      take: 5,
      select: { id: true, content: true, createdAt: true }
    });
    
    console.log('Résultat avec orderBy ASC:');
    messagesAsc.forEach((msg, i) => {
      console.log(`[${i}] ${msg.createdAt.toISOString()} - "${msg.content.substring(0, 40)}..."`);
    });
    
    console.log('\n📊 COMPARAISON:');
    console.log(`DESC[0]: ${messagesDesc[0].createdAt.toISOString()}`);
    console.log(`ASC[0]: ${messagesAsc[0].createdAt.toISOString()}`);
    
    if (messagesDesc[0].createdAt > messagesAsc[0].createdAt) {
      console.log('✅ DESC retourne bien le plus récent en premier');
    } else {
      console.log('❌ DESC ne fonctionne pas comme attendu');
    }
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

verifyDBOrder();

