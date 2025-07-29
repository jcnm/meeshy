/**
 * Script de seed enrichi pour la base de données Meeshy
 * Crée des utilisateurs de test avec différents rôles et configurations linguistiques
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Début du seeding...');

  // Créer les utilisateurs avec différents rôles et configurations linguistiques
  const bigboss = await prisma.user.create({
    data: {
      username: 'bigboss',
      email: 'bigboss@meeshy.com',
      firstName: 'Big',
      lastName: 'Boss',
      password: '$2b$10$dummy.hash.for.bigboss123', // bcrypt hash pour "bigboss123"
      role: 'BIGBOSS',
      isActive: true,
      systemLanguage: 'fr',
      regionalLanguage: 'en',
      autoTranslateEnabled: true,
      translateToSystemLanguage: true,
      translateToRegionalLanguage: true
    }
  });

  const admin = await prisma.user.create({
    data: {
      username: 'admin',
      email: 'admin@meeshy.com',
      firstName: 'Admin',
      lastName: 'User',
      password: '$2b$10$dummy.hash.for.admin123', // bcrypt hash pour "admin123"
      role: 'ADMIN',
      isActive: true,
      systemLanguage: 'fr',
      regionalLanguage: 'fr',
      autoTranslateEnabled: true,
      translateToSystemLanguage: true,
      translateToRegionalLanguage: false
    }
  });

  // Utilisateur français en région russe (F)
  const userF = await prisma.user.create({
    data: {
      username: 'french_user',
      email: 'french@example.com',
      firstName: 'François',
      lastName: 'Dupont',
      password: '$2b$10$dummy.hash.for.user123',
      role: 'USER',
      isActive: true,
      systemLanguage: 'fr',        // Langue parlée configurée
      regionalLanguage: 'ru',      // Région russe
      autoTranslateEnabled: true,
      translateToSystemLanguage: true,
      translateToRegionalLanguage: true
    }
  });

  // Utilisateur chinois en région chine, langue configurée en anglais (C)
  const userC = await prisma.user.create({
    data: {
      username: 'chinese_user',
      email: 'chinese@example.com',
      firstName: 'Chen',
      lastName: 'Wei',
      password: '$2b$10$dummy.hash.for.user123',
      role: 'USER',
      isActive: true,
      systemLanguage: 'en',        // Langue configurée en anglais
      regionalLanguage: 'zh',      // Région Chine
      autoTranslateEnabled: true,
      translateToSystemLanguage: true,
      translateToRegionalLanguage: true
    }
  });

  // Utilisateur anglais aux États-Unis, langue configurée en portugais (A)
  const userA = await prisma.user.create({
    data: {
      username: 'american_user',
      email: 'american@example.com',
      firstName: 'John',
      lastName: 'Smith',
      password: '$2b$10$dummy.hash.for.user123',
      role: 'USER',
      isActive: true,
      systemLanguage: 'pt',        // Langue configurée en portugais
      regionalLanguage: 'en',      // Région États-Unis
      autoTranslateEnabled: true,
      translateToSystemLanguage: true,
      translateToRegionalLanguage: true
    }
  });

  // Utilisateur espagnol basé en France, langue configurée en espagnol (E)
  const userE = await prisma.user.create({
    data: {
      username: 'spanish_user',
      email: 'spanish@example.com',
      firstName: 'Carlos',
      lastName: 'García',
      password: '$2b$10$dummy.hash.for.user123',
      role: 'USER',
      isActive: true,
      systemLanguage: 'es',        // Langue configurée en espagnol
      regionalLanguage: 'fr',      // Basé en France
      autoTranslateEnabled: true,
      translateToSystemLanguage: true,
      translateToRegionalLanguage: true
    }
  });

  // Utilisateurs classiques pour compatibilité
  const alice = await prisma.user.create({
    data: {
      username: 'alice',
      email: 'alice@example.com',
      firstName: 'Alice',
      lastName: 'Martin',
      password: '$2b$10$dummy.hash.for.user123',
      role: 'USER',
      isActive: true,
      systemLanguage: 'fr',
      autoTranslateEnabled: true,
      translateToSystemLanguage: true
    }
  });

  const bob = await prisma.user.create({
    data: {
      username: 'bob',
      email: 'bob@example.com',
      firstName: 'Bob',
      lastName: 'Johnson',
      password: '$2b$10$dummy.hash.for.user123',
      role: 'USER',
      isActive: true,
      systemLanguage: 'en',
      autoTranslateEnabled: true,
      translateToSystemLanguage: true
    }
  });

  console.log('👥 Utilisateurs créés');

  // Créer une conversation de groupe multilingue pour les tests
  const multilingualGroup = await prisma.conversation.create({
    data: {
      title: 'Groupe Test Multilingue',
      type: 'GROUP',
      description: 'Groupe pour tester les traductions multilingues'
    }
  });

  // Ajouter tous les utilisateurs test au groupe
  const testUsers = [userF, userC, userA, userE];
  for (const user of testUsers) {
    await prisma.conversationMember.create({
      data: {
        conversationId: multilingualGroup.id,
        userId: user.id,
        role: 'MEMBER',
        joinedAt: new Date()
      }
    });
  }

  // Créer quelques messages de test avec traductions
  const testMessage1 = await prisma.message.create({
    data: {
      conversationId: multilingualGroup.id,
      senderId: userE.id,
      content: '¡Hola a todos! ¿Cómo están?',
      originalLanguage: 'es',
      messageType: 'text'
    }
  });

  // Ajouter des traductions pour ce message
  const translationsMessage1 = [
    { targetLanguage: 'fr', translatedContent: 'Salut tout le monde ! Comment allez-vous ?', translationModel: 'nllb' },
    { targetLanguage: 'ru', translatedContent: 'Привет всем! Как дела?', translationModel: 'nllb' },
    { targetLanguage: 'en', translatedContent: 'Hello everyone! How are you?', translationModel: 'mt5' },
    { targetLanguage: 'zh', translatedContent: '大家好！你们好吗？', translationModel: 'nllb' },
    { targetLanguage: 'pt', translatedContent: 'Olá pessoal! Como vocês estão?', translationModel: 'nllb' }
  ];

  for (const translation of translationsMessage1) {
    await prisma.messageTranslation.create({
      data: {
        messageId: testMessage1.id,
        sourceLanguage: 'es',
        targetLanguage: translation.targetLanguage,
        translatedContent: translation.translatedContent,
        translationModel: translation.translationModel,
        cacheKey: `${testMessage1.id}_es_${translation.targetLanguage}`
      }
    });
  }

  const testMessage2 = await prisma.message.create({
    data: {
      conversationId: multilingualGroup.id,
      senderId: userF.id,
      content: 'Bonjour ! Je suis ravi de faire partie de ce groupe.',
      originalLanguage: 'fr',
      messageType: 'text'
    }
  });

  console.log('💬 Messages de test créés avec traductions');

  console.log('✅ Seeding terminé avec succès !');
  console.log(`
📊 Résumé du seeding :
- ${await prisma.user.count()} utilisateurs créés
- ${await prisma.conversation.count()} conversations créées
- ${await prisma.message.count()} messages créés
- ${await prisma.messageTranslation.count()} traductions créées

🔑 Comptes de test :
- bigboss@meeshy.com / bigboss123 (BIGBOSS)
- admin@meeshy.com / admin123 (ADMIN) 
- alice@example.com / user123 (USER)
- bob@example.com / user123 (USER)

🌍 Utilisateurs multilingues pour tests de traduction :
- french@example.com / user123 (F - FR parlé, région RU)
- chinese@example.com / user123 (C - EN parlé, région ZH) 
- american@example.com / user123 (A - PT parlé, région EN)
- spanish@example.com / user123 (E - ES parlé, région FR)

📝 Conversation de test : "${multilingualGroup.title}" (ID: ${multilingualGroup.id})

Note: Les mots de passe sont hashés, utilisez les mots de passe en clair pour vous connecter.
  `);
}

main()
  .catch((e) => {
    console.error('❌ Erreur lors du seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
