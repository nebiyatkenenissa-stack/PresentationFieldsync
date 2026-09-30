import { pool } from '../config/db.js';
import { transporter } from '../config/mail.js';
import { config } from '../config/env.js';
import { isValidEmail, escapeHtml } from './notifyCitizen.js';

// Sends a copy of a FieldSync message by email to every listed recipient whose
// address looks valid. Recipient emails come from the users table (source of
// truth) so the sender never has to provide them. Failures are logged and
// swallowed – email delivery must never break message sending.
export async function sendMessageEmails(alertData: any): Promise<void> {
  if (!alertData) return;

  const targetUsers = Array.isArray(alertData.targetUsers) ? alertData.targetUsers : [];
  if (targetUsers.length === 0) return;

  const title = alertData.title || 'New message';
  const body = alertData.message || '';
  const sender = alertData.sentByName || alertData.sentBy || 'Unknown';
  const sentAt = new Date(alertData.timestamp || Date.now()).toLocaleString('en-GB');
  const priority = alertData.priority || 'medium';

  const subject = `✉️ ${title} (from ${sender})`;

  const html = `
    <div style="font-family:Segoe UI,Arial,sans-serif;max-width:560px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
      <div style="background:linear-gradient(135deg,#0f2a4a,#2563eb);padding:20px 24px;color:#fff;">
        <h2 style="margin:0;font-size:18px;">${escapeHtml(subject)}</h2>
        <p style="margin:4px 0 0;opacity:.9;font-size:12px;">
          From: ${escapeHtml(sender)} &nbsp;•&nbsp; ${escapeHtml(sentAt)} &nbsp;•&nbsp; Priority: ${escapeHtml(priority)}
        </p>
      </div>
      <div style="padding:24px;font-size:14px;color:#0f172a;line-height:1.6;">
        <div style="background:#f8fafc;border-left:4px solid #2563eb;padding:12px 16px;border-radius:8px;white-space:pre-wrap;">
          ${escapeHtml(body)}
        </div>
        <p style="margin:16px 0 0;font-size:13px;color:#64748b;">
          You received this message from the FieldSync messaging system. You can read it in your FieldSync inbox.
        </p>
      </div>
    </div>
  `;

  for (const target of targetUsers) {
    let email = target && typeof target.email === 'string' && isValidEmail(target.email)
      ? target.email.trim()
      : '';

    if (!email && target && (target.id || target.employeeId)) {
      try {
        const res = await pool.query(
          'SELECT email FROM users WHERE id = $1 OR employee_id = $1 LIMIT 1',
          [target.id || target.employeeId]
        );
        if (isValidEmail(res.rows[0]?.email)) email = res.rows[0].email.trim();
      } catch (err: any) {
        console.error('❌ Failed to look up recipient email:', err.message);
      }
    }

    if (!email) continue;

    try {
      await transporter.sendMail({
        from: config.emailUser,
        to: email,
        subject,
        html,
      });
      console.log(`📧 Message email sent to ${email}`);
    } catch (err: any) {
      console.error('❌ Failed to send message email:', err.message);
    }
  }
}