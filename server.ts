import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleCanteenApiRequest } from './src/server/canteenServerPlugin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(async (req, res, next) => {
  const handled = await handleCanteenApiRequest(req, res);
  if (!handled) {
    next();
  }
});

const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));
app.get('*', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Saptien · SAPTHAGIRI NPS UNIVERSITY server listening on port ${PORT}`);
});
