const { PrismaClient } = require('../shared/prisma/prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

// Utilisateurs de développement
const devUsers = [
  {
    id: 'cme2pnbqs0007244fetv5g2z1',
    username: 'alice',
    firstName: 'Alice',
    lastName: 'Dupont',
    email: 'alice@meeshy.dev',
    displayName: 'Alice Dupont',
    role: 'USER',
    systemLanguage: 'fr',
    regionalLanguage: 'fr'
  },
  {
    id: 'cme2pnbqr0006244fh71cmn2o',
    username: 'bob',
    firstName: 'Bob',
    lastName: 'Martin',
    email: 'bob@meeshy.dev',
    displayName: 'Bob Martin',
    role: 'USER',
    systemLanguage: 'en',
    regionalLanguage: 'en'
  },
  {
    id: 'cme2pnbqp0005244f3g9xt1x8',
    username: 'claire',
    firstName: 'Claire',
    lastName: 'Bernard',
    email: 'claire@meeshy.dev',
    displayName: 'Claire Bernard',
    role: 'ADMIN',
    systemLanguage: 'fr',
    regionalLanguage: 'fr'
  },
  {
    id: 'cme2pnbqo0004244fg8h2mn5q',
    username: 'david',
    firstName: 'David',
    lastName: 'García',
    email: 'david@meeshy.dev',
    displayName: 'David García',
    role: 'USER',
    systemLanguage: 'es',
    regionalLanguage: 'es'
  },
  {
    id: 'cme2pnbqn0003244f9c8xz2p1',
    username: 'eva',
    firstName: 'Eva',
    lastName: '李',
    email: 'eva@meeshy.dev',
    displayName: 'Eva Li',
    role: 'USER',
    systemLanguage: 'zh',
    regionalLanguage: 'zh'
  }
];

async function seedDevUsers() {
  try {
    console.log('🌱 Création des utilisateurs de développement...');

    // Hash du mot de passe standard pour le développement
    const hashedPassword = await bcrypt.hash('password123', 10);

    for (const userData of devUsers) {
      // Vérifier si l'utilisateur existe déjà
      const existingUser = await prisma.user.findUnique({
        where: { id: userData.id }
      });

      if (existingUser) {
        console.log(`ℹ️  Utilisateur ${userData.username} (${userData.id}) existe déjà`);
        continue;
      }

      // Créer l'utilisateur
      const user = await prisma.user.create({
        data: {
          ...userData,
          password: hashedPassword,
          autoTranslateEnabled: true,
          translateToSystemLanguage: true,
          translateToRegionalLanguage: false,
          useCustomDestination: false,
          isOnline: false,
          isActive: true,
          createdAt: new Date(),
          lastActiveAt: new Date()
        }
      });

      console.log(`✅ Utilisateur créé: ${user.username} (${user.email})`);
    }

    console.log(`🎉 ${devUsers.length} utilisateurs de développement créés/vérifiés`);
    console.log('💡 Mot de passe pour tous: password123');
    console.log('💡 Exemples de connexion:');
    devUsers.forEach(user => {
      console.log(`   - ${user.username} (${user.email}) - Langue: ${user.systemLanguage}`);
    });

  } catch (error) {
    console.error('❌ Erreur lors de la création des utilisateurs:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter si le fichier est appelé directement
if (require.main === module) {
  seedDevUsers();
}

module.exports = { seedDevUsers };
