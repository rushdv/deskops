import { Router } from 'express';
import {
  requestPresignedUrl,
  confirmUpload,
  listTicketAttachments,
} from '../controllers/attachment.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { resolveTenant } from '../middleware/tenant.middleware.js';

const router = Router();

// Tenant isolation and authentication applied to all attachment routes
router.use(authenticate, resolveTenant);

router.post('/presigned-url', requestPresignedUrl);
router.post('/:id/confirm', confirmUpload);
router.get('/ticket/:ticketId', listTicketAttachments);

export default router;
