import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import helmet from 'helmet';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Sécurité avec Helmet
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
    crossOriginEmbedderPolicy: false, // Pour les WebSockets
  }));

  // Configuration CORS sécurisée
  const allowedOrigins = process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3100', 'http://localhost:3000', 'http://localhost:3300'];
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['X-RateLimit-Remaining', 'X-RateLimit-Limit'],
  });

  // Démarrage du serveur
  const port = process.env.PORT || 3000;
  await app.listen(port);
  
  logger.log(`🚀 Serveur Meeshy démarré sur le port ${port}`);
  logger.log(`📊 Environnement: ${process.env.NODE_ENV || 'development'}`);
  logger.log(`🌐 CORS autorisé pour: ${allowedOrigins.join(', ')}`);
  logger.log(`🔒 Sécurité: Helmet activé, Rate limiting configuré`);
  logger.log(`🛡️ JWT: ${process.env.JWT_EXPIRES_IN || '1h'} expiration`);
}

bootstrap().catch((error) => {
  console.error('❌ Erreur au démarrage du serveur:', error);
  process.exit(1);
});
