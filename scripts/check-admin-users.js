#!/usr/bin/env node

/**
 * Script pour vérifier les utilisateurs admin dans la base de données
 * Usage: node scripts/check-admin-users.js
 */

const { PrismaClient } = require('../shared/prisma/client');

const prisma = new PrismaClient();

async function checkAdminUsers() {
  try {
    console.log('🔍 Vérification des utilisateurs admin...');

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
        isActive: true,
        createdAt: true
      }
    });

    console.log(`\n📊 ${adminUsers.length} utilisateur(s) admin trouvé(s):\n`);

    adminUsers.forEach((user, index) => {
      console.log(`${index + 1}. ${user.firstName} ${user.lastName}`);
      console.log(`   Username: ${user.username}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Rôle: ${user.role}`);
      console.log(`   Actif: ${user.isActive ? 'Oui' : 'Non'}`);
      console.log(`   Créé le: ${user.createdAt.toLocaleDateString('fr-FR')}`);
      console.log('');
    });

    // Récupérer aussi tous les utilisateurs pour voir la répartition
    const allUsers = await prisma.user.findMany({
      select: {
        role: true
      }
    });

    const roleCount = {};
    allUsers.forEach(user => {
      roleCount[user.role] = (roleCount[user.role] || 0) + 1;
    });

    console.log('📈 Répartition des rôles:');
    Object.entries(roleCount).forEach(([role, count]) => {
      console.log(`   ${role}: ${count} utilisateur(s)`);
    });

    console.log('\n🎯 Identifiants de connexion pour les admins:');
    adminUsers.forEach((user, index) => {
      console.log(`${index + 1}. ${user.username} / password123`);
    });

  } catch (error) {
    console.error('❌ Erreur lors de la vérification:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le script
checkAdminUsers();
