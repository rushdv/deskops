import { Router } from 'express';
import {
  listTickets,
  getTicketById,
  createTicket,
  triageTicket,
  assignTicket,
  updateTicketStatus,
} from '../controllers/ticket.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { resolveTenant } from '../middleware/tenant.middleware.js';
import { requireRoles } from '../middleware/rbac.middleware.js';
import { RoleName } from '@prisma/client';

const router = Router();

// Apply auth & tenant resolver to all ticket routes
router.use(authenticate, resolveTenant);

router.get('/', listTickets);
router.get('/:id', getTicketById);
router.post('/', requireRoles([RoleName.RESIDENT, RoleName.ORGANISATION_ADMIN]), createTicket);
router.patch('/:id/triage', requireRoles([RoleName.ORGANISATION_ADMIN]), triageTicket);
router.patch('/:id/assign', requireRoles([RoleName.ORGANISATION_ADMIN]), assignTicket);
router.patch(
  '/:id/status',
  requireRoles([RoleName.ORGANISATION_ADMIN, RoleName.TECHNICIAN, RoleName.RESIDENT]),
  updateTicketStatus
);

export default router;
