#!/usr/bin/env node

/**
 * Script de diagnostic pour l'erreur 500 lors de la mise à jour d'une conversation
 * 
 * Ce script analyse :
 * 1. La structure de la requête PATCH
 * 2. Les permissions de l'utilisateur
 * 3. L'existence de la conversation
 * 4. Les logs d'erreur du serveur
 */

const { PrismaClient } = require('@prisma/client');

// Configuration
const prisma = new PrismaClient();

// Couleurs pour les logs
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step, message) {
  log(`\n[ÉTAPE ${step}] ${message}`, 'cyan');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

// Fonction pour analyser une conversation spécifique
async function analyzeConversation(conversationId) {
  logStep(1, `Analyse de la conversation ${conversationId}`);
  
  try {
    // Vérifier si la conversation existe
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                displayName: true,
                role: true,
                isActive: true
              }
            }
          }
        }
      }
    });
    
    if (!conversation) {
      logError(`Conversation ${conversationId} non trouvée`);
      return null;
    }
    
    logSuccess(`Conversation trouvée: ${conversation.title || conversation.name || 'Sans nom'}`);
    log(`   Type: ${conversation.type}`, 'blue');
    log(`   Créée le: ${conversation.createdAt}`, 'blue');
    log(`   Membres: ${conversation.members.length}`, 'blue');
    
    // Analyser les membres
    log(`\n   Membres de la conversation:`, 'blue');
    conversation.members.forEach((member, index) => {
      log(`     ${index + 1}. ${member.user.username} (${member.user.displayName})`, 'blue');
      log(`        Rôle utilisateur: ${member.user.role}`, 'blue');
      log(`        Rôle conversation: ${member.role}`, 'blue');
      log(`        Actif: ${member.isActive}`, 'blue');
      log(`        Rejoint le: ${member.joinedAt}`, 'blue');
    });
    
    return conversation;
  } catch (error) {
    logError(`Erreur lors de l'analyse de la conversation: ${error.message}`);
    return null;
  }
}

// Fonction pour tester la mise à jour d'une conversation
async function testConversationUpdate(conversationId, userId, updateData) {
  logStep(2, `Test de mise à jour pour l'utilisateur ${userId}`);
  
  try {
    // Vérifier l'appartenance de l'utilisateur à la conversation
    const membership = await prisma.conversationMember.findFirst({
      where: {
        conversationId: conversationId,
        userId: userId,
        isActive: true
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            role: true
          }
        }
      }
    });
    
    if (!membership) {
      logError(`L'utilisateur ${userId} n'est pas membre de la conversation ${conversationId}`);
      return false;
    }
    
    logSuccess(`Membreship trouvé pour ${membership.user.username}`);
    log(`   Rôle utilisateur: ${membership.user.role}`, 'blue');
    log(`   Rôle conversation: ${membership.role}`, 'blue');
    
    // Vérifier les permissions pour la mise à jour
    const canUpdate = membership.user.role === 'ADMIN' || 
                     membership.user.role === 'BIGBOSS' || 
                     membership.role === 'CREATOR' ||
                     membership.role === 'ADMIN';
    
    if (!canUpdate) {
      logWarning(`L'utilisateur ${membership.user.username} n'a pas les permissions pour mettre à jour la conversation`);
      log(`   Permissions requises: ADMIN, BIGBOSS, ou CREATOR`, 'yellow');
      log(`   Permissions actuelles: ${membership.user.role} (utilisateur), ${membership.role} (conversation)`, 'yellow');
    } else {
      logSuccess(`L'utilisateur ${membership.user.username} a les permissions pour mettre à jour la conversation`);
    }
    
    // Tester la mise à jour
    log(`\n   Test de mise à jour avec les données:`, 'blue');
    log(`     ${JSON.stringify(updateData, null, 2)}`, 'blue');
    
    try {
      const updatedConversation = await prisma.conversation.update({
        where: { id: conversationId },
        data: updateData
      });
      
      logSuccess(`Mise à jour réussie: ${updatedConversation.title || updatedConversation.name}`);
      return true;
    } catch (updateError) {
      logError(`Erreur lors de la mise à jour: ${updateError.message}`);
      
      // Analyser l'erreur spécifique
      if (updateError.code === 'P2002') {
        logError(`Erreur de contrainte unique: ${updateError.meta?.target}`);
      } else if (updateError.code === 'P2025') {
        logError(`Enregistrement non trouvé`);
      } else if (updateError.code === 'P2003') {
        logError(`Erreur de clé étrangère: ${updateError.meta?.field_name}`);
      }
      
      return false;
    }
    
  } catch (error) {
    logError(`Erreur lors du test de mise à jour: ${error.message}`);
    return false;
  }
}

// Fonction pour analyser les logs d'erreur
async function analyzeErrorLogs() {
  logStep(3, 'Analyse des logs d\'erreur récents');
  
  try {
    // Vérifier les conversations récemment modifiées
    const recentConversations = await prisma.conversation.findMany({
      where: {
        updatedAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Dernières 24h
        }
      },
      orderBy: {
        updatedAt: 'desc'
      },
      take: 10,
      include: {
        members: {
          include: {
            user: {
              select: {
                username: true,
                role: true
              }
            }
          }
        }
      }
    });
    
    log(`Conversations modifiées dans les dernières 24h: ${recentConversations.length}`, 'blue');
    
    recentConversations.forEach((conv, index) => {
      log(`   ${index + 1}. ${conv.title || conv.name || 'Sans nom'} (${conv.id})`, 'blue');
      log(`      Modifiée le: ${conv.updatedAt}`, 'blue');
      log(`      Membres: ${conv.members.length}`, 'blue');
    });
    
  } catch (error) {
    logError(`Erreur lors de l'analyse des logs: ${error.message}`);
  }
}

// Fonction pour diagnostiquer un problème spécifique
async function diagnoseSpecificIssue(conversationId, userId, updateData) {
  log('🔍 Diagnostic de l\'erreur de mise à jour de conversation', 'bright');
  
  try {
    // Étape 1: Analyser la conversation
    const conversation = await analyzeConversation(conversationId);
    if (!conversation) {
      return;
    }
    
    // Étape 2: Tester la mise à jour
    const updateSuccess = await testConversationUpdate(conversationId, userId, updateData);
    
    // Étape 3: Analyser les logs
    await analyzeErrorLogs();
    
    // Résumé
    log('\n📊 Résumé du diagnostic:', 'bright');
    log(`   Conversation: ${conversation.title || conversation.name || 'Sans nom'}`, 'blue');
    log(`   ID: ${conversationId}`, 'blue');
    log(`   Utilisateur: ${userId}`, 'blue');
    log(`   Mise à jour: ${updateSuccess ? 'SUCCÈS' : 'ÉCHEC'}`, updateSuccess ? 'green' : 'red');
    
    if (!updateSuccess) {
      log('\n💡 Solutions recommandées:', 'yellow');
      log('   1. Vérifier que l\'utilisateur est membre actif de la conversation', 'yellow');
      log('   2. Vérifier les permissions de l\'utilisateur (ADMIN, BIGBOSS, ou CREATOR)', 'yellow');
      log('   3. Vérifier que la conversation existe et est accessible', 'yellow');
      log('   4. Vérifier les contraintes de base de données', 'yellow');
      log('   5. Consulter les logs du serveur pour plus de détails', 'yellow');
    }
    
  } catch (error) {
    logError(`Erreur lors du diagnostic: ${error.message}`);
  }
}

// Fonction principale
async function runDiagnostic() {
  const args = process.argv.slice(2);
  
  if (args.length < 3) {
    log('Usage: node debug-conversation-update-error.js <conversationId> <userId> <updateData>', 'yellow');
    log('Exemple: node debug-conversation-update-error.js "68bca58..." "user123" \'{"title":"Nouveau nom"}\'', 'yellow');
    return;
  }
  
  const conversationId = args[0];
  const userId = args[1];
  const updateDataStr = args[2];
  
  let updateData;
  try {
    updateData = JSON.parse(updateDataStr);
  } catch (error) {
    logError(`Erreur de parsing des données de mise à jour: ${error.message}`);
    return;
  }
  
  await diagnoseSpecificIssue(conversationId, userId, updateData);
}

// Exécuter le diagnostic si le script est appelé directement
if (require.main === module) {
  runDiagnostic().catch(console.error).finally(() => {
    prisma.$disconnect();
  });
}

module.exports = {
  runDiagnostic,
  analyzeConversation,
  testConversationUpdate,
  analyzeErrorLogs,
  diagnoseSpecificIssue
};
