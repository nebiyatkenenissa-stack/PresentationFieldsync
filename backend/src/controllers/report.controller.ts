import { Request, Response } from 'express';
import * as reportModel from '../models/report.model.js';

export async function getAll(req: Request, res: Response): Promise<void> {
  try {
    const rows = await reportModel.getAll();
    res.json(rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function getById(req: Request, res: Response): Promise<void> {
  try {
    const id = String(req.params.id);
    const row = await reportModel.getById(id);
    if (!row) {
      res.status(404).json({ error: 'Report not found' });
      return;
    }
    res.json(row);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function create(req: Request, res: Response): Promise<void> {
  try {
    const row = await reportModel.create(req.body);
    res.status(201).json(row);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function update(req: Request, res: Response): Promise<void> {
  try {
    const id = String(req.params.id);
    const row = await reportModel.update(id, req.body);
    if (!row) {
      res.status(404).json({ error: 'Report not found' });
      return;
    }
    res.json(row);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function remove(req: Request, res: Response): Promise<void> {
  try {
    const id = String(req.params.id);
    const row = await reportModel.remove(id);
    if (!row) {
      res.status(404).json({ error: 'Report not found' });
      return;
    }
    res.json({ message: 'Report deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
