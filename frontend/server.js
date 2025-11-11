// Load environment variables from .env file
require('dotenv').config();

const { createServer } = require('https');
const { parse } = require('url');
const next = require('next');
const fs = require('fs');
const path = require('path');

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || 'smpdev02.local';
const port = parseInt(process.env.PORT || '3100', 10);
const localIp = process.env.LOCAL_IP || 'smpdev02.local'; // IP locale pour accès réseau
const domain = process.env.DOMAIN || 'smpdev02.local'; // Domaine local personnalisé

// Créer l'app Next.js
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  // Charger les certificats SSL
  const httpsOptions = {
    key: fs.readFileSync(path.join(__dirname, '.cert', 'localhost-key.pem')),
    cert: fs.readFileSync(path.join(__dirname, '.cert', 'localhost.pem')),
  };

  // Créer le serveur HTTPS
  createServer(httpsOptions, async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  })
    .once('error', (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, '0.0.0.0', () => {
      if (domain !== 'smpdev02.local') {
      }
    });
});
