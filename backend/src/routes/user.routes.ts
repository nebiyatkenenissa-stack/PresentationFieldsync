import { Router } from 'express';
import * as userController from '../controllers/user.controller.js';
import { upload } from '../config/upload.js';

const router = Router();

router.get('/supervisors-by-woreda/:woredaId', userController.getSupervisorsByWoreda);
router.get('/', userController.getAll);
router.get('/:id', userController.getById);
router.post('/resend-credentials', userController.resendCredentials);
router.post('/', userController.create);
router.put('/:id', userController.update);
router.delete('/:id', userController.remove);
router.post('/:id/photo', upload.single('profilePhoto'), userController.uploadPhoto);

export default router;
