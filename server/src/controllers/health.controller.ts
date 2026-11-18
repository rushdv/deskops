import { Request, Response } from 'express';
import { HealthResponse } from '../types/index.js';
import { config } from '../config/index.js';

export const getHealth = (_req: Request, res: Response<HealthResponse>): void => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.env,
  });
};
