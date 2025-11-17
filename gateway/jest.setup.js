// Configuration Jest pour les tests unitaires du service Fastify

// Configuration des timeouts pour les tests
jest.setTimeout(30000);

// Mock des variables d'environnement pour les tests
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'mongodb://localhost:27017/meeshy-test';
process.env.JWT_SECRET = 'test-jwt-secret-for-meeshy-testing-purposes-only';
process.env.GRPC_SERVER_URL = 'localhost:50051';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.PORT = '3001';
process.env.MLS_MASTER_KEY = 'a'.repeat(64); // 64 char hex for testing

// Reset des mocks après chaque test
afterEach(() => {
  jest.clearAllMocks();
});
