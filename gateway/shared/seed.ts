/**
 * Script de seed simplifié pour Meeshy
 * Crée 7 utilisateurs multilingues et messages pour conversation 'any'
 */

import { PrismaClient } from './prisma/client';
import { UserRoleEnum } from './types';

const prisma = new PrismaClient();

// Messages multilingues pour les tests (31 messages)
const TEST_MESSAGES = [
  // Messages français
  { text: "Bonjour tout le monde ! Comment allez-vous aujourd'hui ?", lang: 'fr' },
  { text: "J'adore cette plateforme de messagerie multilingue !", lang: 'fr' },
  { text: "Quelqu'un a-t-il testé la traduction automatique ?", lang: 'fr' },
  { text: "Paris est magnifique en cette saison !", lang: 'fr' },
  { text: "Merci pour cette belle communauté internationale !", lang: 'fr' },
  
  // Messages anglais
  { text: "Hello everyone! Great to be here!", lang: 'en' },
  { text: "This real-time translation feature is amazing!", lang: 'en' },
  { text: "Can anyone recommend good language learning resources?", lang: 'en' },
  { text: "Working from different timezones has never been easier!", lang: 'en' },
  { text: "The weather in London is quite nice today", lang: 'en' },
  
  // Messages espagnols
  { text: "¡Hola amigos! ¿Cómo están todos?", lang: 'es' },
  { text: "Me encanta poder escribir en mi idioma nativo", lang: 'es' },
  { text: "¿Alguien más está probando las traducciones?", lang: 'es' },
  { text: "La tecnología de traducción es impresionante", lang: 'es' },
  { text: "Madrid tiene un clima perfecto hoy", lang: 'es' },
  
  // Messages allemands
  { text: "Guten Tag! Wie geht es euch allen?", lang: 'de' },
  { text: "Diese Übersetzungstechnologie ist fantastisch!", lang: 'de' },
  { text: "Ich kann endlich auf Deutsch schreiben!", lang: 'de' },
  { text: "Berlin ist eine wunderbare Stadt für Technologie", lang: 'de' },
  
  // Messages chinois
  { text: "大家好！很高兴见到大家！", lang: 'zh' },
  { text: "这个实时翻译功能太棒了！", lang: 'zh' },
  { text: "我可以用中文和大家交流了", lang: 'zh' },
  { text: "科技让语言不再是障碍", lang: 'zh' },
  { text: "北京今天天气很好", lang: 'zh' },
  
  // Messages japonais
  { text: "皆さん、こんにちは！元気ですか？", lang: 'ja' },
  { text: "この翻訳機能は本当に素晴らしいですね！", lang: 'ja' },
  { text: "日本語で書けるのがとても嬉しいです", lang: 'ja' },
  { text: "東京の桜が美しい季節ですね", lang: 'ja' },
  
  // Messages portugais
  { text: "Olá pessoal! Como estão todos?", lang: 'pt' },
  { text: "Essa plataforma multilíngue é incrível!", lang: 'pt' },
  { text: "A tradução automática funciona muito bem", lang: 'pt' }
];

// Fonction pour générer une clé de cache unique
function generateCacheKey(messageId: string, sourceLang: string, targetLang: string): string {
  return `${messageId}_${sourceLang}_${targetLang}`;
}

// Fonction pour traduire un texte (simulation des traductions)
function getTranslation(text: string, sourceLang: string, targetLang: string): string {
  // Dictionnaire de traductions simulées
  const translations: Record<string, Record<string, string>> = {
    "Bonjour tout le monde ! Comment allez-vous aujourd'hui ?": {
      en: "Hello everyone! How are you doing today?",
      es: "¡Hola a todos! ¿Cómo están hoy?",
      de: "Hallo alle! Wie geht es euch heute?",
      zh: "大家好！你们今天怎么样？",
      ja: "皆さん、こんにちは！今日はいかがですか？",
      pt: "Olá pessoal! Como vocês estão hoje?"
    },
    "Hello everyone! Great to be here!": {
      fr: "Salut tout le monde ! C'est génial d'être ici !",
      es: "¡Hola a todos! ¡Genial estar aquí!",
      de: "Hallo alle! Toll, hier zu sein!",
      zh: "大家好！很高兴在这里！",
      ja: "皆さん、こんにちは！ここにいられて素晴らしいです！",
      pt: "Olá pessoal! Ótimo estar aqui!"
    },
    "¡Hola amigos! ¿Cómo están todos?": {
      fr: "Salut les amis ! Comment allez-vous tous ?",
      en: "Hello friends! How is everyone?",
      de: "Hallo Freunde! Wie geht es euch allen?",
      zh: "朋友们好！大家都好吗？",
      ja: "友達の皆さん、こんにちは！皆さんいかがですか？",
      pt: "Olá amigos! Como estão todos?"
    },
    "Guten Tag! Wie geht es euch allen?": {
      fr: "Bonjour ! Comment allez-vous tous ?",
      en: "Good day! How are you all doing?",
      es: "¡Buenos días! ¿Cómo están todos?",
      zh: "你们好！大家都好吗？",
      ja: "こんにちは！皆さんいかがですか？",
      pt: "Bom dia! Como estão todos?"
    },
    "大家好！很高兴见到大家！": {
      fr: "Bonjour tout le monde ! Ravi de vous rencontrer !",
      en: "Hello everyone! Nice to meet you all!",
      es: "¡Hola a todos! ¡Encantado de conocerlos!",
      de: "Hallo alle! Schön, euch alle kennenzulernen!",
      ja: "皆さん、こんにちは！お会いできて嬉しいです！",
      pt: "Olá pessoal! Prazer em conhecê-los!"
    },
    "皆さん、こんにちは！元気ですか？": {
      fr: "Bonjour tout le monde ! Comment allez-vous ?",
      en: "Hello everyone! How are you doing?",
      es: "¡Hola a todos! ¿Cómo están?",
      de: "Hallo alle! Wie geht es euch?",
      zh: "大家好！你们好吗？",
      pt: "Olá pessoal! Como estão?"
    },
    "Olá pessoal! Como estão todos?": {
      fr: "Salut tout le monde ! Comment allez-vous tous ?",
      en: "Hello everyone! How is everyone doing?",
      es: "¡Hola a todos! ¿Cómo están todos?",
      de: "Hallo alle! Wie geht es euch allen?",
      zh: "大家好！大家都好吗？",
      ja: "皆さん、こんにちは！皆さんいかがですか？"
    }
  };

  // Si on a une traduction définie, l'utiliser
  if (translations[text] && translations[text][targetLang]) {
    return translations[text][targetLang];
  }
  
  // Sinon, générer une traduction générique
  return `[${targetLang.toUpperCase()}] ${text}`;
}

async function main() {
  console.log('🌱 Début du seeding...');

  // Nettoyer les données existantes
  console.log('🧹 Nettoyage des données existantes...');
  await prisma.messageTranslation.deleteMany();
  await prisma.message.deleteMany();
  await prisma.conversationMember.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.user.deleteMany();

  // ================== CRÉER 7 UTILISATEURS MULTILINGUES ==================
  
  console.log('👥 Création des utilisateurs...');
  
  // 1. Utilisateur français (Admin)
  const alice = await prisma.user.create({
    data: {
      username: 'alice_fr',
      email: 'alice@meeshy.com',
      firstName: 'Alice',
      lastName: 'Dubois',
      password: '$2b$10$UxJ6jmYYODq6QnsTm8TZMu9AlWUDlY/fZdw/e0YA1gjqz9Cjmwlqq', // password123
      role: 'ADMIN',
      isActive: true,
      systemLanguage: 'fr',
      regionalLanguage: 'fr',
      autoTranslateEnabled: true,
      translateToSystemLanguage: true,
      translateToRegionalLanguage: false
    }
  });

  // 2. Utilisateur anglais
  const bob = await prisma.user.create({
    data: {
      username: 'bob_en',
      email: 'bob@meeshy.com',
      firstName: 'Bob',
      lastName: 'Johnson',
      password: '$2b$10$UxJ6jmYYODq6QnsTm8TZMu9AlWUDlY/fZdw/e0YA1gjqz9Cjmwlqq', // password123
      role: 'USER',
      isActive: true,
      systemLanguage: 'en',
      regionalLanguage: 'es',
      customDestinationLanguage: 'fr', // Correction pour le champ régional
      autoTranslateEnabled: true,
      translateToSystemLanguage: true,
      translateToRegionalLanguage: false
    }
  });

  // 3. Utilisateur espagnol
  const carlos = await prisma.user.create({
    data: {
      username: 'carlos_es',
      email: 'carlos@meeshy.com',
      firstName: 'Carlos',
      lastName: 'García',
      password: '$2b$10$UxJ6jmYYODq6QnsTm8TZMu9AlWUDlY/fZdw/e0YA1gjqz9Cjmwlqq', // password123
      role: 'USER',
      isActive: true,
      systemLanguage: 'es',
      regionalLanguage: 'en',
      autoTranslateEnabled: true,
      translateToSystemLanguage: true,
      translateToRegionalLanguage: false
    }
  });

  // 4. Utilisateur allemand
  const dieter = await prisma.user.create({
    data: {
      username: 'dieter_de',
      email: 'dieter@meeshy.com',
      firstName: 'Dieter',
      lastName: 'Schmidt',
      password: '$2b$10$UxJ6jmYYODq6QnsTm8TZMu9AlWUDlY/fZdw/e0YA1gjqz9Cjmwlqq', // password123
      role: 'USER',
      isActive: true,
      systemLanguage: 'de',
      regionalLanguage: 'fr',
      autoTranslateEnabled: true,
      translateToSystemLanguage: true,
      translateToRegionalLanguage: false
    }
  });

  // 5. Utilisateur chinois
  const li = await prisma.user.create({
    data: {
      username: 'li_zh',
      email: 'li@meeshy.com',
      firstName: 'Li',
      lastName: 'Wei',
      password: '$2b$10$UxJ6jmYYODq6QnsTm8TZMu9AlWUDlY/fZdw/e0YA1gjqz9Cjmwlqq', // password123
      role: 'USER',
      isActive: true,
      systemLanguage: 'zh',
      regionalLanguage: 'en',
      customDestinationLanguage: 'fr', // Correction pour le champ régional
      autoTranslateEnabled: true,
      translateToSystemLanguage: true,
      translateToRegionalLanguage: false
    }
  });

  // 6. Utilisateur japonais
  const yuki = await prisma.user.create({
    data: {
      username: 'yuki_ja',
      email: 'yuki@meeshy.com',
      firstName: 'Yuki',
      lastName: 'Tanaka',
      password: '$2b$10$UxJ6jmYYODq6QnsTm8TZMu9AlWUDlY/fZdw/e0YA1gjqz9Cjmwlqq', // password123
      role: 'USER',
      isActive: true,
      systemLanguage: 'ja',
      regionalLanguage: 'fr',
      customDestinationLanguage: 'ru', // Correction pour le champ régional
      autoTranslateEnabled: true,
      translateToSystemLanguage: true,
      translateToRegionalLanguage: false
    }
  });

  // 7. Utilisateur portugais
  const maria = await prisma.user.create({
    data: {
      username: 'maria_pt',
      email: 'maria@meeshy.com',
      firstName: 'Maria',
      lastName: 'Silva',
      password: '$2b$10$UxJ6jmYYODq6QnsTm8TZMu9AlWUDlY/fZdw/e0YA1gjqz9Cjmwlqq', // password123
      role: 'USER',
      isActive: true,
      systemLanguage: 'pt',
      regionalLanguage: 'ar',
      autoTranslateEnabled: true,
      translateToSystemLanguage: true,
      translateToRegionalLanguage: false
    }
  });

  const users = [alice, bob, carlos, dieter, li, yuki, maria];
  console.log('✅ 7 utilisateurs multilingues créés');

  // ================== CRÉER LA CONVERSATION 'ANY' (STREAM GLOBAL) ==================
  
  console.log('💭 Création de la conversation "any"...');
  
  // Créer la conversation globale "Meeshy" accessible à tous
  const anyConversation = await prisma.conversation.upsert({
    where: { id: 'any' },
    update: {},
    create: {
      id: 'any',
      type: 'GLOBAL',
      title: 'Meeshy',
      description: 'Conversation globale pour tous les utilisateurs de Meeshy'
    }
  });


  // Ajouter tous les utilisateurs à la conversation 'any'
  for (const user of users) {
    await prisma.conversationMember.create({
      data: {
        conversationId: anyConversation.id,
        userId: user.id,
        role: user.role === UserRoleEnum.ADMIN ? UserRoleEnum.ADMIN : UserRoleEnum.MEMBER,
        joinedAt: new Date()
      }
    });
  }

  console.log('✅ Conversation "any" créée avec tous les utilisateurs');

  // ================== CRÉER 31 MESSAGES AVEC TRADUCTIONS ==================
  
  console.log('💬 Création des messages avec traductions...');
  
  const messages = [];
  
  // Répartir les messages entre les utilisateurs
  for (let i = 0; i < TEST_MESSAGES.length; i++) {
    const messageData = TEST_MESSAGES[i];
    const userIndex = i % users.length;
    const sender = users[userIndex];
    
    // Créer le message avec un délai réaliste (5 minutes entre chaque)
    const createdAt = new Date(Date.now() - (TEST_MESSAGES.length - i) * 300000);
    
    const message = await prisma.message.create({
      data: {
        conversationId: anyConversation.id,
        senderId: sender.id,
        content: messageData.text,
        originalLanguage: messageData.lang,
        messageType: 'text',
        createdAt: createdAt
      }
    });

    messages.push(message);
    
    // Créer les traductions vers toutes les autres langues des utilisateurs
    const userLanguages = [...new Set(users.map(u => u.systemLanguage))];
    const targetLanguages = userLanguages.filter(lang => lang !== messageData.lang);
    
    for (const targetLang of targetLanguages) {
      const translatedContent = getTranslation(messageData.text, messageData.lang, targetLang);
      const modelUsed = ['basic', 'medium', 'premium'][Math.floor(Math.random() * 3)];
      
      await prisma.messageTranslation.create({
        data: {
          messageId: message.id,
          sourceLanguage: messageData.lang,
          targetLanguage: targetLang,
          translatedContent: translatedContent,
          translationModel: modelUsed,
          cacheKey: generateCacheKey(message.id, messageData.lang, targetLang)
        }
      });
    }
  }

  console.log(`✅ ${messages.length} messages créés avec traductions complètes`);

  // ================== STATISTIQUES FINALES ==================
  
  const totalUsers = await prisma.user.count();
  const totalMessages = await prisma.message.count();
  const totalTranslations = await prisma.messageTranslation.count();
  const totalConversations = await prisma.conversation.count();

  console.log(`
📊 === STATISTIQUES DU SEEDING ===
👥 Utilisateurs créés: ${totalUsers}
💬 Messages créés: ${totalMessages}
🌐 Traductions créées: ${totalTranslations}
💭 Conversations: ${totalConversations}

🎯 === DÉTAILS DES UTILISATEURS ===
🇫🇷 Alice Dubois (alice@meeshy.com) - Français - Admin
🇺🇸 Bob Johnson (bob@meeshy.com) - Anglais - User  
🇪🇸 Carlos García (carlos@meeshy.com) - Espagnol - User
🇩🇪 Dieter Schmidt (dieter@meeshy.com) - Allemand - User
🇨🇳 Li Wei (li@meeshy.com) - Chinois - User
🇯🇵 Yuki Tanaka (yuki@meeshy.com) - Japonais - User
🇵🇹 Maria Silva (maria@meeshy.com) - Portugais - User

🔑 === INFORMATIONS DE CONNEXION ===
Mot de passe pour tous: password123

📱 === CONVERSATION 'ANY' ===
ID: any
Type: GLOBAL 
Messages: ${totalMessages} (tous avec traductions)
Langues: FR, EN, ES, DE, ZH, JA, PT

🌟 === PRÊT POUR LES TESTS ===
✓ Multi-language real-time messaging
✓ Automatic translation system  
✓ 7 diverse user profiles
✓ Rich multilingual conversation data
✓ Au moins un message par utilisateur
✓ Traductions vers toutes les langues des membres
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
