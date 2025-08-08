const { PrismaClient } = require('../shared/prisma/prisma/client');
const prisma = new PrismaClient();

// Messages de démo diversifiés pour la conversation
const demoMessages = [
  { content: "Salut tout le monde ! 👋", language: "fr" },
  { content: "Hello everyone! How's your day going?", language: "en" },
  { content: "¡Hola! ¿Cómo están todos?", language: "es" },
  { content: "你好！今天过得怎么样？", language: "zh" },
  { content: "Quelqu'un veut parler de technologie ?", language: "fr" },
  { content: "I just finished a great book! Any recommendations?", language: "en" },
  { content: "Estoy aprendiendo un nuevo idioma 📚", language: "es" },
  { content: "今天天气真好！", language: "zh" },
  { content: "J'adore cette plateforme de discussion ! 🎉", language: "fr" },
  { content: "Anyone interested in discussing AI and machine learning?", language: "en" },
  { content: "¿Alguien aquí es programador?", language: "es" },
  { content: "我正在学习编程", language: "zh" },
  { content: "Bon weekend à tous ! 🌞", language: "fr" },
  { content: "What's everyone's favorite programming language?", language: "en" },
  { content: "Me encanta la comunidad de desarrolladores", language: "es" },
  { content: "有人想聊聊技术吗？", language: "zh" },
  { content: "Qui veut faire un projet ensemble ?", language: "fr" },
  { content: "Working on an exciting new project! 🚀", language: "en" },
  { content: "Los proyectos colaborativos son los mejores", language: "es" },
  { content: "一起学习真的很有趣！", language: "zh" }
];

async function seedDemoData() {
  try {
    console.log('🌱 Début du seeding des données de démo...');

    // 1. Récupérer tous les utilisateurs existants
    const users = await prisma.user.findMany({
      select: { id: true, username: true, firstName: true, lastName: true }
    });
    console.log(`📋 ${users.length} utilisateurs trouvés`);

    // 2. S'assurer que la conversation 'any' existe
    const globalConv = await prisma.conversation.upsert({
      where: { id: 'any' },
      update: {},
      create: {
        id: 'any',
        type: 'global',
        title: 'Meeshy Global',
        description: 'Conversation globale pour tous les utilisateurs'
      }
    });
    console.log('✅ Conversation globale créée/vérifiée:', globalConv.id);

    // 3. Ajouter tous les utilisateurs à la conversation 'any'
    for (const user of users) {
      await prisma.conversationMember.upsert({
        where: {
          conversationId_userId: {
            conversationId: 'any',
            userId: user.id
          }
        },
        update: {},
        create: {
          conversationId: 'any',
          userId: user.id,
          role: 'member',
          isActive: true
        }
      });
    }
    console.log(`✅ ${users.length} utilisateurs ajoutés à la conversation globale`);

    // 4. Créer des messages de démo avec différents utilisateurs
    console.log('📝 Création des messages de démo...');
    for (let i = 0; i < demoMessages.length; i++) {
      const message = demoMessages[i];
      const randomUser = users[i % users.length]; // Rotation des utilisateurs
      
      // Décaler les timestamps pour simuler des messages envoyés à différents moments
      const createdAt = new Date();
      createdAt.setMinutes(createdAt.getMinutes() - (demoMessages.length - i) * 5);

      await prisma.message.create({
        data: {
          id: `demo-msg-${i + 1}`,
          conversationId: 'any',
          senderId: randomUser.id,
          content: message.content,
          originalLanguage: message.language,
          messageType: 'text',
          createdAt: createdAt,
          updatedAt: createdAt
        }
      });
    }
    console.log(`✅ ${demoMessages.length} messages de démo créés`);

    // 5. Créer des groupes avec les utilisateurs
    console.log('👥 Création des groupes...');
    const groups = [
      {
        id: 'group-developers',
        name: 'Développeurs',
        description: 'Groupe pour les développeurs et passionnés de tech'
      },
      {
        id: 'group-language-learners',
        name: 'Apprenants de langues',
        description: 'Groupe pour pratiquer les langues étrangères'
      },
      {
        id: 'group-casual',
        name: 'Discussion libre',
        description: 'Groupe pour discussions détendues'
      }
    ];

    for (const groupData of groups) {
      const creator = users[0]; // Le premier utilisateur crée les groupes
      
      const group = await prisma.group.upsert({
        where: { id: groupData.id },
        update: {},
        create: {
          id: groupData.id,
          name: groupData.name,
          description: groupData.description,
          isPrivate: false,
          createdBy: creator.id
        }
      });

      // Ajouter plusieurs utilisateurs à chaque groupe
      const membersToAdd = users.slice(0, Math.min(5, users.length));
      for (const user of membersToAdd) {
        await prisma.groupMember.upsert({
          where: {
            groupId_userId: {
              groupId: group.id,
              userId: user.id
            }
          },
          update: {},
          create: {
            groupId: group.id,
            userId: user.id
          }
        });
      }
      console.log(`✅ Groupe "${group.name}" créé avec ${membersToAdd.length} membres`);
    }

    // 6. Créer des conversations privées entre utilisateurs
    console.log('💬 Création des conversations privées...');
    for (let i = 0; i < Math.min(3, users.length - 1); i++) {
      const user1 = users[i];
      const user2 = users[i + 1];
      
      const privateConv = await prisma.conversation.create({
        data: {
          id: `private-${user1.id}-${user2.id}`,
          type: 'private',
          title: `${user1.firstName} & ${user2.firstName}`
        }
      });

      // Ajouter les deux utilisateurs à la conversation
      await prisma.conversationMember.createMany({
        data: [
          {
            conversationId: privateConv.id,
            userId: user1.id,
            role: 'member'
          },
          {
            conversationId: privateConv.id,
            userId: user2.id,
            role: 'member'
          }
        ]
      });

      console.log(`✅ Conversation privée créée entre ${user1.username} et ${user2.username}`);
    }

    // 7. Créer des liens de partage pour la conversation globale
    console.log('🔗 Création des liens de partage...');
    const shareLinks = [
      {
        linkId: 'join-global-chat',
        name: 'Rejoindre le chat global',
        description: 'Lien pour rejoindre rapidement la conversation globale',
        maxUses: 100
      },
      {
        linkId: 'demo-access',
        name: 'Accès démo',
        description: 'Lien de démonstration avec accès limité',
        maxUses: 50,
        allowAnonymousFiles: false
      }
    ];

    for (const linkData of shareLinks) {
      await prisma.conversationShareLink.upsert({
        where: { linkId: linkData.linkId },
        update: {},
        create: {
          linkId: linkData.linkId,
          conversationId: 'any',
          createdBy: users[0].id,
          name: linkData.name,
          description: linkData.description,
          maxUses: linkData.maxUses,
          allowAnonymousFiles: linkData.allowAnonymousFiles || true,
          isActive: true
        }
      });
      console.log(`✅ Lien de partage créé: ${linkData.name}`);
    }

    // 8. Mettre à jour les statistiques des utilisateurs
    console.log('📊 Mise à jour des statistiques...');
    for (const user of users) {
      await prisma.userStats.upsert({
        where: { userId: user.id },
        update: {
          conversationsJoined: { increment: 2 },
          groupsCreated: user.id === users[0].id ? { increment: 3 } : undefined
        },
        create: {
          userId: user.id,
          conversationsJoined: 2,
          groupsCreated: user.id === users[0].id ? 3 : 0
        }
      });
    }

    console.log('🎉 Seeding terminé avec succès !');
    console.log('\n📊 Résumé:');
    console.log(`- ${users.length} utilisateurs avec conversations actives`);
    console.log(`- ${demoMessages.length} messages de démo dans la conversation 'any'`);
    console.log(`- ${groups.length} groupes créés avec membres`);
    console.log(`- ${Math.min(3, users.length - 1)} conversations privées`);
    console.log(`- ${shareLinks.length} liens de partage actifs`);

  } catch (error) {
    console.error('❌ Erreur lors du seeding:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le seeding
seedDemoData();
