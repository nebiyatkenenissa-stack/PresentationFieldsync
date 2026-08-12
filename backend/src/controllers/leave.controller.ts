import { Request, Response } from 'express';
import * as leaveModel from '../models/leave.model.js';

export async function getAll(req: Request, res: Response): Promise<void> {
  try {
    const rows = await leaveModel.getAll();
    res.json(rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function upsert(req: Request, res: Response): Promise<void> {
  try {
    const row = await leaveModel.upsert(req.body);
    res.status(201).json(row);
  } catch (error: any) {
    console.error('Error creating leave:', error);
    res.status(500).json({ error: error.message });
  }
}

export async function update(req: Request, res: Response): Promise<void> {
  try {
    const id = String(req.params.id);
    const row = await leaveModel.update(id, req.body);
    if (!row) {
      res.status(404).json({ error: 'Leave not found' });
      return;
    }
    res.json(row);
  } catch (error: any) {
    console.error('Error updating leave:', error);
    res.status(500).json({ error: error.message });
  }
}

export async function updateStatus(req: Request, res: Response): Promise<void> {
  try {
    const id = String(req.params.id);
    const { status, approvedBy, approvedAt } = req.body;
    const row = await leaveModel.updateStatus(
      id,
      status,
      approvedBy,
      approvedAt || new Date().toISOString()
    );
    if (!row) {
      res.status(404).json({ error: 'Leave not found' });
      return;
    }
    res.json(row);
  } catch (error: any) {
    console.error('Error updating leave:', error);
    res.status(500).json({ error: error.message });
  }
}
