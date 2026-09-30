import { transporter } from '../config/mail.js';
import { config } from '../config/env.js';
import { buildPhotoAttachment } from './photo.js';

// Basic sanity check that the address looks like a real, deliverable email.
// Missing / empty / malformed addresses are simply skipped.
export function isValidEmail(email?: string | null): boolean {
  if (!email || typeof email !== 'string') return false;
  const clean = email.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(clean);
}

// Escape dynamic values so citizen data can never break the HTML layout
// (e.g. "Amhara > West Gojjam" must not be parsed as a tag) or inject markup.
export function escapeHtml(value: string | number | Date | null | undefined): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Sends a citizen their national ID and the other key registration details.
// Failure is logged and swallowed so it never breaks registration or sync.
export async function sendCitizenNotification(citizen: any): Promise<void> {
  if (!citizen || typeof citizen !== 'object') return;

  const email = typeof citizen.email === 'string' ? citizen.email.trim() : '';
  if (!isValidEmail(email)) return;

  const fullName = [citizen.first_name, citizen.last_name, citizen.grandfather_name].filter(Boolean).join(' ');
  const dateOfBirth = citizen.date_of_birth
    ? new Date(citizen.date_of_birth).toLocaleDateString('en-GB')
    : '—';
  const registrationDate = citizen.registration_date
    ? new Date(citizen.registration_date).toLocaleString('en-GB')
    : '—';

  const location = [citizen.address, citizen.region, citizen.district, citizen.village]
    .filter(Boolean)
    .join(', ') || '—';

  const rows = [
    { label: 'Full Name', value: fullName || '—' },
    { label: 'National ID', value: citizen.national_id || '—' },
    { label: 'Date of Birth', value: dateOfBirth },
    { label: 'Gender', value: citizen.gender || '—' },
    { label: 'Phone', value: citizen.phone || '—' },
    { label: 'Email', value: email },
    { label: 'Address', value: location },
    { label: 'Occupation', value: citizen.occupation || '—' },
    { label: "Father's Full Name", value: citizen.father_name || '—' },
    { label: "Mother's Full Name", value: citizen.mother_name || '—' },
    { label: 'Place of Birth', value: citizen.birth_place || '—' },
    { label: 'Birth Certificate No.', value: citizen.birth_certificate_number || '—' },
    { label: 'Registered On', value: registrationDate },
  ];

  const rowsHtml = rows
    .map(
      (r) => `
        <tr>
          <td style="padding:10px 14px;border-bottom:1px solid #eee;color:#475569;font-weight:600;white-space:nowrap;">${escapeHtml(r.label)}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #eee;color:#0f172a;">${escapeHtml(r.value)}</td>
        </tr>`
    )
    .join('');

  // Embed the uploaded photo inline as a CID attachment. This renders in the
  // email itself rather than as a link, so it works even when the officer
  // registered the citizen on an unreachable LAN/offline address.
  const photo = buildPhotoAttachment(citizen.photo);
  const photoHtml = photo
    ? `
            <table role="presentation" width="100%" style="border-collapse:collapse;margin:0 0 20px;">
              <tr>
                <td style="padding:16px 0;">
                  <img src="cid:${photo.cid}" alt="Citizen photo" width="140" height="170" style="display:block;width:140px;height:170px;object-fit:cover;border:1px solid #e2e8f0;border-radius:8px;" />
                </td>
              </tr>
            </table>`
    : '';

  try {
    await transporter.sendMail({
      from: config.emailUser,
      to: email,
      subject: 'Your National ID Notification',
      ...(photo
        ? {
            attachments: [
              {
                filename: photo.filename,
                content: photo.content,
                cid: photo.cid,
                contentDisposition: 'inline',
              },
            ],
          }
        : {}),
      html: `
        <div style="font-family:Segoe UI,Arial,sans-serif;max-width:560px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
          <div style="background:linear-gradient(135deg,#0f2a4a,#2563eb);padding:20px 24px;color:#fff;">
            <h2 style="margin:0;font-size:20px;">🆔 National ID Notification</h2>
            <p style="margin:4px 0 0;opacity:.9;font-size:13px;">Congratulations ${escapeHtml(fullName || '')}. Your registration has been completed.</p>
          </div>
          <div style="padding:8px 24px 24px;">${photoHtml}
            <table style="width:100%;border-collapse:collapse;font-size:14px;">
              ${rowsHtml}
            </table>
            <p style="margin-top:16px;font-size:13px;color:#64748b;">
              Please keep your National ID safe and present it whenever you visit a government office.<br>
              Regards,<br><strong>FieldSync Team</strong>
            </p>
          </div>
        </div>
      `,
    });
    console.log(`📧 National ID notification sent to ${email}`);
  } catch (err: any) {
    console.error('❌ Failed to send citizen notification email:', err.message);
  }
}