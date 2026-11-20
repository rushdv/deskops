import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/auth.js';
import { AuthService } from '../services/auth.service.js';

export const authenticate = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Missing or malformed Authorization header. Expected "Bearer <token>".',
      },
    });
    return;
  }

  const token = authHeader.substring(7);

  try {
    const userPayload = AuthService.verifyAccessToken(token);
    req.user = userPayload;
    next();
  } catch (err) {
    res.status(401).json({
      success: false,
      error: {
        code: 'TOKEN_INVALID_OR_EXPIRED',
        message: err instanceof Error ? err.message : 'Invalid or expired token',
      },
    });
  }
};
