import { Response, NextFunction } from 'express';
import { RoleName } from '@prisma/client';
import { AuthenticatedRequest } from '../types/auth.js';

export const requireRoles = (allowedRoles: RoleName[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `Access denied. Permitted roles: [${allowedRoles.join(', ')}]. Current role: ${req.user.role}.`,
        },
      });
      return;
    }

    next();
  };
};
