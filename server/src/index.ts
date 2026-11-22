import http from 'http';
import app from './app.js';
import { config } from './config/index.js';
import { initSocketServer } from './lib/socket.js';

const httpServer = http.createServer(app);

// Initialize Socket.io real-time gateway with HTTP server
initSocketServer(httpServer);

const server = httpServer.listen(config.port, () => {
  console.log(`[DeskOps Server] Running in ${config.env} mode on port ${config.port}`);
  console.log(`[DeskOps Server] Health check available at: http://localhost:${config.port}/health`);
  console.log(`[DeskOps Server] Real-Time Socket.io gateway online.`);
});

process.on('SIGTERM', () => {
  console.log('[DeskOps Server] SIGTERM received. Gracefully shutting down...');
  server.close(() => {
    console.log('[DeskOps Server] Process terminated.');
  });
});
