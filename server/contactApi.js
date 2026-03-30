import { Resend } from 'resend';
import ContactMessage from '../models/ContactMessage.js';
import { isDbConnected, ensureDbConnection } from './db.js';

const RECIPIENT = 'snirfain@gmail.com';

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

export async function submitContactForm(req, res) {
  try {
    const { full_name, email, message, user_id } = req.body || {};
    if (!full_name?.trim() || !email?.trim() || !message?.trim()) {
      return res.status(400).json({ error: 'full_name, email, and message are required' });
    }

    let saved = null;
    await ensureDbConnection();
    if (isDbConnected()) {
      saved = await ContactMessage.create({
        full_name: full_name.trim(),
        email: email.trim(),
        message: message.trim(),
        user_id: user_id || null,
      });
    }

    let emailSent = false;
    const resend = getResend();
    if (resend) {
      try {
        const { error } = await resend.emails.send({
          from: 'onboarding@resend.dev',
          to: RECIPIENT,
          replyTo: email.trim(),
          subject: `פנייה חדשה מאתר מד״א Quiz — ${full_name.trim()}`,
          html: `
            <div dir="rtl" style="font-family:Arial,sans-serif;max-width:600px">
              <h2 style="color:#CC0000">פנייה חדשה מאתר מד״א Quiz</h2>
              <table style="border-collapse:collapse;width:100%">
                <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee">שם מלא</td>
                    <td style="padding:8px;border-bottom:1px solid #eee">${full_name.trim()}</td></tr>
                <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee">דוא"ל</td>
                    <td style="padding:8px;border-bottom:1px solid #eee"><a href="mailto:${email.trim()}">${email.trim()}</a></td></tr>
              </table>
              <div style="margin-top:16px;padding:16px;background:#f9f9f9;border-radius:8px;white-space:pre-wrap">${message.trim()}</div>
            </div>`,
        });
        if (error) {
          console.error('[contact] Resend error:', error);
        } else {
          emailSent = true;
          if (saved) {
            saved.email_sent = true;
            await saved.save();
          }
        }
      } catch (mailErr) {
        console.error('[contact] email send failed:', mailErr.message);
      }
    }

    res.status(201).json({ success: true, emailSent, savedToDb: !!saved });
  } catch (err) {
    console.error('POST /api/contact error:', err);
    res.status(500).json({ error: err.message });
  }
}
