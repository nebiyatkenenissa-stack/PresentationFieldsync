import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import * as userModel from '../models/user.model.js';

export async function login(req: Request, res: Response): Promise<void> {
  console.log('🔑 Login request received for:', req.body.email);
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password required' });
      return;
    }

    const user = await userModel.findByEmailForLogin(email.trim().toLowerCase());
    if (!user) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }
    if (user.status !== 'active') {
      res.status(401).json({ error: 'Account is inactive' });
      return;
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    delete user.password_hash;
    res.json({ success: true, user });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function changePassword(req: Request, res: Response): Promise<void> {
  console.log('🔑 Change password request received for:', req.body.email);
  try {
    const { email, currentPassword, newPassword } = req.body;
    if (!email || !currentPassword || !newPassword) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    const user = await userModel.findByEmailForPassword(email.trim().toLowerCase());
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const match = await bcrypt.compare(currentPassword, user.password_hash);
    if (!match) {
      res.status(401).json({ error: 'Current password is incorrect' });
      return;
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await userModel.updatePassword(user.id, newHash);

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error: any) {
    console.error('Change password error:', error);
    res.status(500).json({ error: error.message });
  }
}
