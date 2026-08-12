import { Router } from 'express';
import * as supervisorReportModel from '../models/supervisorReport.model.js';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    res.json(await supervisorReportModel.getAll());
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/supervisor/:supervisorId', async (req, res) => {
  try {
    const { supervisorId } = req.params;
    res.json(await supervisorReportModel.getBySupervisor(supervisorId));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/officer/:officerId', async (req, res) => {
  try {
    const { officerId } = req.params;
    res.json(await supervisorReportModel.getByOfficer(officerId));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const row = await supervisorReportModel.create(req.body);
    res.status(201).json(row);
  } catch (error: any) {
    console.error('Error inserting supervisor report:', error);
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const row = await supervisorReportModel.update(id, req.body);
    if (!row) {
      res.status(404).json({ error: 'Report not found' });
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
    const row = await supervisorReportModel.remove(id);
    if (!row) {
      res.status(404).json({ error: 'Report not found' });
      return;
    }
    res.json({ message: 'Report deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
