import { Router } from 'express';
import * as userController from '../controllers/user.controller.js';
import { upload } from '../config/upload.js';
import { requireRole } from '../middleware/auth.js';

const router = Router();

// Reads stay open to any authenticated user (supervisors need the directory to
// pick who to report to); writes are limited to the roles the UI already allows
// to manage accounts. The role field itself is further restricted in the
// controller -- only an admin may grant or revoke the admin role.
const canManageUsers = requireRole('admin', 'manager');

router.get('/supervisors-by-woreda/:woredaId', userController.getSupervisorsByWoreda);
router.get('/', userController.getAll);
router.get('/:id', userController.getById);
router.post('/resend-credentials', canManageUsers, userController.resendCredentials);
router.post('/', canManageUsers, userController.create);
router.put('/:id', canManageUsers, userController.update);
router.delete('/:id', canManageUsers, userController.remove);
router.post('/:id/photo', userController.uploadPhoto);

export default router;
