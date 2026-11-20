import { Router } from 'express';
import { login, refresh, getCurrentUser } from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { resolveTenant } from '../middleware/tenant.middleware.js';

const router = Router();

router.post('/login', login);
router.post('/refresh', refresh);
router.get('/me', authenticate, resolveTenant, getCurrentUser);

export default router;
