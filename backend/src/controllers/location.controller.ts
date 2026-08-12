import { Request, Response } from 'express';
import * as locationModel from '../models/location.model.js';

export async function getByLevel(req: Request, res: Response): Promise<void> {
  try {
    const level = String(req.params.level);
    const rows = await locationModel.getByLevel(level);
    res.json(rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function getChildren(req: Request, res: Response): Promise<void> {
  try {
    const parentId = String(req.params.parentId);
    const rows = await locationModel.getChildren(parentId);
    res.json(rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function getCommunitiesByKebele(req: Request, res: Response): Promise<void> {
  const { kebele_id } = req.query;
  if (!kebele_id) {
    res.status(400).json({ error: 'kebele_id is required' });
    return;
  }
  try {
    const rows = await locationModel.getCommunitiesByKebele(String(kebele_id));
    res.json(rows);
  } catch (error: any) {
    console.error('Error fetching communities:', error);
    res.status(500).json({ error: error.message });
  }
}

export async function getCommunityById(req: Request, res: Response): Promise<void> {
  try {
    const id = String(req.params.id);
    const row = await locationModel.getCommunityById(id);
    if (!row) {
      res.status(404).json({ error: 'Community not found' });
      return;
    }
    res.json(row);
  } catch (error: any) {
    console.error('Error fetching community:', error);
    res.status(500).json({ error: error.message });
  }
}

export async function getLocationById(req: Request, res: Response): Promise<void> {
  try {
    const id = String(req.params.id);
    const row = await locationModel.getLocationById(id);
    if (!row) {
      res.status(404).json({ error: 'Location not found' });
      return;
    }
    res.json(row);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
