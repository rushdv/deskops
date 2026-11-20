import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/auth.js';

export const resolveTenant = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  // Tenant must be derived strictly from the verified authenticated user session
  if (!req.user || !req.user.organisationId) {
    res.status(401).json({
      success: false,
      error: {
        code: 'TENANT_UNRESOLVED',
        message: 'Tenant context could not be resolved from authenticated credentials.',
      },
    });
    return;
  }

  // Bind tenant context
  req.tenant = {
    organisationId: req.user.organisationId,
  };

  next();
};
