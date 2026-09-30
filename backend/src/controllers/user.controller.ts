import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import fs from 'node:fs';
import path from 'node:path';
import * as userModel from '../models/user.model.js';
import { generateTempPassword } from '../utils/password.js';
import { transporter } from '../config/mail.js';
import { config } from '../config/env.js';

export async function getAll(req: Request, res: Response): Promise<void> {
  try {
    const rows = await userModel.getAllUsers();
    res.json(rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function getById(req: Request, res: Response): Promise<void> {
  try {
    const id = String(req.params.id);
    const row = await userModel.getUserById(id);
    if (!row) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json(row);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function getSupervisorsByWoreda(req: Request, res: Response): Promise<void> {
  try {
    const woredaId = String(req.params.woredaId);
    const rows = await userModel.getSupervisorsByWoreda(woredaId);
    res.json(rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function resendCredentials(req: Request, res: Response): Promise<void> {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ error: 'Email is required' });
      return;
    }

    const user = await userModel.findByEmailExact(email.toLowerCase().trim());
    if (!user) {
      res.status(404).json({ error: 'No user found with that email' });
      return;
    }

    const tempPassword = generateTempPassword();
    const hashedPassword = await bcrypt.hash(tempPassword, 10);
    await userModel.resetUserPassword(user.id, hashedPassword);

    if (user.role === 'manager') {
      res.json({
        ok: true,
        temporaryPassword: tempPassword,
        note: 'Manager password reset (no email sent).',
      });
      return;
    }

    await transporter.sendMail({
      from: config.emailUser,
      to: user.email,
      subject: 'Your FieldSync Account Credentials',
      html: `
          <h3>FieldSync Account Credentials</h3>
          <p>Hello ${user.name},</p>
          <p>Your FieldSync ${user.role === 'supervisor' ? 'Supervisor' : 'Field Officer'} account credentials:</p>
          <p><strong>Login Email:</strong> ${user.email}</p>
          <p><strong>Password:</strong> ${tempPassword}</p>
          <p>Please log in and change your password.</p>
          <p>Regards,<br>FieldSync Team</p>
      `,
    });

    console.log(`📧 Credentials resent to ${user.email}`);
    res.json({ ok: true, temporaryPassword: tempPassword, email: user.email });
  } catch (error: any) {
    console.error('❌ Failed to resend credentials:', error);
    res.status(500).json({ error: error.message });
  }
}

export async function create(req: Request, res: Response): Promise<void> {
  try {
    const data = req.body;
    let plainPassword = data.password;

    // Accept either spelling. The client has historically sent the snake_case
    // key while this handler read the camelCase one, so the flag always read
    // as undefined and silently defaulted to false.
    const requestedMustChange =
      data.mustChangePassword !== undefined ? data.mustChangePassword
        : data.must_change_password !== undefined ? data.must_change_password
          : undefined;

    // Every new account must set its own password on first login. This used to
    // be limited to field officers, which left managers and supervisors on a
    // well-known shared default ('manager123' / 'super123') with no prompt.
    let mustChange = requestedMustChange !== undefined ? !!requestedMustChange : true;

    if (data.role === 'field_officer') {
      plainPassword = generateTempPassword();
      mustChange = true;
    } else if (!plainPassword) {
      // Managers and supervisors have no random password of their own; they
      // get a documented default so they can sign in the first time. The
      // must-change flag is what stops that default from sticking around.
      if (data.role === 'manager') plainPassword = 'manager123';
      else if (data.role === 'supervisor') plainPassword = 'super123';
      else plainPassword = 'officer123';
    }

    const hashedPassword = await bcrypt.hash(plainPassword, 10);
    const newUser = await userModel.createOrUpdateUser(data, hashedPassword, mustChange);

    delete newUser.password_hash;
    newUser.temporaryPassword = plainPassword;

    if (data.role === 'field_officer' || data.role === 'supervisor') {
      try {
        await transporter.sendMail({
          from: config.emailUser,
          to: data.email,
          subject: 'Your FieldSync Account',
          html: `
              <h3>Welcome to FieldSync</h3>
              <p>Hello ${data.name},</p>
              <p>Your FieldSync account has been created with the role of <strong>${data.role === 'supervisor' ? 'Supervisor' : 'Field Officer'}</strong>.</p>
              <p><strong>Login Email:</strong> ${data.email}</p>
              <p><strong>Password:</strong> ${plainPassword}</p>
              <p>Please log in and change your password if required.</p>
              <p>Regards,<br>FieldSync Team</p>
          `,
        });
        console.log(`📧 Password sent to ${data.email}`);
      } catch (emailErr: any) {
        console.error('❌ Failed to send email:', emailErr);
      }
    }

    res.status(201).json(newUser);
  } catch (error: any) {
    if (error.code === '23505' && error.constraint === 'users_employee_id_key') {
      console.error('Duplicate employee ID rejected on create:', req.body?.employeeId);
      res.status(409).json({
        error: `Employee ID ${req.body?.employeeId || ''} is already in use by another user. Every employee must have a unique ID.`,
      });
    } else {
      console.error('Error creating user:', error);
      res.status(500).json({ error: error.message });
    }
  }
}

export async function update(req: Request, res: Response): Promise<void> {
  try {
    const id = String(req.params.id);
    const row = await userModel.updateUserProfile(id, req.body);
    if (!row) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    delete row.password_hash;
    res.json(row);
  } catch (error: any) {
    if (error.code === '23505' && error.constraint === 'users_employee_id_key') {
      res.status(409).json({ error: `Employee ID ${req.body?.employeeId || ''} is already in use by another user.` });
      return;
    }
    console.error('Error updating user:', error);
    res.status(500).json({ error: error.message });
  }
}

export async function remove(req: Request, res: Response): Promise<void> {
  try {
    const id = String(req.params.id);
    const row = await userModel.deleteUser(id);
    if (!row) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json({ message: 'User deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: error.message });
  }
}

export async function uploadPhoto(req: Request, res: Response): Promise<void> {
  try {
    const userId = String(req.params.id);
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    // Backup the old photo before replacing
    const oldPhotoPath = await userModel.getCurrentPhoto(userId);
    if (oldPhotoPath) {
      try {
        const oldFileName = path.basename(oldPhotoPath);
        const oldFullPath = path.join(config.uploadsDir, oldFileName);
        if (fs.existsSync(oldFullPath)) {
          const backupFileName = `${userId}_${Date.now()}_${oldFileName}`;
          const backupPath = path.join(config.profileBackupsDir, backupFileName);
          fs.copyFileSync(oldFullPath, backupPath);
          console.log(`📦 Backed up old photo: ${oldFileName} -> ${backupFileName}`);
        }
      } catch (backupErr) {
        console.error('Warning: Could not backup old photo:', backupErr);
      }
    }

    const filePath = '/uploads/' + req.file.filename;

    // Verify the new file was written successfully
    const newFullPath = path.join(config.uploadsDir, req.file.filename);
    if (!fs.existsSync(newFullPath) || fs.statSync(newFullPath).size === 0) {
      res.status(500).json({ error: 'Photo file was not saved properly' });
      return;
    }

    const row = await userModel.updateUserPhoto(userId, filePath);
    if (!row) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json({ profilePhoto: filePath });
  } catch (error: any) {
    console.error('Photo upload error:', error);
    res.status(500).json({ error: error.message });
  }
}
