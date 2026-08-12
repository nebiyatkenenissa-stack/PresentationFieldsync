import { Request, Response } from 'express';
import * as citizenModel from '../models/citizen.model.js';
import { saveBase64Photo } from '../utils/photo.js';

export async function getAll(req: Request, res: Response): Promise<void> {
  try {
    const rows = await citizenModel.getAll();
    res.json(rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function getByNationalId(req: Request, res: Response): Promise<void> {
  try {
    const nationalId = String(req.params.nationalId);
    const row = await citizenModel.getByNationalId(nationalId);
    if (!row) {
      res.status(404).json({ error: 'Citizen not found' });
      return;
    }
    res.json(row);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function create(req: Request, res: Response): Promise<void> {
  try {
    const body = { ...req.body };
    if (body.photo) body.photo = saveBase64Photo(body.photo);
    const row = await citizenModel.create(body);
    res.status(201).json(row);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
