/**
 * Script de seed enrichi pour la base de données Meeshy
 * Crée des utilisateurs de test avec différents rôles et configurations linguistiques
 */

import { PrismaClient } from './prisma/client';

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

  // Utilisateurs pour la demo du frontend (avec les emails exacts utilisés dans page.tsx)
  const aliceMartin = await prisma.user.create({
    data: {
      username: 'alice.martin',
      email: 'alice.martin@email.com',
      firstName: 'Alice',
      lastName: 'Martin',
      password: '$2b$10$UxJ6jmYYODq6QnsTm8TZMu9AlWUDlY/fZdw/e0YA1gjqz9Cjmwlqq', // password123
      role: 'USER',
      isActive: true,
      systemLanguage: 'fr',
      regionalLanguage: 'fr',
      autoTranslateEnabled: true,
      translateToSystemLanguage: true,
      translateToRegionalLanguage: false
    }
  });

  const bobJohnson = await prisma.user.create({
    data: {
      username: 'bob.johnson',
      email: 'bob.johnson@email.com',
      firstName: 'Bob',
      lastName: 'Johnson',
      password: '$2b$10$UxJ6jmYYODq6QnsTm8TZMu9AlWUDlY/fZdw/e0YA1gjqz9Cjmwlqq', // password123
      role: 'USER',
      isActive: true,
      systemLanguage: 'en',
      regionalLanguage: 'en',
      autoTranslateEnabled: true,
      translateToSystemLanguage: true,
      translateToRegionalLanguage: false
    }
  });

  const carlosRodriguez = await prisma.user.create({
    data: {
      username: 'carlos.rodriguez',
      email: 'carlos.rodriguez@email.com',
      firstName: 'Carlos',
      lastName: 'Rodriguez',
      password: '$2b$10$UxJ6jmYYODq6QnsTm8TZMu9AlWUDlY/fZdw/e0YA1gjqz9Cjmwlqq', // password123
      role: 'USER',
      isActive: true,
      systemLanguage: 'es',
      regionalLanguage: 'es',
      autoTranslateEnabled: true,
      translateToSystemLanguage: true,
      translateToRegionalLanguage: false
    }
  });

  // ============== UTILISATEURS INTERNATIONAUX ===============

  // Utilisateur japonais - Tokyo, Japon
  const takeshiNakamura = await prisma.user.create({
    data: {
      username: 'takeshi.nakamura',
      email: 'takeshi.nakamura@email.com',
      firstName: 'Takeshi',
      lastName: 'Nakamura',
      password: '$2b$10$UxJ6jmYYODq6QnsTm8TZMu9AlWUDlY/fZdw/e0YA1gjqz9Cjmwlqq', // password123
      role: 'USER',
      isActive: true,
      systemLanguage: 'ja',
      regionalLanguage: 'ja',
      customDestinationLanguage: 'en', // Anglais comme langue secondaire
      autoTranslateEnabled: true,
      translateToSystemLanguage: true,
      translateToRegionalLanguage: false,
      useCustomDestination: false
    }
  });

  // Utilisatrice japonaise travaillant en entreprise internationale (anglais préféré)
  const yukiSato = await prisma.user.create({
    data: {
      username: 'yuki.sato',
      email: 'yuki.sato@email.com',
      firstName: 'Yuki',
      lastName: 'Sato',
      password: '$2b$10$UxJ6jmYYODq6QnsTm8TZMu9AlWUDlY/fZdw/e0YA1gjqz9Cjmwlqq', // password123
      role: 'USER',
      isActive: true,
      systemLanguage: 'en', // Préfère l'anglais pour le travail
      regionalLanguage: 'ja', // Région japonaise
      customDestinationLanguage: 'ja', // Japonais personnel
      autoTranslateEnabled: true,
      translateToSystemLanguage: true,
      translateToRegionalLanguage: true,
      useCustomDestination: false
    }
  });

  // Utilisateur chinois - Shanghai, Chine
  const liWei = await prisma.user.create({
    data: {
      username: 'li.wei',
      email: 'li.wei@email.com',
      firstName: 'Li',
      lastName: 'Wei',
      password: '$2b$10$UxJ6jmYYODq6QnsTm8TZMu9AlWUDlY/fZdw/e0YA1gjqz9Cjmwlqq', // password123
      role: 'USER',
      isActive: true,
      systemLanguage: 'zh',
      regionalLanguage: 'zh',
      customDestinationLanguage: 'en', // Anglais pour business international
      autoTranslateEnabled: true,
      translateToSystemLanguage: true,
      translateToRegionalLanguage: false,
      useCustomDestination: false
    }
  });

  // Utilisatrice chinoise étudiante en France
  const meiChen = await prisma.user.create({
    data: {
      username: 'mei.chen',
      email: 'mei.chen@email.com',
      firstName: 'Mei',
      lastName: 'Chen',
      password: '$2b$10$UxJ6jmYYODq6QnsTm8TZMu9AlWUDlY/fZdw/e0YA1gjqz9Cjmwlqq', // password123
      role: 'USER',
      isActive: true,
      systemLanguage: 'fr', // Étudiant en France, préfère le français
      regionalLanguage: 'zh', // Origine chinoise
      customDestinationLanguage: 'zh', // Chinois pour la famille
      autoTranslateEnabled: true,
      translateToSystemLanguage: true,
      translateToRegionalLanguage: true,
      useCustomDestination: false
    }
  });

  // Utilisateur portugais - Lisbonne, Portugal
  const pedroSilva = await prisma.user.create({
    data: {
      username: 'pedro.silva',
      email: 'pedro.silva@email.com',
      firstName: 'Pedro',
      lastName: 'Silva',
      password: '$2b$10$UxJ6jmYYODq6QnsTm8TZMu9AlWUDlY/fZdw/e0YA1gjqz9Cjmwlqq', // password123
      role: 'USER',
      isActive: true,
      systemLanguage: 'pt',
      regionalLanguage: 'pt',
      customDestinationLanguage: 'es', // Espagnol pour communiquer avec l'Amérique Latine
      autoTranslateEnabled: true,
      translateToSystemLanguage: true,
      translateToRegionalLanguage: false,
      useCustomDestination: false
    }
  });

  // Utilisatrice brésilienne
  const mariaSantos = await prisma.user.create({
    data: {
      username: 'maria.santos',
      email: 'maria.santos@email.com',
      firstName: 'Maria',
      lastName: 'Santos',
      password: '$2b$10$UxJ6jmYYODq6QnsTm8TZMu9AlWUDlY/fZdw/e0YA1gjqz9Cjmwlqq', // password123
      role: 'USER',
      isActive: true,
      systemLanguage: 'pt',
      regionalLanguage: 'pt',
      customDestinationLanguage: 'en', // Anglais pour le business international
      autoTranslateEnabled: true,
      translateToSystemLanguage: true,
      translateToRegionalLanguage: false,
      useCustomDestination: false
    }
  });

  // Utilisateur camerounais - Yaoundé, Cameroun (francophone)
  const paulNgassa = await prisma.user.create({
    data: {
      username: 'paul.ngassa',
      email: 'paul.ngassa@email.com',
      firstName: 'Paul',
      lastName: 'Ngassa',
      password: '$2b$10$UxJ6jmYYODq6QnsTm8TZMu9AlWUDlY/fZdw/e0YA1gjqz9Cjmwlqq', // password123
      role: 'USER',
      isActive: true,
      systemLanguage: 'fr',
      regionalLanguage: 'fr',
      customDestinationLanguage: 'en', // Anglais pour la région anglophone du Cameroun
      autoTranslateEnabled: true,
      translateToSystemLanguage: true,
      translateToRegionalLanguage: false,
      useCustomDestination: false
    }
  });

  // Utilisatrice camerounaise anglophone - Bamenda, Cameroun
  const graceNkomo = await prisma.user.create({
    data: {
      username: 'grace.nkomo',
      email: 'grace.nkomo@email.com',
      firstName: 'Grace',
      lastName: 'Nkomo',
      password: '$2b$10$UxJ6jmYYODq6QnsTm8TZMu9AlWUDlY/fZdw/e0YA1gjqz9Cjmwlqq', // password123
      role: 'USER',
      isActive: true,
      systemLanguage: 'en',
      regionalLanguage: 'en',
      customDestinationLanguage: 'fr', // Français pour la région francophone du Cameroun
      autoTranslateEnabled: true,
      translateToSystemLanguage: true,
      translateToRegionalLanguage: false,
      useCustomDestination: false
    }
  });

  // Utilisateur canadien francophone - Québec, Canada
  const pierreGagnon = await prisma.user.create({
    data: {
      username: 'pierre.gagnon',
      email: 'pierre.gagnon@email.com',
      firstName: 'Pierre',
      lastName: 'Gagnon',
      password: '$2b$10$UxJ6jmYYODq6QnsTm8TZMu9AlWUDlY/fZdw/e0YA1gjqz9Cjmwlqq', // password123
      role: 'USER',
      isActive: true,
      systemLanguage: 'fr',
      regionalLanguage: 'fr',
      customDestinationLanguage: 'en', // Anglais pour le Canada anglophone
      autoTranslateEnabled: true,
      translateToSystemLanguage: true,
      translateToRegionalLanguage: false,
      useCustomDestination: false
    }
  });

  // Utilisatrice canadienne anglophone - Toronto, Canada
  const sarahTaylor = await prisma.user.create({
    data: {
      username: 'sarah.taylor',
      email: 'sarah.taylor@email.com',
      firstName: 'Sarah',
      lastName: 'Taylor',
      password: '$2b$10$UxJ6jmYYODq6QnsTm8TZMu9AlWUDlY/fZdw/e0YA1gjqz9Cjmwlqq', // password123
      role: 'USER',
      isActive: true,
      systemLanguage: 'en',
      regionalLanguage: 'en',
      customDestinationLanguage: 'fr', // Français pour le Québec
      autoTranslateEnabled: true,
      translateToSystemLanguage: true,
      translateToRegionalLanguage: false,
      useCustomDestination: false
    }
  });

  // Utilisateur allemand
  const hansSchmidt = await prisma.user.create({
    data: {
      username: 'hans.schmidt',
      email: 'hans.schmidt@email.com',
      firstName: 'Hans',
      lastName: 'Schmidt',
      password: '$2b$10$UxJ6jmYYODq6QnsTm8TZMu9AlWUDlY/fZdw/e0YA1gjqz9Cjmwlqq', // password123
      role: 'USER',
      isActive: true,
      systemLanguage: 'de',
      regionalLanguage: 'de',
      customDestinationLanguage: 'en', // Anglais pour business international
      autoTranslateEnabled: true,
      translateToSystemLanguage: true,
      translateToRegionalLanguage: false,
      useCustomDestination: false
    }
  });

  // Utilisatrice arabe - Maroc
  const aminaHassan = await prisma.user.create({
    data: {
      username: 'amina.hassan',
      email: 'amina.hassan@email.com',
      firstName: 'Amina',
      lastName: 'Hassan',
      password: '$2b$10$UxJ6jmYYODq6QnsTm8TZMu9AlWUDlY/fZdw/e0YA1gjqz9Cjmwlqq', // password123
      role: 'USER',
      isActive: true,
      systemLanguage: 'ar',
      regionalLanguage: 'ar',
      customDestinationLanguage: 'fr', // Français (héritage colonial)
      autoTranslateEnabled: true,
      translateToSystemLanguage: true,
      translateToRegionalLanguage: false,
      useCustomDestination: false
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
  const testUsers = [
    userF, userC, userA, userE, // Utilisateurs existants
    // Nouveaux utilisateurs internationaux
    takeshiNakamura, yukiSato, liWei, meiChen,
    pedroSilva, mariaSantos, paulNgassa, graceNkomo,
    pierreGagnon, sarahTaylor, hansSchmidt, aminaHassan
  ];
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

  // Message en japonais
  const testMessage3 = await prisma.message.create({
    data: {
      conversationId: multilingualGroup.id,
      senderId: takeshiNakamura.id,
      content: 'こんにちは！よろしくお願いします。',
      originalLanguage: 'ja',
      messageType: 'text'
    }
  });

  // Message en chinois
  const testMessage4 = await prisma.message.create({
    data: {
      conversationId: multilingualGroup.id,
      senderId: liWei.id,
      content: '你们好！很高兴认识大家。',
      originalLanguage: 'zh',
      messageType: 'text'
    }
  });

  // Message en portugais
  const testMessage5 = await prisma.message.create({
    data: {
      conversationId: multilingualGroup.id,
      senderId: pedroSilva.id,
      content: 'Olá pessoal! Como estão todos?',
      originalLanguage: 'pt',
      messageType: 'text'
    }
  });

  // Message en allemand
  const testMessage6 = await prisma.message.create({
    data: {
      conversationId: multilingualGroup.id,
      senderId: hansSchmidt.id,
      content: 'Hallo zusammen! Freut mich, euch alle zu treffen.',
      originalLanguage: 'de',
      messageType: 'text'
    }
  });

  // Message en arabe
  const testMessage7 = await prisma.message.create({
    data: {
      conversationId: multilingualGroup.id,
      senderId: aminaHassan.id,
      content: 'مرحبا بالجميع! أتطلع للتحدث معكم.',
      originalLanguage: 'ar',
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

🔑 Comptes administratifs :
- bigboss@meeshy.com / bigboss123 (BIGBOSS)
- admin@meeshy.com / admin123 (ADMIN) 
- alice@example.com / user123 (USER)
- bob@example.com / user123 (USER)

🎯 Utilisateurs demo frontend (mot de passe: password123) :
- alice.martin@email.com (Alice Martin - FR)
- bob.johnson@email.com (Bob Johnson - EN) 
- carlos.rodriguez@email.com (Carlos Rodriguez - ES)

🌍 Utilisateurs internationaux (mot de passe: password123) :

🇯🇵 Japonais :
- takeshi.nakamura@email.com (Takeshi Nakamura - JA natif)
- yuki.sato@email.com (Yuki Sato - EN business, JA personnel)

🇨🇳 Chinois :
- li.wei@email.com (Li Wei - ZH natif, EN business)
- mei.chen@email.com (Mei Chen - FR étudiant, ZH famille)

🇵🇹🇧🇷 Lusophones :
- pedro.silva@email.com (Pedro Silva - PT Portugal, ES Amérique Latine)
- maria.santos@email.com (Maria Santos - PT Brésil, EN business)

🇨🇲 Camerounais :
- paul.ngassa@email.com (Paul Ngassa - FR francophone, EN anglophone)
- grace.nkomo@email.com (Grace Nkomo - EN anglophone, FR francophone)

🇨🇦 Canadiens :
- pierre.gagnon@email.com (Pierre Gagnon - FR Québec, EN Canada)
- sarah.taylor@email.com (Sarah Taylor - EN Canada, FR Québec)

🇩🇪 Allemand :
- hans.schmidt@email.com (Hans Schmidt - DE natif, EN business)

🇲🇦 Arabe :
- amina.hassan@email.com (Amina Hassan - AR natif, FR colonial)

🔬 Utilisateurs multilingues pour tests de traduction :
- french@example.com / user123 (F - FR parlé, région RU)
- chinese@example.com / user123 (C - EN parlé, région ZH) 
- american@example.com / user123 (A - PT parlé, région EN)
- spanish@example.com / user123 (E - ES parlé, région FR)

📝 Conversation de test : "${multilingualGroup.title}" (ID: ${multilingualGroup.id})
   - ${testUsers.length} membres de différents pays
   - Messages en 7 langues : ES, FR, JA, ZH, PT, DE, AR

💡 Configuration linguistique réaliste :
   - Utilisateurs avec langues natives et secondaires
   - Configurations business vs. personnelles
   - Situations multilingues authentiques (expatriés, étudiants, etc.)

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
