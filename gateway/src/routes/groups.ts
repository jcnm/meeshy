/**
 * Routes Groupes / Communautés
 *
 * Ce module regroupe les endpoints liés à la gestion des communautés ("groups").
 * Une communauté est un conteneur logique permettant de rassembler des membres,
 * d'organiser des permissions et (à terme) d'agréger des conversations associées.
 *
 * Points clés:
 * - Les routes sont préfixées par `/groups`.
 * - Les conversations d'une communauté sont exposées via `GET /groups/:id/conversations`.
 * - Le schéma actuel n'établit pas encore une relation directe Group → Conversation.
 *   L'endpoint est donc présent pour compatibilité frontend et pourra être complété
 *   quand la relation sera définie (création/association de conversations au niveau
 *   d'une communauté).
 */
import { FastifyInstance } from 'fastify';

/**
 * Enregistre les routes de gestion des communautés (groups).
 * @param fastify Instance Fastify injectée par le serveur
 */
export async function groupRoutes(fastify: FastifyInstance) {
  // Route pour obtenir tous les groupes
  fastify.get('/groups', async (request, reply) => {
    reply.send({ message: 'Get all groups - to be implemented' });
  });

  // Route pour obtenir un groupe par ID
  fastify.get('/groups/:id', async (request, reply) => {
    reply.send({ message: 'Get group by ID - to be implemented' });
  });

  // Route pour créer un nouveau groupe
  fastify.post('/groups', async (request, reply) => {
    reply.send({ message: 'Create group - to be implemented' });
  });

  // Route pour obtenir les membres d'un groupe
  fastify.get('/groups/:id/members', async (request, reply) => {
    reply.send({ message: 'Get group members - to be implemented' });
  });

  // Route pour ajouter un membre au groupe
  fastify.post('/groups/:id/members', async (request, reply) => {
    reply.send({ message: 'Add group member - to be implemented' });
  });

  // Route pour retirer un membre du groupe
  fastify.delete('/groups/:id/members/:memberId', async (request, reply) => {
    reply.send({ message: 'Remove group member - to be implemented' });
  });

  // Route pour mettre à jour un groupe
  fastify.put('/groups/:id', async (request, reply) => {
    reply.send({ message: 'Update group - to be implemented' });
  });

  // Route pour supprimer un groupe
  fastify.delete('/groups/:id', async (request, reply) => {
    reply.send({ message: 'Delete group - to be implemented' });
  });

  // Conversations d'un groupe
  fastify.get('/groups/:id/conversations', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    try {
      // Schéma actuel: il n'y a pas de relation Group -> Conversation. On renvoie une liste vide pour compatibilité frontend.
      reply.send([]);
    } catch (error) {
      reply.status(500).send([]);
    }
  });
}
