import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import * as userModel from '../models/user.model.js';
import { signToken, verifyToken } from '../utils/token.js';
import { transporter } from '../config/mail.js';
import { config } from '../config/env.js';
import { generateResetCode } from '../utils/password.js';

const RESET_CODE_TTL_MINUTES = 10;
const RESET_MAX_ATTEMPTS = 5;
const RESET_RESEND_COOLDOWN_SEC = 60;

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
    const token = signToken({ id: user.id, email: user.email, role: user.role });
    res.json({ success: true, user, token });
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

export async function forgotPassword(req: Request, res: Response): Promise<void> {
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string' || !email.trim()) {
      res.status(400).json({ error: 'Email is required' });
      return;
    }

    const generic = {
      success: true,
      message: 'If an account exists for that email, a verification code has been sent.',
    };

    const user = await userModel.findByEmailForReset(email.trim().toLowerCase());
    if (!user || user.status !== 'active') {
      res.json(generic);
      return;
    }

    if (user.reset_code_sent_at) {
      const elapsed = (Date.now() - new Date(user.reset_code_sent_at).getTime()) / 1000;
      if (elapsed < RESET_RESEND_COOLDOWN_SEC) {
        const wait = Math.ceil(RESET_RESEND_COOLDOWN_SEC - elapsed);
        res.status(429).json({ error: `A code was already sent. Please wait ${wait} seconds before requesting another.` });
        return;
      }
    }

    const code = generateResetCode();
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + RESET_CODE_TTL_MINUTES * 60 * 1000);
    await userModel.setResetCode(user.id, codeHash, expiresAt);

    try {
      await transporter.sendMail({
        from: config.emailUser,
        to: user.email,
        subject: 'FieldSync - Password Reset Code',
        html: `
          <h3>FieldSync Password Reset</h3>
          <p>Hello ${user.name || user.email},</p>
          <p>Your verification code is:</p>
          <p style="font-size:28px;letter-spacing:8px;font-weight:bold;">${code}</p>
          <p>This code expires in ${RESET_CODE_TTL_MINUTES} minutes.</p>
          <p>If you did not request a password reset, you can safely ignore this email.</p>
          <p>Regards,<br>FieldSync Team</p>
        `,
      });
    } catch (mailError: any) {
      console.error('Reset code email failed:', mailError);
      await userModel.clearResetCode(user.id);
      res.status(500).json({ error: 'Could not send the verification email. Please try again.' });
      return;
    }

    res.json({
      success: true,
      message: `A verification code was sent to ${user.email}. It expires in ${RESET_CODE_TTL_MINUTES} minutes.`,
    });
  } catch (error: any) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function verifyResetCode(req: Request, res: Response): Promise<void> {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      res.status(400).json({ error: 'Email and verification code are required' });
      return;
    }

    const invalid = () => res.status(400).json({ error: 'Invalid or expired verification code.' });

    const user = await userModel.findByEmailForReset(email.trim().toLowerCase());
    if (!user || !user.reset_code_hash || !user.reset_code_expires) {
      invalid();
      return;
    }

    if (new Date(user.reset_code_expires).getTime() < Date.now()) {
      await userModel.clearResetCode(user.id);
      res.status(400).json({ error: 'Verification code has expired. Please request a new one.' });
      return;
    }

    if ((user.reset_attempts || 0) >= RESET_MAX_ATTEMPTS) {
      await userModel.clearResetCode(user.id);
      res.status(429).json({ error: 'Too many failed attempts. Please request a new code.' });
      return;
    }

    const match = await bcrypt.compare(String(code).trim(), user.reset_code_hash);
    if (!match) {
      const attempts = await userModel.incrementResetAttempts(user.id);
      if (attempts >= RESET_MAX_ATTEMPTS) {
        await userModel.clearResetCode(user.id);
        res.status(429).json({ error: 'Too many failed attempts. Please request a new code.' });
      } else {
        res.status(400).json({ error: `Invalid verification code. ${RESET_MAX_ATTEMPTS - attempts} attempt(s) remaining.` });
      }
      return;
    }

    const resetToken = signToken(
      { id: user.id, email: user.email, purpose: 'password_reset' },
      RESET_CODE_TTL_MINUTES * 60
    );
    res.json({ success: true, resetToken });
  } catch (error: any) {
    console.error('Verify reset code error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function resetPassword(req: Request, res: Response): Promise<void> {
  try {
    const { resetToken, newPassword } = req.body;
    if (!resetToken || !newPassword) {
      res.status(400).json({ error: 'Reset token and new password are required' });
      return;
    }
    if (String(newPassword).length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters' });
      return;
    }

    const payload = verifyToken(resetToken);
    if (!payload || payload.purpose !== 'password_reset' || !payload.id) {
      res.status(400).json({ error: 'Reset session expired. Please start over.' });
      return;
    }

    const newHash = await bcrypt.hash(String(newPassword), 10);
    const updated = await userModel.setPasswordFromReset(payload.id, newHash);
    if (!updated) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ success: true, message: 'Password updated successfully. You can now log in.' });
  } catch (error: any) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}
