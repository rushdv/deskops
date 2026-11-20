import { Router } from 'express';
import { listPropertiesAndUnits, listTechnicians } from '../controllers/property.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { resolveTenant } from '../middleware/tenant.middleware.js';

const router = Router();

router.use(authenticate, resolveTenant);

router.get('/', listPropertiesAndUnits);
router.get('/technicians', listTechnicians);

export default router;
