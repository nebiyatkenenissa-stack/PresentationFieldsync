import { Request, Response } from 'express';
import * as citizenModel from '../models/citizen.model.js';
import { saveBase64Photo } from '../utils/photo.js';
import { pool } from '../config/db.js';

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

// Business rule: the same first + last name is allowed, but only when the
// grandfather name is different. An exact match on all three means the same
// person is being registered twice and must be rejected.
async function findExactDuplicate(data: any): Promise<any> {
  if (!data.firstName || !data.lastName) return null;
  const result = await pool.query(
    `SELECT national_id FROM citizens
     WHERE LOWER(first_name) = LOWER($1)
       AND LOWER(last_name) = LOWER($2)
       AND LOWER(COALESCE(grandfather_name, '')) = LOWER(COALESCE($3, ''))`,
    [data.firstName, data.lastName, data.grandfatherName || '']
  );
  return result.rows[0] || null;
}

export async function create(req: Request, res: Response): Promise<void> {
  try {
    const body = { ...req.body };
    if (body.photo) body.photo = saveBase64Photo(body.photo);

    const existing = await findExactDuplicate(body);
    if (existing) {
      res.status(409).json({
        error: 'A citizen with the same first name, last name and grandfather name already exists'
      });
      return;
    }

    const row = await citizenModel.create(body);
    res.status(201).json(row);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
