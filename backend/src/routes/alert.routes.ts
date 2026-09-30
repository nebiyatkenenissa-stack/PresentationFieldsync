import { Router } from 'express';
import * as alertModel from '../models/alert.model.js';
import { sendMessageEmails } from '../utils/notifyMessage.js';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    res.json(await alertModel.getAll());
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const row = await alertModel.create(req.body);
    // Only notify by email when the message is genuinely new (an offline retry
    // of the same id updates the existing row instead and must not re-send).
    if (row?.is_inserted) {
      void sendMessageEmails(req.body);
    }
    res.status(201).json(row);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const row = await alertModel.markRead(String(req.params.id), req.body.read !== false);
    if (!row) {
      res.status(404).json({ error: 'Alert not found' });
      return;
    }
    res.json(row);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/', async (_req, res) => {
  try {
    await alertModel.clearAll();
    res.json({ message: 'All alerts cleared' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
