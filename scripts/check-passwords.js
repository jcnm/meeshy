#!/usr/bin/env node

/**
 * Script pour vérifier les mots de passe des utilisateurs admin
 * Usage: node scripts/check-passwords.js
 */

const { PrismaClient } = require('../shared/prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function checkPasswords() {
  try {
    console.log('🔍 Vérification des mots de passe des utilisateurs admin...');

    // Récupérer tous les utilisateurs admin
    const adminUsers = await prisma.user.findMany({
      where: {
        role: {
          in: ['ADMIN', 'BIGBOSS', 'CREATOR']
        }
      },
      select: {
        id: true,
        username: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        password: true,
        isActive: true
      }
    });

    console.log(`\n📊 ${adminUsers.length} utilisateur(s) admin trouvé(s):\n`);

    for (const user of adminUsers) {
      console.log(`${user.firstName} ${user.lastName} (${user.role})`);
      console.log(`   Username: ${user.username}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Mot de passe hashé: ${user.password.substring(0, 20)}...`);
      
      // Tester différents mots de passe
      const testPasswords = ['password123', 'admin123', 'meeshy123', '123456'];
      
      for (const testPassword of testPasswords) {
        const isValid = await bcrypt.compare(testPassword, user.password);
        if (isValid) {
          console.log(`   ✅ Mot de passe correct: ${testPassword}`);
          break;
        }
      }
      
      console.log('');
    }

    // Créer un nouveau hash pour password123
    console.log('🔧 Test de création d\'un nouveau hash pour "password123":');
    const newHash = await bcrypt.hash('password123', 12);
    console.log(`   Nouveau hash: ${newHash}`);
    
    // Vérifier que le nouveau hash fonctionne
    const isValid = await bcrypt.compare('password123', newHash);
    console.log(`   Vérification: ${isValid ? '✅ Valide' : '❌ Invalide'}`);

  } catch (error) {
    console.error('❌ Erreur lors de la vérification:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le script
checkPasswords();
