import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seed des données...');

  // Vérifier si les utilisateurs existent déjà
  const existingUsers = await prisma.user.count();
  if (existingUsers > 0) {
    console.log('📊 Utilisateurs déjà présents, pas de seed nécessaire');
    return;
  }

  const hashedPassword = await bcrypt.hash('password123', 10);

  const users = [
    {
      id: '1',
      username: 'Alice Martin',
      firstName: 'Alice',
      lastName: 'Martin',
      email: 'alice.martin@email.com',
      phoneNumber: '+33123456789',
      password: hashedPassword,
      systemLanguage: 'fr',
      regionalLanguage: 'fr',
      autoTranslateEnabled: true,
      translateToSystemLanguage: true,
      translateToRegionalLanguage: false,
      useCustomDestination: false,
      isOnline: false,
      createdAt: new Date('2024-01-01'),
      lastActiveAt: new Date(),
    },
    {
      id: '2',
      username: 'Bob Johnson',
      firstName: 'Bob',
      lastName: 'Johnson',
      email: 'bob.johnson@email.com',
      phoneNumber: '+1234567890',
      password: hashedPassword,
      systemLanguage: 'en',
      regionalLanguage: 'ru',
      autoTranslateEnabled: true,
      translateToSystemLanguage: false,
      translateToRegionalLanguage: true,
      useCustomDestination: false,
      isOnline: false,
      createdAt: new Date('2024-01-02'),
      lastActiveAt: new Date(),
    },
    {
      id: '3',
      username: 'Carlos Rodriguez',
      firstName: 'Carlos',
      lastName: 'Rodriguez',
      email: 'carlos.rodriguez@email.com',
      phoneNumber: '+34987654321',
      password: hashedPassword,
      systemLanguage: 'es',
      regionalLanguage: 'es',
      autoTranslateEnabled: true,
      translateToSystemLanguage: true,
      translateToRegionalLanguage: false,
      useCustomDestination: false,
      isOnline: false,
      createdAt: new Date('2024-01-03'),
      lastActiveAt: new Date(),
    },
    {
      id: '4',
      username: 'Diana Chen',
      firstName: 'Diana',
      lastName: 'Chen',
      email: 'diana.chen@email.com',
      phoneNumber: '+8613800138000',
      password: hashedPassword,
      systemLanguage: 'zh',
      regionalLanguage: 'en',
      autoTranslateEnabled: true,
      translateToSystemLanguage: false,
      translateToRegionalLanguage: true,
      useCustomDestination: false,
      isOnline: false,
      createdAt: new Date('2024-01-04'),
      lastActiveAt: new Date(),
    },
    {
      id: '5',
      username: 'Emma Schmidt',
      firstName: 'Emma',
      lastName: 'Schmidt',
      email: 'emma.schmidt@email.com',
      phoneNumber: '+49123456789',
      password: hashedPassword,
      systemLanguage: 'de',
      regionalLanguage: 'fr',
      autoTranslateEnabled: true,
      translateToSystemLanguage: true,
      translateToRegionalLanguage: true,
      useCustomDestination: false,
      isOnline: false,
      createdAt: new Date('2024-01-05'),
      lastActiveAt: new Date(),
    },
  ];

  // Créer les utilisateurs
  for (const userData of users) {
    const user = await prisma.user.create({
      data: {
        ...userData,
        displayName: `${userData.firstName} ${userData.lastName}`,
      },
    });

    // Créer les statistiques pour chaque utilisateur
    await prisma.userStats.create({
      data: {
        userId: user.id,
      },
    });

    console.log(`👤 Utilisateur créé: ${user.username} (${user.email})`);
  }

  console.log('✅ Seed terminé!');
}

main()
  .catch((e) => {
    console.error('❌ Erreur lors du seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
