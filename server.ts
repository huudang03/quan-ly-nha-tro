import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import cors from 'cors';
import { exec } from 'child_process';
import apiRouter from './src/routes/api';
import { requestLogger, errorHandler, sendSuccess, sendError } from './src/middleware/common';
import { InvoiceService } from './src/services/invoiceService';
import { initDatabase } from './src/initDatabase';

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

async function startServer() {
  console.log('[SERVER] Starting startup sequence...');
  
  const app = express();
  const server = createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws-payment' });
  const PORT = Number(process.env.PORT) || 3000;

  // 2. Middleware
  const whitelist = [
    process.env.APP_URL,
    process.env.CLIENT_URL,
    process.env.VITE_API_URL
  ].filter(Boolean) as string[];

  if (process.env.NODE_ENV !== 'production') {
    whitelist.push('http://localhost:3000', 'http://localhost:5173');
  }
  
  app.use(cors({
    origin: function (origin, callback) {
      if (!origin || whitelist.indexOf(origin) !== -1 || origin.includes('render.com') || origin.includes('vercel.app')) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    }
  }));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(requestLogger);

  // Serve uploads directory - ensure it's handled before other routes
  const uploadsPath = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsPath)) {
    fs.mkdirSync(uploadsPath, { recursive: true });
  }
  app.use('/uploads', (req, res, next) => {
    console.log(`[SERVER] Static file request: ${req.url}`);
    next();
  }, express.static(uploadsPath));

  // 3. WebSocket Setup
  const clients = new Set<WebSocket>();
  wss.on('connection', (ws) => {
    clients.add(ws);
    ws.on('close', () => clients.delete(ws));
  });

  const notifyClients = (payload: any) => {
    const message = JSON.stringify({ type: 'STATUS_UPDATED', payload });
    clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) client.send(message);
    });
  };

  // 4. Webhook Handler
  app.all(['/api/webhooks/payment', '/api/webhooks/payment/'], async (req, res) => {
    console.log('[WEBHOOK] Received payment notification');
    
    if (req.method === 'GET') {
      return res.status(200).send('<h1>Webhook Active!</h1>');
    }

    const { amount, transferAmount, content, description, amount_in, value, id: transactionId } = req.body;
    const paymentContent = (content || description || '').toUpperCase();
    const paymentAmount = parseFloat(amount || transferAmount || amount_in || value || 0);

    // Parse HDxxxTxx or TROTIENxxxTxx...
    // SePay sends the content from bank, user might attach extra strings
    // We try to extract the code
    const match = paymentContent.match(/(TROTIEN\d+T\d{2}\d{3}|HD\d+T\d{2})/);
    
    if (match && paymentAmount > 0) {
      const code = match[1];

      console.log(`[WEBHOOK] Processing: Code ${code}, Amount ${paymentAmount}, TxID: ${transactionId}`);

      try {
        const result = await InvoiceService.updatePaymentStatusByCode(code, paymentAmount, transactionId);
        if (result) {
          notifyClients({ status: 'paid', ...result });
          return sendSuccess(res, { status: 'processed', transactionId });
        } else {
          console.log(`[WEBHOOK SKIP] Invoice already paid or not found for ${code}. Transaction: ${transactionId}`);
          return sendSuccess(res, { status: 'skipped_or_already_paid', transactionId });
        }
      } catch (err: any) {
        console.error('[WEBHOOK ERROR]', err.message);
        return sendError(res, err.message, 500);
      }
    }

    return sendSuccess(res, { status: 'ignored' });
  });

  // 5. API Routes
  app.use('/api', apiRouter);

  // 6. Vite / Static Files
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  // 7. Global Error Handler
  app.use(errorHandler);

  await initDatabase();

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[SERVER] Running on http://localhost:${PORT}`);
    if (process.env.NODE_ENV !== 'production') {
      const url = `http://localhost:${PORT}`;
      const startCmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
      exec(`${startCmd} ${url}`);
    }
  });
}

startServer().catch(err => {
  console.error('[SERVER ERROR] Startup failed:', err);
});
