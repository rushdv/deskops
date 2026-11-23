import { Router } from 'express';
import { RoleName } from '@prisma/client';
import { getAnalyticsSummary } from '../controllers/analytics.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { resolveTenant } from '../middleware/tenant.middleware.js';
import { requireRoles } from '../middleware/rbac.middleware.js';

const router = Router();

router.use(authenticate, resolveTenant);

router.get(
  '/summary',
  requireRoles([RoleName.ORGANISATION_ADMIN, RoleName.TECHNICIAN]),
  getAnalyticsSummary
);

export default router;
