import { Request, Response } from 'express';
import * as attendanceModel from '../models/attendance.model.js';

export async function getAll(req: Request, res: Response): Promise<void> {
  try {
    const rows = await attendanceModel.getAll();
    res.json(rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function getByEmployee(req: Request, res: Response): Promise<void> {
  try {
    const employeeId = String(req.params.employeeId);
    const rows = await attendanceModel.getByEmployee(employeeId);
    res.json(rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function create(req: Request, res: Response): Promise<void> {
  try {
    const row = await attendanceModel.create(req.body);
    res.status(201).json(row);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function approve(req: Request, res: Response): Promise<void> {
  try {
    const id = String(req.params.id);
    const { approved, approved_by, seen_by_manager } = req.body;
    const row = await attendanceModel.approve(id, approved, approved_by, seen_by_manager);
    if (!row) {
      res.status(404).json({ error: 'Attendance record not found' });
      return;
    }
    res.json(row);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
