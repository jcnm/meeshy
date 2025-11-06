const { createServer } = require('https');
const { createServer: createHttpServer } = require('http');
const fs = require('fs');
const path = require('path');
const express = require('express');

// Charger l'application NestJS
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('./dist/app.module');

const port = parseInt(process.env.PORT || '3000', 10);
const useHttps = process.env.USE_HTTPS === 'true';
const localIp = process.env.LOCAL_IP || '192.168.1.39';
const domain = process.env.DOMAIN || 'localhost';

async function bootstrap() {
  // Créer l'application NestJS
  const app = await NestFactory.create(AppModule);

  // Activer CORS
  app.enableCors({
    origin: process.env.CORS_ORIGINS?.split(',') || [
      'http://localhost:3100',
      'https://localhost:3100',
      `https://${localIp}:3100`,
    ],
    credentials: true,
  });

  // Obtenir l'instance Express sous-jacente
  const expressApp = app.getHttpAdapter().getInstance();

  if (useHttps) {
    // Mode HTTPS
    const certPath = path.join(__dirname, '..', 'frontend', '.cert');

    if (!fs.existsSync(path.join(certPath, 'localhost-key.pem'))) {
      console.error('❌ Certificats SSL non trouvés pour le gateway !');
      console.error('   Les certificats du frontend seront utilisés.');
      console.error('   Assurez-vous que frontend/.cert/ contient les certificats.');
      process.exit(1);
    }

    const httpsOptions = {
      key: fs.readFileSync(path.join(certPath, 'localhost-key.pem')),
      cert: fs.readFileSync(path.join(certPath, 'localhost.pem')),
    };

    const httpsServer = createServer(httpsOptions, expressApp);

    await app.init();

    httpsServer.listen(port, '0.0.0.0', () => {
      console.log(`> ✅ Gateway ready on https://localhost:${port} 🔒`);
      console.log(`> 📱 Network access: https://${localIp}:${port}`);
      console.log(`> 💻 Local access: https://localhost:${port}`);
      if (domain !== 'localhost') {
        console.log(`> 🌐 Custom domain: https://${domain}:${port}`);
      }
      console.log(`> 🔌 WebSocket: wss://localhost:${port}`);
    });
  } else {
    // Mode HTTP standard
    await app.listen(port, '0.0.0.0');
    console.log(`> ✅ Gateway ready on http://localhost:${port}`);
    console.log(`> 📱 Network access: http://${localIp}:${port}`);
    console.log(`> 🔌 WebSocket: ws://localhost:${port}`);
  }
}

bootstrap().catch((err) => {
  console.error('Failed to start gateway:', err);
  process.exit(1);
});
