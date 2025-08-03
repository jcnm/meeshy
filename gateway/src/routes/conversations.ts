import { FastifyInstance } from 'fastify';

export async function conversationRoutes(fastify: FastifyInstance) {
  // Route pour obtenir toutes les conversations
  fastify.get('/conversations', async (request, reply) => {
    reply.send({ message: 'Get all conversations - to be implemented' });
  });

  // Route pour obtenir une conversation par ID
  fastify.get('/conversations/:id', async (request, reply) => {
    reply.send({ message: 'Get conversation by ID - to be implemented' });
  });

  // Route pour créer une nouvelle conversation
  fastify.post('/conversations', async (request, reply) => {
    reply.send({ message: 'Create conversation - to be implemented' });
  });

  // Route pour obtenir les messages d'une conversation
  fastify.get('/conversations/:id/messages', async (request, reply) => {
    reply.send({ message: 'Get conversation messages - to be implemented' });
  });

  // Route pour envoyer un message dans une conversation
  fastify.post('/conversations/:id/messages', async (request, reply) => {
    reply.send({ message: 'Send message - to be implemented' });
  });

  // Route pour mettre à jour une conversation
  fastify.put('/conversations/:id', async (request, reply) => {
    reply.send({ message: 'Update conversation - to be implemented' });
  });

  // Route pour supprimer une conversation
  fastify.delete('/conversations/:id', async (request, reply) => {
    reply.send({ message: 'Delete conversation - to be implemented' });
  });
}
