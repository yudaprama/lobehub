import { createExpressMiddleware } from '@trpc/server/adapters/express';
import cors from 'cors';
import express from 'express';

import { createContext } from './context.js';
import { appRouter } from './router.js';

const app = express();
const PORT = process.env.PORT || 3210;

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  }),
);

app.use(
  '/trpc',
  createExpressMiddleware({
    router: appRouter,
    createContext,
  }),
);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.info(`🚀 Server running at http://localhost:${PORT}`);
  console.info(`📡 tRPC endpoint: http://localhost:${PORT}/trpc`);
  console.info(`💚 Health check: http://localhost:${PORT}/health`);
});
