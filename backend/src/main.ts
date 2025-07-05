import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    cors: {
      origin: ['http://localhost:3200', 'http://localhost:3000'],
      credentials: true,
    },
  });

  await app.listen(3100);
  console.log('Serveur NestJS démarré sur http://localhost:3100');
}

bootstrap();
