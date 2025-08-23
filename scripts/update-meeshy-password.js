#!/usr/bin/env node

/**
 * Script pour mettre à jour le mot de passe de l'utilisateur meeshy
 * Usage: node scripts/update-meeshy-password.js
 */

const { PrismaClient } = require('../shared/prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function updateMeeshyPassword() {
  try {
    console.log('🔧 Mise à jour du mot de passe de l\'utilisateur meeshy...');

    // Créer un nouveau hash pour meeshy123
    const newPassword = 'meeshy123';
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Mettre à jour l'utilisateur meeshy
    const updatedUser = await prisma.user.update({
      where: {
        username: 'meeshy'
      },
      data: {
        password: hashedPassword
      },
      select: {
        id: true,
        username: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true
      }
    });

    console.log('✅ Mot de passe mis à jour avec succès!');
    console.log(`   Utilisateur: ${updatedUser.firstName} ${updatedUser.lastName}`);
    console.log(`   Username: ${updatedUser.username}`);
    console.log(`   Email: ${updatedUser.email}`);
    console.log(`   Rôle: ${updatedUser.role}`);
    console.log(`   Nouveau mot de passe: ${newPassword}`);

    // Vérifier que le nouveau mot de passe fonctionne
    const testUser = await prisma.user.findUnique({
      where: { username: 'meeshy' },
      select: { password: true }
    });

    if (testUser) {
      const isValid = await bcrypt.compare(newPassword, testUser.password);
      console.log(`   Vérification: ${isValid ? '✅ Valide' : '❌ Invalide'}`);
    }

  } catch (error) {
    console.error('❌ Erreur lors de la mise à jour:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le script
updateMeeshyPassword();
