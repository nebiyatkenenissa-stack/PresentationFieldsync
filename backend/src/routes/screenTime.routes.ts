import { Router } from 'express';
import * as screenTimeModel from '../models/screenTime.model.js';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    res.json(await screenTimeModel.getAll());
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/employee/:employeeId', async (req, res) => {
  try {
    const { employeeId } = req.params;
    res.json(await screenTimeModel.getByEmployee(employeeId));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const row = await screenTimeModel.upsert(req.body);
    res.status(201).json(row);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const row = await screenTimeModel.update(id, req.body);
    if (!row) {
      res.status(404).json({ error: 'Screen time record not found' });
      return;
    }
    res.json(row);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const row = await screenTimeModel.remove(id);
    if (!row) {
      res.status(404).json({ error: 'Record not found' });
      return;
    }
    res.json({ message: 'Screen time record deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
