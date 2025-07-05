import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    cors: {
      origin: ['http://localhost:3000', 'http://localhost:3002'],
      credentials: true,
    },
  });

  await app.listen(3002);
  console.log('Serveur NestJS démarré sur http://localhost:3002');
}

bootstrap();
