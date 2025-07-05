import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { UserService } from './user.service';
import { ConversationService } from './conversation.service';
import { ApiResponse, CreateUserDto } from './types';

const app = express();
const PORT = process.env.PORT || 3002;

// Services
const userService = new UserService();
const conversationService = new ConversationService();

// Middleware
app.use(cors({
  origin: ['http://localhost:3001', 'http://localhost:3002', 'http://localhost:3003'],
  credentials: true
}));
app.use(express.json());

// Logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Routes utilisateurs
app.get('/users', (req: Request, res: Response) => {
  try {
    const users = userService.getAllUsers();
    const response: ApiResponse = {
      success: true,
      data: users
    };
    res.json(response);
  } catch (error) {
    console.error('Erreur récupération utilisateurs:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Erreur serveur'
    };
    res.status(500).json(response);
  }
});

app.get('/users/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = userService.getUserById(id);
    
    if (!user) {
      const response: ApiResponse = {
        success: false,
        error: 'Utilisateur non trouvé'
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse = {
      success: true,
      data: user
    };
    res.json(response);
  } catch (error) {
    console.error('Erreur récupération utilisateur:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Erreur serveur'
    };
    res.status(500).json(response);
  }
});

// Routes liens de conversation
app.post('/conversation/create-link', (req: Request, res: Response) => {
  try {
    const { userId, expiresInHours } = req.body;
    
    const user = userService.getUserById(userId);
    if (!user) {
      const response: ApiResponse = {
        success: false,
        error: 'Utilisateur non trouvé'
      };
      return res.status(404).json(response);
    }

    const link = conversationService.createConversationLink(userId, expiresInHours || 24 * 7);
    const linkUrl = `${process.env.FRONTEND_URL || 'http://localhost:3001'}/join/${link.id}`;

    const response: ApiResponse = {
      success: true,
      data: {
        link: { ...link, url: linkUrl },
        url: linkUrl
      }
    };
    res.json(response);
  } catch (error) {
    console.error('Erreur création lien:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Erreur lors de la création du lien'
    };
    res.status(500).json(response);
  }
});

app.get('/conversation/link/:linkId', (req: Request, res: Response) => {
  try {
    const { linkId } = req.params;
    const link = conversationService.getConversationLink(linkId);
    
    if (!link) {
      const response: ApiResponse = {
        success: false,
        error: 'Lien non trouvé ou expiré'
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse = {
      success: true,
      data: link
    };
    res.json(response);
  } catch (error) {
    console.error('Erreur récupération lien:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Erreur lors de la récupération du lien'
    };
    res.status(500).json(response);
  }
});

app.post('/conversation/join', (req: Request, res: Response) => {
  try {
    const { linkId, userData, userId } = req.body;

    // Si un userId est fourni, utiliser l'utilisateur existant
    if (userId) {
      const user = userService.getUserById(userId);
      if (!user) {
        const response: ApiResponse = {
          success: false,
          error: 'Utilisateur non trouvé'
        };
        return res.status(404).json(response);
      }

      const conversation = conversationService.joinConversationViaLink(linkId, userId);
      if (!conversation) {
        const response: ApiResponse = {
          success: false,
          error: 'Impossible de rejoindre la conversation'
        };
        return res.status(400).json(response);
      }

      const response: ApiResponse = {
        success: true,
        data: {
          user,
          conversation,
          isNewUser: false
        }
      };
      return res.json(response);
    }

    // Si des données utilisateur sont fournies, créer ou trouver l'utilisateur
    if (userData) {
      const createUserData = userData as CreateUserDto;
      
      // Vérifier si un utilisateur existe déjà
      const existingUser = userService.findExistingUser(createUserData.email, createUserData.phoneNumber);
      
      if (existingUser) {
        // Utilisateur existant trouvé
        const conversation = conversationService.joinConversationViaLink(linkId, existingUser.id);
        if (!conversation) {
          const response: ApiResponse = {
            success: false,
            error: 'Impossible de rejoindre la conversation'
          };
          return res.status(400).json(response);
        }

        const response: ApiResponse = {
          success: true,
          data: {
            user: existingUser,
            conversation,
            isNewUser: false,
            existingUserFound: true
          }
        };
        return res.json(response);
      }

      // Créer un nouvel utilisateur
      const newUser = userService.createUser(createUserData);
      const conversation = conversationService.joinConversationViaLink(linkId, newUser.id);
      
      if (!conversation) {
        const response: ApiResponse = {
          success: false,
          error: 'Impossible de rejoindre la conversation'
        };
        return res.status(400).json(response);
      }

      const response: ApiResponse = {
        success: true,
        data: {
          user: newUser,
          conversation,
          isNewUser: true
        }
      };
      return res.json(response);
    }

    const response: ApiResponse = {
      success: false,
      error: 'Données manquantes'
    };
    res.status(400).json(response);
  } catch (error) {
    console.error('Erreur rejoindre conversation:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Erreur lors de la connexion'
    };
    res.status(500).json(response);
  }
});

app.get('/conversation/user/:userId', (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const user = userService.getUserById(userId);
    
    if (!user) {
      const response: ApiResponse = {
        success: false,
        error: 'Utilisateur non trouvé'
      };
      return res.status(404).json(response);
    }

    const conversations = conversationService.getUserConversations(userId);
    const conversationsWithDetails = conversations.map(conv => ({
      ...conv,
      participants: conv.participants.map(id => userService.getUserById(id)).filter(Boolean),
      messageCount: conversationService.getConversationMessages(conv.id, userId).length
    }));

    const response: ApiResponse = {
      success: true,
      data: conversationsWithDetails
    };
    res.json(response);
  } catch (error) {
    console.error('Erreur récupération conversations:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Erreur lors de la récupération des conversations'
    };
    res.status(500).json(response);
  }
});

app.get('/conversation/user/:userId/links', (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const user = userService.getUserById(userId);
    
    if (!user) {
      const response: ApiResponse = {
        success: false,
        error: 'Utilisateur non trouvé'
      };
      return res.status(404).json(response);
    }

    const links = conversationService.getUserConversationLinks(userId);
    const linksWithUrls = links.map(link => ({
      ...link,
      url: `${process.env.FRONTEND_URL || 'http://localhost:3001'}/join/${link.id}`
    }));

    const response: ApiResponse = {
      success: true,
      data: linksWithUrls
    };
    res.json(response);
  } catch (error) {
    console.error('Erreur récupération liens:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Erreur lors de la récupération des liens'
    };
    res.status(500).json(response);
  }
});

app.get('/conversation/:conversationId/messages', (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params;
    const { userId } = req.query;
    
    if (!userId || typeof userId !== 'string') {
      const response: ApiResponse = {
        success: false,
        error: 'ID utilisateur requis'
      };
      return res.status(400).json(response);
    }

    const messages = conversationService.getConversationMessages(conversationId, userId);
    const messagesWithSender = messages.map(msg => ({
      ...msg,
      sender: userService.getUserById(msg.senderId)
    }));

    const response: ApiResponse = {
      success: true,
      data: messagesWithSender
    };
    res.json(response);
  } catch (error) {
    console.error('Erreur récupération messages:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Erreur lors de la récupération des messages'
    };
    res.status(500).json(response);
  }
});

// Nettoyage périodique des liens expirés
setInterval(() => {
  conversationService.cleanupExpiredLinks();
}, 60 * 60 * 1000); // Toutes les heures

// Gestion des erreurs
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  console.error('Erreur serveur:', err);
  const response: ApiResponse = {
    success: false,
    error: 'Erreur interne du serveur'
  };
  res.status(500).json(response);
});

// Route 404
app.use((req: Request, res: Response) => {
  const response: ApiResponse = {
    success: false,
    error: 'Route non trouvée'
  };
  res.status(404).json(response);
});

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`🚀 Serveur Meeshy Simple Backend démarré sur le port ${PORT}`);
  console.log(`📡 API disponible sur http://localhost:${PORT}`);
  console.log(`🌐 Interface web sur http://localhost:3001`);
  console.log(`📚 Health check: http://localhost:${PORT}/health`);
});

export default app;
