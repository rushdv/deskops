import app from './app.js';
import { config } from './config/index.js';

const server = app.listen(config.port, () => {
  console.log(`[DeskOps Server] Running in ${config.env} mode on port ${config.port}`);
  console.log(`[DeskOps Server] Health check available at: http://localhost:${config.port}/health`);
});

process.on('SIGTERM', () => {
  console.log('[DeskOps Server] SIGTERM received. Gracefully shutting down...');
  server.close(() => {
    console.log('[DeskOps Server] Process terminated.');
  });
});
