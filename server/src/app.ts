import express, { Express } from 'express';
import cors from 'cors';
import { config } from './config/index.js';
import healthRoutes from './routes/health.routes.js';
import { errorHandler } from './middleware/errorHandler.js';

const app: Express = express();

// Global Middlewares
app.use(cors({
  origin: config.clientUrl,
  credentials: true,
}));
app.use(express.json());

// Routes
// Simple health endpoint required: GET /health
app.use('/health', healthRoutes);
// Also support under apiPrefix for standard routing
app.use(`${config.apiPrefix}/health`, healthRoutes);

// Error Handling
app.use(errorHandler);

export default app;
