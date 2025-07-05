import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { globalValidationPipe } from './common/validation.pipe';
import { GlobalExceptionFilter } from './common/exception.filter';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Configuration CORS sécurisée
  const allowedOrigins = process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3200', 'http://localhost:3000'];
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  });

  // Middlewares globaux de sécurité
  app.useGlobalPipes(globalValidationPipe);
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Démarrage du serveur
  const port = process.env.PORT || 3001;
  await app.listen(port);
  
  logger.log(`🚀 Serveur Meeshy démarré sur le port ${port}`);
  logger.log(`📊 Environnement: ${process.env.NODE_ENV || 'development'}`);
  logger.log(`🌐 CORS autorisé pour: ${allowedOrigins.join(', ')}`);
}

bootstrap().catch((error) => {
  console.error('❌ Erreur au démarrage du serveur:', error);
  process.exit(1);
});
