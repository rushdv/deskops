import dotenv from 'dotenv';
import path from 'path';

// Load .env from project root if available, otherwise fallback to local
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config();

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '5000', 10),
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  apiPrefix: process.env.API_PREFIX || '/api/v1',
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET || 'deskops_default_access_secret_do_not_use_in_prod',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'deskops_default_refresh_secret_do_not_use_in_prod',
  jwtAccessExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
  jwtRefreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
};
