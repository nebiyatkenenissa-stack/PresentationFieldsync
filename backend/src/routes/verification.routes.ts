import { Router } from 'express';
import * as verificationModel from '../models/verification.model.js';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    res.json(await verificationModel.getAll());
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/officer/:officerId', async (req, res) => {
  try {
    const { officerId } = req.params;
    res.json(await verificationModel.getByOfficer(officerId));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const row = await verificationModel.create(req.body);
    res.status(201).json(row);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const removed = await verificationModel.remove(req.params.id);
    if (!removed) {
      return res.status(404).json({ error: 'Verification record not found' });
    }
    res.json({ message: 'Verification record deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/', async (_req, res) => {
  try {
    await verificationModel.clearAll();
    res.json({ message: 'All verification records cleared' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
