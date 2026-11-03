import http from 'node:http';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env.js';
import { connectRedis } from './lib/redis.js';
import { createSocketServer } from './lib/socket.js';
import prisma from './lib/prisma.js';
import apiRouter from './routes/index.js';
import healthRouter from './routes/health.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { openApiDocument } from './openapi.js';

// Importing this module never connects services or starts a listener.
export async function createApp() {
  if (!env.databaseUrl || env.jwtSecret.length < 32) throw new Error('DATABASE_URL and a JWT_SECRET of at least 32 characters are required');
  await prisma.$connect();
  await connectRedis();
  const app = express();
  app.use(helmet());
  app.use(cors({ origin: env.corsOrigin, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(morgan('dev'));
  app.get('/openapi.json', (_req, res) => res.json(openApiDocument));
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiDocument));
  app.use('/', healthRouter);
  app.use('/api/v1', apiRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);
  const server = http.createServer(app);
  const io = createSocketServer(server);
  app.locals.io = io;
  return Object.assign(server, { io });
}
export default createApp;
