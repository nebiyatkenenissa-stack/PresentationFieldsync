import { Router } from 'express';
import * as permissionController from '../controllers/permission.controller.js';

const router = Router();

router.get('/', permissionController.getAll);
router.post('/', permissionController.upsert);
router.put('/:id', permissionController.updateStatus);

export default router;
