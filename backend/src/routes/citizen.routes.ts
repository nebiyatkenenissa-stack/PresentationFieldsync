import { Router } from 'express';
import * as citizenController from '../controllers/citizen.controller.js';

const router = Router();

router.get('/', citizenController.getAll);
router.get('/national/:nationalId', citizenController.getByNationalId);
router.post('/', citizenController.create);

export default router;
