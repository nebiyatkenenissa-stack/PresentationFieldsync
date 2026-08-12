import { Router } from 'express';
import * as leaveController from '../controllers/leave.controller.js';

const router = Router();

router.get('/', leaveController.getAll);
router.post('/', leaveController.upsert);
router.put('/:id', leaveController.updateStatus);

export default router;
