import { Request, Response } from 'express';
import * as permissionModel from '../models/permission.model.js';

export async function getAll(req: Request, res: Response): Promise<void> {
  try {
    const rows = await permissionModel.getAll();
    res.json(rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function upsert(req: Request, res: Response): Promise<void> {
  try {
    const row = await permissionModel.upsert(req.body);
    res.status(201).json(row);
  } catch (error: any) {
    console.error('Error creating permission:', error);
    res.status(500).json({ error: error.message });
  }
}

export async function update(req: Request, res: Response): Promise<void> {
  try {
    const id = String(req.params.id);
    const row = await permissionModel.update(id, req.body);
    if (!row) {
      res.status(404).json({ error: 'Permission not found' });
      return;
    }
    res.json(row);
  } catch (error: any) {
    console.error('Error updating permission:', error);
    res.status(500).json({ error: error.message });
  }
}

export async function updateStatus(req: Request, res: Response): Promise<void> {
  try {
    const id = String(req.params.id);
    const { status, approvedBy, approvedAt, rejectReason } = req.body;
    const row = await permissionModel.updateStatus(
      id,
      status,
      approvedBy,
      approvedAt || new Date().toISOString(),
      rejectReason
    );
    if (!row) {
      res.status(404).json({ error: 'Permission not found' });
      return;
    }
    res.json(row);
  } catch (error: any) {
    console.error('Error updating permission:', error);
    res.status(500).json({ error: error.message });
  }
}
