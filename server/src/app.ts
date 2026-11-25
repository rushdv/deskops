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

// Auth Routes: /api/v1/auth
import authRoutes from './routes/auth.routes.js';
app.use(`${config.apiPrefix}/auth`, authRoutes);

// Ticket Routes: /api/v1/tickets
import ticketRoutes from './routes/ticket.routes.js';
app.use(`${config.apiPrefix}/tickets`, ticketRoutes);

// Property Routes: /api/v1/properties
import propertyRoutes from './routes/property.routes.js';
app.use(`${config.apiPrefix}/properties`, propertyRoutes);

// Attachment Routes: /api/v1/attachments
import attachmentRoutes from './routes/attachment.routes.js';
app.use(`${config.apiPrefix}/attachments`, attachmentRoutes);

// Interactive OpenAPI Documentation (NFR-04, D-1.4)
import swaggerUi from 'swagger-ui-express';
import { openApiSpec } from './docs/openapi.js';
app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));
app.get('/docs.json', (_req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(openApiSpec);
});

// Error Handling
app.use(errorHandler);

export default app;
