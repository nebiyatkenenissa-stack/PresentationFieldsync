import { Router } from 'express';
import * as auditModel from '../models/audit.model.js';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    res.json(await auditModel.getAll());
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const row = await auditModel.create(req.body);
    res.status(201).json(row);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const deleted = await auditModel.deleteById(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: 'Audit record not found' });
      return;
    }
    res.json({ message: 'Audit record deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/', async (_req, res) => {
  try {
    await auditModel.clearAll();
    res.json({ message: 'All audit logs cleared' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
