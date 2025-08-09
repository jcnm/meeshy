/**
 * Script de seed enrichi pour la base de données Meeshy
 * Crée 7 utilisateurs test avec différentes langues supportées et messages pour conversation 'any'
 */

import { PrismaClient } from './prisma/client';

const prisma = new PrismaClient();

// Langues supportées par la plateforme
const SUPPORTED_LANGUAGES = [
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
  { code: 'pt', name: 'Português', flag: '🇵🇹' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺' }
];

// Messages multilingues pour les tests
const TEST_MESSAGES = [
  // Messages français
  { text: "Bonjour tout le monde ! Comment allez-vous aujourd'hui ?", lang: 'fr' },
  { text: "J'adore cette plateforme de messagerie multilingue !", lang: 'fr' },
  { text: "Quelqu'un a-t-il testé la traduction automatique ?", lang: 'fr' },
  
  // Messages anglais
  { text: "Hello everyone! Great to be here!", lang: 'en' },
  { text: "This real-time translation feature is amazing!", lang: 'en' },
  { text: "Can anyone recommend good language learning resources?", lang: 'en' },
  { text: "Working from different timezones has never been easier!", lang: 'en' },
  
  // Messages espagnols
  { text: "¡Hola amigos! ¿Cómo están todos?", lang: 'es' },
  { text: "Me encanta poder escribir en mi idioma nativo", lang: 'es' },
  { text: "¿Alguien más está probando las traducciones?", lang: 'es' },
  { text: "La tecnología de traducción es impresionante", lang: 'es' },
  
  // Messages allemands
  { text: "Guten Tag! Wie geht es euch allen?", lang: 'de' },
  { text: "Diese Übersetzungstechnologie ist fantastisch!", lang: 'de' },
  { text: "Ich kann endlich auf Deutsch schreiben!", lang: 'de' },
  
  // Messages chinois
  { text: "大家好！很高兴见到大家！", lang: 'zh' },
  { text: "这个实时翻译功能太棒了！", lang: 'zh' },
  { text: "我可以用中文和大家交流了", lang: 'zh' },
  { text: "科技让语言不再是障碍", lang: 'zh' },
  
  // Messages japonais
  { text: "皆さん、こんにちは！元気ですか？", lang: 'ja' },
  { text: "この翻訳機能は本当に素晴らしいですね！", lang: 'ja' },
  { text: "日本語で書けるのがとても嬉しいです", lang: 'ja' },
  
  // Messages portugais
  { text: "Olá pessoal! Como estão todos?", lang: 'pt' },
  { text: "Essa plataforma multilíngue é incrível!", lang: 'pt' },
  { text: "Finalmente posso escrever em português!", lang: 'pt' },
  { text: "A tradução automática funciona muito bem", lang: 'pt' },
  
  // Messages arabes
  { text: "مرحبا بالجميع! كيف حالكم اليوم؟", lang: 'ar' },
  { text: "هذه المنصة متعددة اللغات رائعة جداً!", lang: 'ar' },
  { text: "أخيراً يمكنني الكتابة بالعربية!", lang: 'ar' },
  
  // Messages russes
  { text: "Привет всем! Как дела?", lang: 'ru' },
  { text: "Эта платформа для многоязычного общения просто потрясающая!", lang: 'ru' },
  { text: "Наконец-то могу писать на русском языке!", lang: 'ru' }
];

async function main() {
  console.log('🌱 Début du seeding...');

  // ================== CRÉER 7 UTILISATEURS MULTILINGUES ==================
  
  // 1. Utilisateur français (Admin)
  const alice = await prisma.user.upsert({
    where: { email: 'alice@meeshy.com' },
    update: {},
    create: {
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
  const bob = await prisma.user.upsert({
    where: { email: 'bob@meeshy.com' },
    update: {},
    create: {
      username: 'bob_en',
      email: 'bob@meeshy.com',
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

  // 3. Utilisateur espagnol
  const carlos = await prisma.user.upsert({
    where: { email: 'carlos@meeshy.com' },
    update: {},
    create: {
      username: 'carlos_es',
      email: 'carlos@meeshy.com',
      firstName: 'Carlos',
      lastName: 'García',
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

  // 4. Utilisateur allemand
  const dieter = await prisma.user.upsert({
    where: { email: 'dieter@meeshy.com' },
    update: {},
    create: {
      username: 'dieter_de',
      email: 'dieter@meeshy.com',
      firstName: 'Dieter',
      lastName: 'Schmidt',
      password: '$2b$10$UxJ6jmYYODq6QnsTm8TZMu9AlWUDlY/fZdw/e0YA1gjqz9Cjmwlqq', // password123
      role: 'USER',
      isActive: true,
      systemLanguage: 'de',
      regionalLanguage: 'de',
      autoTranslateEnabled: true,
      translateToSystemLanguage: true,
      translateToRegionalLanguage: false
    }
  });

  // 5. Utilisateur chinois
  const li = await prisma.user.upsert({
    where: { email: 'li@meeshy.com' },
    update: {},
    create: {
      username: 'li_zh',
      email: 'li@meeshy.com',
      firstName: 'Li',
      lastName: 'Wei',
      password: '$2b$10$UxJ6jmYYODq6QnsTm8TZMu9AlWUDlY/fZdw/e0YA1gjqz9Cjmwlqq', // password123
      role: 'USER',
      isActive: true,
      systemLanguage: 'zh',
      regionalLanguage: 'zh',
      autoTranslateEnabled: true,
      translateToSystemLanguage: true,
      translateToRegionalLanguage: false
    }
  });

  // 6. Utilisateur japonais
  const yuki = await prisma.user.upsert({
    where: { email: 'yuki@meeshy.com' },
    update: {},
    create: {
      username: 'yuki_ja',
      email: 'yuki@meeshy.com',
      firstName: 'Yuki',
      lastName: 'Tanaka',
      password: '$2b$10$UxJ6jmYYODq6QnsTm8TZMu9AlWUDlY/fZdw/e0YA1gjqz9Cjmwlqq', // password123
      role: 'USER',
      isActive: true,
      systemLanguage: 'ja',
      regionalLanguage: 'ja',
      autoTranslateEnabled: true,
      translateToSystemLanguage: true,
      translateToRegionalLanguage: false
    }
  });

  // 7. Utilisateur portugais
  const maria = await prisma.user.upsert({
    where: { email: 'maria@meeshy.com' },
    update: {},
    create: {
      username: 'maria_pt',
      email: 'maria@meeshy.com',
      firstName: 'Maria',
      lastName: 'Silva',
      password: '$2b$10$UxJ6jmYYODq6QnsTm8TZMu9AlWUDlY/fZdw/e0YA1gjqz9Cjmwlqq', // password123
      role: 'USER',
      isActive: true,
      systemLanguage: 'pt',
      regionalLanguage: 'pt',
      autoTranslateEnabled: true,
      translateToSystemLanguage: true,
      translateToRegionalLanguage: false
    }
  });

  const users = [alice, bob, carlos, dieter, li, yuki, maria];
  console.log('✅ 7 utilisateurs multilingues créés');

  // ================== CRÉER LA CONVERSATION 'ANY' (STREAM GLOBAL) ==================

  // Utilisateur français en région russe (F)
  const userF = await prisma.user.upsert({
    where: { email: 'french@example.com' },
    update: {},
    create: {
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
  const userC = await prisma.user.upsert({
    where: { email: 'chinese@example.com' },
    update: {},
    create: {
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
  const userA = await prisma.user.upsert({
    where: { email: 'american@example.com' },
    update: {},
    create: {
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
  const userE = await prisma.user.upsert({
    where: { email: 'spanish@example.com' },
    update: {},
    create: {
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
  const alice = await prisma.user.upsert({
    where: { email: 'alice@example.com' },
    update: {},
    create: {
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

  const bob = await prisma.user.upsert({
    where: { email: 'bob@example.com' },
    update: {},
    create: {
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
  const aliceMartin = await prisma.user.upsert({
    where: { email: 'alice.martin@email.com' },
    update: {},
    create: {
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

  const bobJohnson = await prisma.user.upsert({
    where: { email: 'bob.johnson@email.com' },
    update: {},
    create: {
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

  const carlosRodriguez = await prisma.user.upsert({
    where: { email: 'carlos.rodriguez@email.com' },
    update: {},
    create: {
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
  const takeshiNakamura = await prisma.user.upsert({
    where: { email: 'takeshi.nakamura@email.com' },
    update: {},
    create: {
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
  const yukiSato = await prisma.user.upsert({
    where: { email: 'yuki.sato@email.com' },
    update: {},
    create: {
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
  const liWei = await prisma.user.upsert({
    where: { email: 'li.wei@email.com' },
    update: {},
    create: {
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
  const meiChen = await prisma.user.upsert({
    where: { email: 'mei.chen@email.com' },
    update: {},
    create: {
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
  const pedroSilva = await prisma.user.upsert({
    where: { email: 'pedro.silva@email.com' },
    update: {},
    create: {
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
  const mariaSantos = await prisma.user.upsert({
    where: { email: 'maria.santos@email.com' },
    update: {},
    create: {
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
  const paulNgassa = await prisma.user.upsert({
    where: { email: 'paul.ngassa@email.com' },
    update: {},
    create: {
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
  const graceNkomo = await prisma.user.upsert({
    where: { email: 'grace.nkomo@email.com' },
    update: {},
    create: {
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
  const pierreGagnon = await prisma.user.upsert({
    where: { email: 'pierre.gagnon@email.com' },
    update: {},
    create: {
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
  const sarahTaylor = await prisma.user.upsert({
    where: { email: 'sarah.taylor@email.com' },
    update: {},
    create: {
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
  const hansSchmidt = await prisma.user.upsert({
    where: { email: 'hans.schmidt@email.com' },
    update: {},
    create: {
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
  const aminaHassan = await prisma.user.upsert({
    where: { email: 'amina.hassan@email.com' },
    update: {},
    create: {
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

  // Créer la conversation globale "Meeshy" accessible à tous
  const globalConversation = await prisma.conversation.upsert({
    where: { id: 'any' },
    update: {},
    create: {
      id: 'any',
      type: 'GLOBAL',
      title: 'Meeshy',
      description: 'Conversation globale pour tous les utilisateurs de Meeshy'
    }
  });

  console.log('🌍 Conversation globale "Meeshy" créée');

  // Ajouter tous les utilisateurs comme membres de la conversation globale
  const allUsers = [
    bigboss, admin, userF, userC, userA, userE, alice, bob,
    aliceMartin, bobJohnson, carlosRodriguez, takeshiNakamura, yukiSato,
    liWei, meiChen, pedroSilva, mariaSantos, paulNgassa, graceNkomo,
    pierreGagnon, sarahTaylor, hansSchmidt, aminaHassan
  ];

  // Ajouter les utilisateurs un par un pour éviter les conflits de clés uniques
  let membersAdded = 0;
  for (const user of allUsers) {
    try {
      await prisma.conversationMember.upsert({
        where: {
          conversationId_userId: {
            conversationId: globalConversation.id,
            userId: user.id
          }
        },
        update: {},
        create: {
          conversationId: globalConversation.id,
          userId: user.id,
          role: 'MEMBER',
          joinedAt: new Date()
        }
      });
      membersAdded++;
    } catch (error) {
      console.warn(`⚠️  Utilisateur ${user.username} déjà membre de la conversation globale`);
    }
  }

  console.log(`🌍 ${membersAdded} utilisateurs ajoutés à la conversation globale "any"`);

  // ============== CONVERSATIONS PRIVÉES ==============
  
  // Conversation privée entre Alice et Bob (Franco-Anglais)
  const aliceBobPrivate = await prisma.conversation.upsert({
    where: { id: 'alice-bob-private' },
    update: {},
    create: {
      id: 'alice-bob-private',
      type: 'DIRECT',
      title: 'Alice & Bob Chat',
      description: 'Conversation privée entre Alice Martin et Bob Johnson'
    }
  });

  // Ajouter les participants (en utilisant upsert pour éviter les doublons)
  await prisma.conversationMember.upsert({
    where: {
      conversationId_userId: {
        conversationId: aliceBobPrivate.id,
        userId: aliceMartin.id
      }
    },
    update: {},
    create: {
      conversationId: aliceBobPrivate.id,
      userId: aliceMartin.id,
      role: 'MEMBER',
      joinedAt: new Date()
    }
  });

  await prisma.conversationMember.upsert({
    where: {
      conversationId_userId: {
        conversationId: aliceBobPrivate.id,
        userId: bobJohnson.id
      }
    },
    update: {},
    create: {
      conversationId: aliceBobPrivate.id,
      userId: bobJohnson.id,
      role: 'MEMBER',
      joinedAt: new Date()
    }
  });

  // Conversation privée entre utilisateurs asiatiques
  const asianPrivate = await prisma.conversation.upsert({
    where: { id: 'asian-private' },
    update: {},
    create: {
      id: 'asian-private',
      type: 'DIRECT',
      title: 'Takeshi & Li Wei',
      description: 'Conversation privée entre collègues asiatiques'
    }
  });

  await prisma.conversationMember.upsert({
    where: {
      conversationId_userId: {
        conversationId: asianPrivate.id,
        userId: takeshiNakamura.id
      }
    },
    update: {},
    create: {
      conversationId: asianPrivate.id,
      userId: takeshiNakamura.id,
      role: 'MEMBER',
      joinedAt: new Date()
    }
  });

  await prisma.conversationMember.upsert({
    where: {
      conversationId_userId: {
        conversationId: asianPrivate.id,
        userId: liWei.id
      }
    },
    update: {},
    create: {
      conversationId: asianPrivate.id,
      userId: liWei.id,
      role: 'MEMBER',
      joinedAt: new Date()
    }
  });

  // ============== CONVERSATIONS DE GROUPE ==============

  // Groupe d'entreprise internationale
  const businessGroup = await prisma.conversation.create({
    data: {
      type: 'GROUP',
      title: 'International Business Team',
      description: 'Équipe internationale pour projets business',
      image: '/images/groups/business-team.jpg'
    }
  });

  const businessMembers = [bigboss, admin, yukiSato, hansSchmidt, sarahTaylor, mariaSantos];
  for (const member of businessMembers) {
    await prisma.conversationMember.create({
      data: {
        conversationId: businessGroup.id,
        userId: member.id,
        role: member.id === bigboss.id ? 'ADMIN' : 'MEMBER',
        joinedAt: new Date()
      }
    });
  }

  // Groupe étudiants internationaux
  const studentsGroup = await prisma.conversation.create({
    data: {
      type: 'GROUP',
      title: 'Étudiants Internationaux',
      description: 'Groupe pour les étudiants étrangers en France',
      image: '/images/groups/students.jpg'
    }
  });

  const studentMembers = [meiChen, carlosRodriguez, alice, userE];
  for (const member of studentMembers) {
    await prisma.conversationMember.create({
      data: {
        conversationId: studentsGroup.id,
        userId: member.id,
        role: member.id === alice.id ? 'ADMIN' : 'MEMBER',
        joinedAt: new Date()
      }
    });
  }

  // Groupe tech francophone
  const techGroup = await prisma.conversation.create({
    data: {
      type: 'GROUP',
      title: 'Tech Francophone',
      description: 'Développeurs et techniciens francophones',
      image: '/images/groups/tech.jpg'
    }
  });

  const techMembers = [aliceMartin, paulNgassa, pierreGagnon, userF];
  for (const member of techMembers) {
    await prisma.conversationMember.create({
      data: {
        conversationId: techGroup.id,
        userId: member.id,
        role: member.id === aliceMartin.id ? 'ADMIN' : 'MEMBER',
        joinedAt: new Date()
      }
    });
  }

  // ============== CONVERSATIONS COMMUNAUTAIRES ==============

  // Créer des communautés d'abord
  const frenchCommunity = await prisma.community.create({
    data: {
      title: 'Communauté Française',
      description: 'Espace pour tous les francophones',
      isPublic: true,
      createdById: aliceMartin.id
    }
  });

  const techCommunity = await prisma.community.create({
    data: {
      title: 'Tech Community',
      description: 'Global technology community',
      isPublic: true,
      createdById: bobJohnson.id
    }
  });

  // Conversation dans la communauté française
  const frenchCommunityChat = await prisma.conversation.create({
    data: {
      type: 'COMMUNITY',
      title: 'Général - Communauté Française',
      description: 'Discussion générale en français',
      communityId: frenchCommunity.id
    }
  });

  const frenchSpeakers = [aliceMartin, userF, paulNgassa, pierreGagnon, meiChen, userE];
  for (const member of frenchSpeakers) {
    await prisma.conversationMember.create({
      data: {
        conversationId: frenchCommunityChat.id,
        userId: member.id,
        role: 'MEMBER',
        joinedAt: new Date()
      }
    });
  }

  // Conversation tech dans la communauté tech
  const techCommunityChat = await prisma.conversation.create({
    data: {
      type: 'COMMUNITY',
      title: 'General Discussion - Tech',
      description: 'Technical discussions and sharing',
      communityId: techCommunity.id
    }
  });

  const techUsers = [bobJohnson, yukiSato, hansSchmidt, sarahTaylor, liWei, graceNkomo];
  for (const member of techUsers) {
    await prisma.conversationMember.create({
      data: {
        conversationId: techCommunityChat.id,
        userId: member.id,
        role: 'MEMBER',
        joinedAt: new Date()
      }
    });
  }

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

  // ============== MESSAGES POUR CONVERSATIONS PRIVÉES ==============

  // Messages Alice & Bob (Français/Anglais)
  await prisma.message.create({
    data: {
      conversationId: aliceBobPrivate.id,
      senderId: aliceMartin.id,
      content: 'Salut Bob ! Comment ça va ?',
      originalLanguage: 'fr',
      messageType: 'text'
    }
  });

  await prisma.message.create({
    data: {
      conversationId: aliceBobPrivate.id,
      senderId: bobJohnson.id,
      content: 'Hey Alice! I\'m doing great, thanks! How about you?',
      originalLanguage: 'en',
      messageType: 'text'
    }
  });

  await prisma.message.create({
    data: {
      conversationId: aliceBobPrivate.id,
      senderId: aliceMartin.id,
      content: 'Ça va bien merci ! Tu as vu le nouveau projet ?',
      originalLanguage: 'fr',
      messageType: 'text'
    }
  });

  // Messages Takeshi & Li Wei (Japonais/Chinois)
  await prisma.message.create({
    data: {
      conversationId: asianPrivate.id,
      senderId: takeshiNakamura.id,
      content: 'こんにちは！お疲れ様です。',
      originalLanguage: 'ja',
      messageType: 'text'
    }
  });

  await prisma.message.create({
    data: {
      conversationId: asianPrivate.id,
      senderId: liWei.id,
      content: '你好！最近工作怎么样？',
      originalLanguage: 'zh',
      messageType: 'text'
    }
  });

  // ============== MESSAGES POUR GROUPES ==============

  // Messages Business Group
  await prisma.message.create({
    data: {
      conversationId: businessGroup.id,
      senderId: bigboss.id,
      content: 'Welcome everyone to our international business team!',
      originalLanguage: 'en',
      messageType: 'text'
    }
  });

  await prisma.message.create({
    data: {
      conversationId: businessGroup.id,
      senderId: yukiSato.id,
      content: 'Thank you for the warm welcome! Looking forward to working together.',
      originalLanguage: 'en',
      messageType: 'text'
    }
  });

  await prisma.message.create({
    data: {
      conversationId: businessGroup.id,
      senderId: hansSchmidt.id,
      content: 'Guten Tag! Freue mich auf die Zusammenarbeit.',
      originalLanguage: 'de',
      messageType: 'text'
    }
  });

  await prisma.message.create({
    data: {
      conversationId: businessGroup.id,
      senderId: mariaSantos.id,
      content: 'Olá pessoal! Vamos fazer um ótimo trabalho juntos!',
      originalLanguage: 'pt',
      messageType: 'text'
    }
  });

  // Messages Students Group
  await prisma.message.create({
    data: {
      conversationId: studentsGroup.id,
      senderId: alice.id,
      content: 'Bienvenue dans notre groupe d\'étudiants internationaux !',
      originalLanguage: 'fr',
      messageType: 'text'
    }
  });

  await prisma.message.create({
    data: {
      conversationId: studentsGroup.id,
      senderId: meiChen.id,
      content: 'Merci beaucoup ! Je suis ravie de faire partie du groupe.',
      originalLanguage: 'fr',
      messageType: 'text'
    }
  });

  await prisma.message.create({
    data: {
      conversationId: studentsGroup.id,
      senderId: carlosRodriguez.id,
      content: '¡Hola a todos! Encantado de conoceros.',
      originalLanguage: 'es',
      messageType: 'text'
    }
  });

  await prisma.message.create({
    data: {
      conversationId: studentsGroup.id,
      senderId: userE.id,
      content: 'Perfecto, tenemos un grupo muy diverso aquí.',
      originalLanguage: 'es',
      messageType: 'text'
    }
  });

  // Messages Tech Group
  await prisma.message.create({
    data: {
      conversationId: techGroup.id,
      senderId: aliceMartin.id,
      content: 'Bonjour les devs ! Quel est votre langage préféré en ce moment ?',
      originalLanguage: 'fr',
      messageType: 'text'
    }
  });

  await prisma.message.create({
    data: {
      conversationId: techGroup.id,
      senderId: paulNgassa.id,
      content: 'Personnellement, je suis fan de TypeScript et React.',
      originalLanguage: 'fr',
      messageType: 'text'
    }
  });

  await prisma.message.create({
    data: {
      conversationId: techGroup.id,
      senderId: pierreGagnon.id,
      content: 'Moi c\'est Python et FastAPI pour les APIs !',
      originalLanguage: 'fr',
      messageType: 'text'
    }
  });

  // ============== MESSAGES POUR COMMUNAUTÉS ==============

  // Messages French Community
  await prisma.message.create({
    data: {
      conversationId: frenchCommunityChat.id,
      senderId: aliceMartin.id,
      content: 'Bienvenue dans la communauté francophone !',
      originalLanguage: 'fr',
      messageType: 'text'
    }
  });

  await prisma.message.create({
    data: {
      conversationId: frenchCommunityChat.id,
      senderId: paulNgassa.id,
      content: 'Merci ! C\'est génial d\'avoir un espace pour nous exprimer en français.',
      originalLanguage: 'fr',
      messageType: 'text'
    }
  });

  await prisma.message.create({
    data: {
      conversationId: frenchCommunityChat.id,
      senderId: pierreGagnon.id,
      content: 'Salut de Montréal ! Ravi de rencontrer des francophones du monde entier.',
      originalLanguage: 'fr',
      messageType: 'text'
    }
  });

  await prisma.message.create({
    data: {
      conversationId: frenchCommunityChat.id,
      senderId: meiChen.id,
      content: 'Bonjour ! Je suis étudiante chinoise en France, contente d\'être ici !',
      originalLanguage: 'fr',
      messageType: 'text'
    }
  });

  // Messages Tech Community
  await prisma.message.create({
    data: {
      conversationId: techCommunityChat.id,
      senderId: bobJohnson.id,
      content: 'Welcome to our global tech community! Let\'s share knowledge and grow together.',
      originalLanguage: 'en',
      messageType: 'text'
    }
  });

  await prisma.message.create({
    data: {
      conversationId: techCommunityChat.id,
      senderId: yukiSato.id,
      content: 'Thanks! I\'m excited to discuss the latest trends in AI and machine learning.',
      originalLanguage: 'en',
      messageType: 'text'
    }
  });

  await prisma.message.create({
    data: {
      conversationId: techCommunityChat.id,
      senderId: liWei.id,
      content: 'Hello everyone! Looking forward to collaborating on open source projects.',
      originalLanguage: 'en',
      messageType: 'text'
    }
  });

  await prisma.message.create({
    data: {
      conversationId: techCommunityChat.id,
      senderId: graceNkomo.id,
      content: 'Hi! I\'m interested in discussing mobile development and best practices.',
      originalLanguage: 'en',
      messageType: 'text'
    }
  });

  // ============== MESSAGES POUR LA CONVERSATION GLOBALE ==============

  // Messages dans la conversation globale "Meeshy"
  await prisma.message.create({
    data: {
      conversationId: globalConversation.id,
      senderId: bigboss.id,
      content: 'Welcome to Meeshy! This is our global conversation where everyone can connect.',
      originalLanguage: 'en',
      messageType: 'text'
    }
  });

  await prisma.message.create({
    data: {
      conversationId: globalConversation.id,
      senderId: aliceMartin.id,
      content: 'Bienvenue dans Meeshy ! Hâte de discuter avec tout le monde.',
      originalLanguage: 'fr',
      messageType: 'text'
    }
  });

  await prisma.message.create({
    data: {
      conversationId: globalConversation.id,
      senderId: takeshiNakamura.id,
      content: 'みなさん、こんにちは！よろしくお願いします。',
      originalLanguage: 'ja',
      messageType: 'text'
    }
  });

  await prisma.message.create({
    data: {
      conversationId: globalConversation.id,
      senderId: carlosRodriguez.id,
      content: '¡Hola mundo! Espero que podamos tener grandes conversaciones aquí.',
      originalLanguage: 'es',
      messageType: 'text'
    }
  });

  await prisma.message.create({
    data: {
      conversationId: globalConversation.id,
      senderId: liWei.id,
      content: '大家好！很高兴能在这里与全世界的朋友交流。',
      originalLanguage: 'zh',
      messageType: 'text'
    }
  });

  await prisma.message.create({
    data: {
      conversationId: globalConversation.id,
      senderId: hansSchmidt.id,
      content: 'Hallo alle zusammen! Ich freue mich auf den internationalen Austausch.',
      originalLanguage: 'de',
      messageType: 'text'
    }
  });

  await prisma.message.create({
    data: {
      conversationId: globalConversation.id,
      senderId: aminaHassan.id,
      content: 'مرحبا بالجميع! أتطلع إلى محادثات رائعة مع الجميع.',
      originalLanguage: 'ar',
      messageType: 'text'
    }
  });

  console.log('💬 Messages supplémentaires créés pour toutes les conversations');

  console.log('✅ Seeding terminé avec succès !');
  console.log(`
📊 Résumé du seeding :
- ${await prisma.user.count()} utilisateurs créés
- ${await prisma.conversation.count()} conversations créées
- ${await prisma.community.count()} communautés créées
- ${await prisma.message.count()} messages créés
- ${await prisma.messageTranslation.count()} traductions créées

🌍 CONVERSATION GLOBALE :
- "Meeshy" (ID: any) - Accessible à tous les utilisateurs

💬 CONVERSATIONS CRÉÉES :

📞 Conversations Privées :
- Alice Martin & Bob Johnson (Français/Anglais)
- Takeshi Nakamura & Li Wei (Japonais/Chinois)

👥 Groupes Thématiques :
- "International Business Team" (6 membres - BigBoss, Admin, équipe internationale)
- "Étudiants Internationaux" (4 membres - étudiants en France)
- "Tech Francophone" (4 membres - développeurs francophones)
- "Groupe Test Multilingue" (16 membres - utilisateurs test avec messages traduits)

🏢 Conversations Communautaires :
- "Communauté Française" → "Général - Communauté Française" (6 membres francophones)
- "Tech Community" → "General Discussion - Tech" (6 membres tech anglophones)

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
