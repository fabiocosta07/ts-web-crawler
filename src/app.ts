import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { authRouter } from './routes/auth.js';
import { crawlJobsRouter } from './routes/crawl-jobs.js';
import { authMiddleware } from './middleware/auth.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const openApiSpec = JSON.parse(
  readFileSync(join(__dirname, 'openapi.json'), 'utf-8'),
);

export const app = express();

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

// Swagger UI (public)
app.use('/swagger', swaggerUi.serve, swaggerUi.setup(openApiSpec));
app.get('/api/openapi.json', (_req, res) => res.json(openApiSpec));

// Auth routes (public)
app.use('/api', authRouter);

// Protected routes
app.use('/api/crawl-jobs', authMiddleware, crawlJobsRouter);
