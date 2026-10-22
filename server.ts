import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // JSON body parser with generous limit for logo images
  app.use(express.json({ limit: '15mb' }));
  app.use(express.urlencoded({ extended: true, limit: '15mb' }));

  // Path to site logo files
  const siteLogoTsPath = path.join(__dirname, 'src', 'assets', 'siteLogo.ts');
  const siteLogoPngPath = path.join(__dirname, 'public', 'site-logo.png');

  // Load existing logo if present
  let currentSiteLogo = '';
  try {
    if (fs.existsSync(siteLogoTsPath)) {
      const content = fs.readFileSync(siteLogoTsPath, 'utf-8');
      const match = content.match(/export const defaultSiteLogo: string = (["'`])([\s\S]*?)\1;/);
      if (match && match[2]) {
        currentSiteLogo = match[2];
      }
    }
  } catch (err) {
    console.warn('Notice reading initial siteLogo.ts:', err);
  }

  // API Route: Get current site logo
  app.get('/api/site-logo', (req, res) => {
    res.json({ siteLogo: currentSiteLogo });
  });

  // API Route: Save site logo permanently to server, file, and public assets
  app.post('/api/save-logo', (req, res) => {
    try {
      const { siteLogo } = req.body;
      const logoToSave = typeof siteLogo === 'string' ? siteLogo.trim() : '';

      currentSiteLogo = logoToSave;

      // 1. Update src/assets/siteLogo.ts so it is committed to git & baked into production builds
      const tsContent = `// Auto-generated site logo persistent storage\nexport const defaultSiteLogo: string = ${JSON.stringify(logoToSave)};\n`;
      fs.writeFileSync(siteLogoTsPath, tsContent, 'utf-8');

      // 2. If it is a base64 image, save as public/site-logo.png
      if (logoToSave.startsWith('data:image/')) {
        const base64Data = logoToSave.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        fs.writeFileSync(siteLogoPngPath, buffer);
      } else if (!logoToSave) {
        if (fs.existsSync(siteLogoPngPath)) {
          fs.unlinkSync(siteLogoPngPath);
        }
      }

      console.log('Site logo saved to server and disk successfully');
      res.json({ success: true, siteLogo: currentSiteLogo });
    } catch (err: any) {
      console.warn('Error saving site logo to disk:', err);
      res.status(500).json({ success: false, error: err?.message || 'Failed to save logo to disk' });
    }
  });

  // In development, mount Vite middleware
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // In production, serve dist folder
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
