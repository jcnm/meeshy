const { createServer } = require('https');
const { parse } = require('url');
const next = require('next');
const fs = require('fs');
const path = require('path');

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || 'localhost';
const port = parseInt(process.env.PORT || '3100', 10);

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
      console.log(`> ✅ Ready on https://${hostname}:${port}`);
      console.log(`> 📱 Access from iPhone: https://192.168.1.39:${port}`);
      console.log(`> 💻 Access locally: https://localhost:${port}`);
    });
});
