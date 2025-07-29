/**
 * Script de seed simplifié pour la base de données Meeshy
 * Crée des utilisateurs de test avec différents rôles
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Début du seeding...');

  // Créer les utilisateurs avec différents rôles
  const bigboss = await prisma.user.create({
    data: {
      username: 'bigboss',
      email: 'bigboss@meeshy.com',
      firstName: 'Big',
      lastName: 'Boss',
      password: '$2b$10$dummy.hash.for.bigboss123', // bcrypt hash pour "bigboss123"
      role: 'BIGBOSS',
      isActive: true,
      systemLanguage: 'fr'
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
      systemLanguage: 'fr'
    }
  });

  const alice = await prisma.user.create({
    data: {
      username: 'alice',
      email: 'alice@example.com',
      firstName: 'Alice',
      lastName: 'Martin',
      password: '$2b$10$dummy.hash.for.user123', // bcrypt hash pour "user123"
      role: 'USER',
      isActive: true,
      systemLanguage: 'fr'
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
      systemLanguage: 'en'
    }
  });

  console.log('👥 Utilisateurs créés');

  console.log('✅ Seeding terminé avec succès !');
  console.log(`
📊 Résumé du seeding :
- ${await prisma.user.count()} utilisateurs créés

🔑 Comptes de test :
- bigboss@meeshy.com / bigboss123 (BIGBOSS)
- admin@meeshy.com / admin123 (ADMIN) 
- alice@example.com / user123 (USER)
- bob@example.com / user123 (USER)

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
