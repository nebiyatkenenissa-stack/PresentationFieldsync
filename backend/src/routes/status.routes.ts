import { Router } from 'express';
import * as statusController from '../controllers/status.controller.js';

const router = Router();

router.post('/heartbeat', statusController.heartbeat);
router.post('/offline', statusController.setOffline);
router.get('/online', statusController.getOnlineStatus);

export default router;
