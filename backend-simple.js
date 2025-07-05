const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: ['http://localhost:3001', 'http://localhost:3002', 'http://localhost:3003'],
  credentials: true
}));
app.use(express.json());

// Storage en mémoire
const users = new Map();
const usersByEmail = new Map();
const usersByPhone = new Map();
const conversationLinks = new Map();
const conversations = new Map();
const messages = new Map();

// Utilisateurs prédéfinis
const predefinedUsers = [
  {
    id: '1',
    username: 'Alice Martin',
    firstName: 'Alice',
    lastName: 'Martin',
    email: 'alice.martin@email.com',
    phoneNumber: '+33123456789',
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
    systemLanguage: 'en',
    regionalLanguage: 'en',
    autoTranslateEnabled: true,
    translateToSystemLanguage: true,
    translateToRegionalLanguage: false,
    useCustomDestination: false,
    isOnline: false,
    createdAt: new Date('2024-01-01'),
    lastActiveAt: new Date(),
  },
  {
    id: '3',
    username: 'Carlos Rodriguez',
    firstName: 'Carlos',
    lastName: 'Rodriguez',
    email: 'carlos.rodriguez@email.com',
    phoneNumber: '+34987654321',
    systemLanguage: 'es',
    regionalLanguage: 'es',
    autoTranslateEnabled: true,
    translateToSystemLanguage: true,
    translateToRegionalLanguage: false,
    useCustomDestination: false,
    isOnline: false,
    createdAt: new Date('2024-01-01'),
    lastActiveAt: new Date(),
  },
  {
    id: '4',
    username: 'Diana Kim',
    firstName: 'Diana',
    lastName: 'Kim',
    email: 'diana.kim@email.com',
    phoneNumber: '+821012345678',
    systemLanguage: 'ko',
    regionalLanguage: 'ko',
    autoTranslateEnabled: true,
    translateToSystemLanguage: true,
    translateToRegionalLanguage: false,
    useCustomDestination: false,
    isOnline: false,
    createdAt: new Date('2024-01-01'),
    lastActiveAt: new Date(),
  },
  {
    id: '5',
    username: 'Elena Rossi',
    firstName: 'Elena',
    lastName: 'Rossi',
    email: 'elena.rossi@email.com',
    phoneNumber: '+393331234567',
    systemLanguage: 'it',
    regionalLanguage: 'it',
    autoTranslateEnabled: true,
    translateToSystemLanguage: true,
    translateToRegionalLanguage: false,
    useCustomDestination: false,
    isOnline: false,
    createdAt: new Date('2024-01-01'),
    lastActiveAt: new Date(),
  }
];

// Initialisation des utilisateurs prédéfinis
predefinedUsers.forEach(user => {
  users.set(user.id, user);
  usersByEmail.set(user.email, user.id);
  usersByPhone.set(user.phoneNumber, user.id);
});

// Helper functions
function findUserByEmailOrPhone(email, phoneNumber) {
  const existingByEmail = usersByEmail.get(email);
  const existingByPhone = usersByPhone.get(phoneNumber);
  
  if (existingByEmail) {
    return users.get(existingByEmail);
  }
  if (existingByPhone) {
    return users.get(existingByPhone);
  }
  
  return null;
}

function createUser(userData) {
  const userId = uuidv4();
  const user = {
    id: userId,
    username: `${userData.firstName} ${userData.lastName}`,
    firstName: userData.firstName,
    lastName: userData.lastName,
    email: userData.email,
    phoneNumber: userData.phoneNumber,
    systemLanguage: userData.spokenLanguage,
    regionalLanguage: userData.spokenLanguage,
    customDestinationLanguage: userData.receiveLanguage !== userData.spokenLanguage ? userData.receiveLanguage : null,
    autoTranslateEnabled: true,
    translateToSystemLanguage: userData.receiveLanguage === userData.spokenLanguage,
    translateToRegionalLanguage: false,
    useCustomDestination: userData.receiveLanguage !== userData.spokenLanguage,
    isOnline: false,
    createdAt: new Date(),
    lastActiveAt: new Date(),
  };

  users.set(userId, user);
  usersByEmail.set(user.email, userId);
  usersByPhone.set(user.phoneNumber, userId);

  return user;
}

// Routes

// GET /users - Récupérer tous les utilisateurs
app.get('/users', (req, res) => {
  const allUsers = Array.from(users.values()).map(user => ({
    ...user,
    // Ne pas exposer les informations sensibles
    email: user.email.replace(/(.{2}).*(@.*)/, '$1***$2'),
    phoneNumber: user.phoneNumber.replace(/(.{3}).*(.{2})/, '$1***$2')
  }));
  
  res.json(allUsers);
});

// GET /users/:id - Récupérer un utilisateur par ID
app.get('/users/:id', (req, res) => {
  const user = users.get(req.params.id);
  if (!user) {
    return res.status(404).json({ message: 'Utilisateur non trouvé' });
  }
  
  res.json(user);
});

// POST /users - Créer un nouvel utilisateur
app.post('/users', (req, res) => {
  const { firstName, lastName, email, phoneNumber, spokenLanguage, receiveLanguage } = req.body;
  
  if (!firstName || !lastName || !email || !phoneNumber || !spokenLanguage || !receiveLanguage) {
    return res.status(400).json({ message: 'Tous les champs sont requis' });
  }

  // Vérifier si l'utilisateur existe déjà
  const existingUser = findUserByEmailOrPhone(email, phoneNumber);
  if (existingUser) {
    return res.status(409).json({ 
      message: 'Un utilisateur avec cet email ou ce numéro de téléphone existe déjà',
      existingUser: {
        id: existingUser.id,
        firstName: existingUser.firstName,
        lastName: existingUser.lastName,
        email: existingUser.email,
        phoneNumber: existingUser.phoneNumber
      }
    });
  }

  try {
    const newUser = createUser(req.body);
    res.status(201).json(newUser);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la création de l\'utilisateur' });
  }
});

// POST /conversation/link - Créer un lien d'invitation
app.post('/conversation/link', (req, res) => {
  const { createdBy } = req.body;
  
  if (!createdBy) {
    return res.status(400).json({ message: 'L\'ID du créateur est requis' });
  }

  const creator = users.get(createdBy);
  if (!creator) {
    return res.status(404).json({ message: 'Créateur non trouvé' });
  }

  const linkId = uuidv4();
  const conversationLink = {
    id: linkId,
    createdBy,
    participants: [createdBy],
    isActive: true,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24h
  };

  conversationLinks.set(linkId, conversationLink);
  
  res.status(201).json(conversationLink);
});

// POST /conversation/join - Rejoindre une conversation via un lien
app.post('/conversation/join', (req, res) => {
  const { firstName, lastName, email, phoneNumber, spokenLanguage, receiveLanguage, conversationLinkId } = req.body;
  
  if (!firstName || !lastName || !email || !phoneNumber || !spokenLanguage || !receiveLanguage || !conversationLinkId) {
    return res.status(400).json({ message: 'Tous les champs sont requis' });
  }

  // Vérifier si le lien existe et est actif
  const link = conversationLinks.get(conversationLinkId);
  if (!link) {
    return res.status(404).json({ message: 'Lien d\'invitation non trouvé' });
  }

  if (!link.isActive || (link.expiresAt && new Date() > link.expiresAt)) {
    return res.status(400).json({ message: 'Lien d\'invitation expiré ou inactif' });
  }

  let user;
  
  // Vérifier si l'utilisateur existe déjà
  const existingUser = findUserByEmailOrPhone(email, phoneNumber);
  if (existingUser) {
    user = existingUser;
    
    // Mettre à jour la dernière activité
    user.lastActiveAt = new Date();
    users.set(user.id, user);
  } else {
    // Créer un nouvel utilisateur
    user = createUser({ firstName, lastName, email, phoneNumber, spokenLanguage, receiveLanguage });
  }

  // Ajouter l'utilisateur aux participants s'il n'y est pas déjà
  if (!link.participants.includes(user.id)) {
    link.participants.push(user.id);
    conversationLinks.set(conversationLinkId, link);
  }

  // Créer ou récupérer la conversation
  let conversation = Array.from(conversations.values()).find(conv => conv.linkId === conversationLinkId);
  
  if (!conversation) {
    const conversationId = uuidv4();
    conversation = {
      id: conversationId,
      linkId: conversationLinkId,
      participants: [...link.participants],
      messages: [],
      createdAt: new Date(),
      lastMessageAt: new Date()
    };
    conversations.set(conversationId, conversation);
    messages.set(conversationId, []);
  } else {
    // S'assurer que l'utilisateur est dans la conversation
    if (!conversation.participants.includes(user.id)) {
      conversation.participants.push(user.id);
      conversations.set(conversation.id, conversation);
    }
  }

  res.json({
    user,
    conversation,
    link,
    isExistingUser: !!existingUser
  });
});

// GET /conversation/link/:linkId - Récupérer les détails d'un lien
app.get('/conversation/link/:linkId', (req, res) => {
  const link = conversationLinks.get(req.params.linkId);
  if (!link) {
    return res.status(404).json({ message: 'Lien non trouvé' });
  }

  // Récupérer les informations des participants
  const participants = link.participants.map(userId => {
    const user = users.get(userId);
    return user ? {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      systemLanguage: user.systemLanguage
    } : null;
  }).filter(Boolean);

  res.json({
    ...link,
    participants
  });
});

// GET /users/:userId/links - Récupérer les liens créés par un utilisateur
app.get('/users/:userId/links', (req, res) => {
  const userId = req.params.userId;
  const user = users.get(userId);
  
  if (!user) {
    return res.status(404).json({ message: 'Utilisateur non trouvé' });
  }

  const userLinks = Array.from(conversationLinks.values())
    .filter(link => link.createdBy === userId)
    .map(link => {
      const participants = link.participants.map(participantId => {
        const participant = users.get(participantId);
        return participant ? {
          id: participant.id,
          firstName: participant.firstName,
          lastName: participant.lastName,
          username: participant.username,
          systemLanguage: participant.systemLanguage
        } : null;
      }).filter(Boolean);

      return {
        ...link,
        participants
      };
    });

  res.json(userLinks);
});

// GET /users/:userId/conversations - Récupérer les conversations d'un utilisateur
app.get('/users/:userId/conversations', (req, res) => {
  const userId = req.params.userId;
  const user = users.get(userId);
  
  if (!user) {
    return res.status(404).json({ message: 'Utilisateur non trouvé' });
  }

  const userConversations = Array.from(conversations.values())
    .filter(conversation => conversation.participants.includes(userId))
    .map(conversation => {
      const participants = conversation.participants.map(participantId => {
        const participant = users.get(participantId);
        return participant ? {
          id: participant.id,
          firstName: participant.firstName,
          lastName: participant.lastName,
          username: participant.username,
          systemLanguage: participant.systemLanguage,
          isOnline: participant.isOnline
        } : null;
      }).filter(Boolean);

      const conversationMessages = messages.get(conversation.id) || [];

      return {
        ...conversation,
        participants,
        messages: conversationMessages
      };
    });

  res.json(userConversations);
});

// POST /conversations/:conversationId/messages - Envoyer un message
app.post('/conversations/:conversationId/messages', (req, res) => {
  const { conversationId } = req.params;
  const { senderId, content, originalLanguage } = req.body;

  if (!senderId || !content || !originalLanguage) {
    return res.status(400).json({ message: 'Données de message incomplètes' });
  }

  const conversation = conversations.get(conversationId);
  if (!conversation) {
    return res.status(404).json({ message: 'Conversation non trouvée' });
  }

  if (!conversation.participants.includes(senderId)) {
    return res.status(403).json({ message: 'Vous n\'êtes pas membre de cette conversation' });
  }

  const messageId = uuidv4();
  const message = {
    id: messageId,
    conversationId,
    senderId,
    content,
    timestamp: new Date(),
    originalLanguage
  };

  // Ajouter le message à la liste des messages
  const conversationMessages = messages.get(conversationId) || [];
  conversationMessages.push(message);
  messages.set(conversationId, conversationMessages);

  // Mettre à jour la conversation
  conversation.lastMessageAt = new Date();
  conversations.set(conversationId, conversation);

  res.status(201).json(message);
});

// GET /conversations/:conversationId/messages - Récupérer les messages d'une conversation
app.get('/conversations/:conversationId/messages', (req, res) => {
  const { conversationId } = req.params;

  const conversation = conversations.get(conversationId);
  if (!conversation) {
    return res.status(404).json({ message: 'Conversation non trouvée' });
  }

  const conversationMessages = messages.get(conversationId) || [];
  res.json(conversationMessages);
});

// Gestion d'erreur globale
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Erreur interne du serveur' });
});

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`Serveur backend simplifié démarré sur le port ${PORT}`);
  console.log(`Utilisateurs prédéfinis chargés: ${predefinedUsers.length}`);
  console.log('CORS configuré pour les ports 3001, 3002, 3003');
});

module.exports = app;
