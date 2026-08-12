import { Router } from 'express';
import * as attendanceController from '../controllers/attendance.controller.js';

const router = Router();

router.get('/', attendanceController.getAll);
router.get('/employee/:employeeId', attendanceController.getByEmployee);
router.post('/', attendanceController.create);
router.put('/:id', attendanceController.approve);

export default router;
