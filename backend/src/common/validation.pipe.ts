import { ValidationPipe } from '@nestjs/common';

export const globalValidationPipe = new ValidationPipe({
  whitelist: true, // Supprimer les propriétés non définies dans le DTO
  forbidNonWhitelisted: true, // Lancer une erreur si des propriétés non autorisées sont présentes
  transform: true, // Transformer automatiquement les types (string -> number par exemple)
  transformOptions: {
    enableImplicitConversion: true, // Conversion automatique des types
  },
  disableErrorMessages: process.env.NODE_ENV === 'production', // Cacher les détails en production
});
