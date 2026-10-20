import { Router } from 'express';
import * as reportController from '../controllers/report.controller.js';

const router = Router();

router.put('/:id/status', reportController.updateStatus);
router.get('/', reportController.getAll);
router.get('/:id', reportController.getById);
router.post('/', reportController.create);
router.put('/:id', reportController.update);
router.delete('/:id', reportController.remove);

export default router;
