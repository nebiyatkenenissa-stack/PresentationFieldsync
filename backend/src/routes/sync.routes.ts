import { Router } from 'express';
import * as syncController from '../controllers/sync.controller.js';

const router = Router();

router.post('/', syncController.sync);

export default router;
