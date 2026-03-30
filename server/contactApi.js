import nodemailer from 'nodemailer';
import dns from 'dns';
import ContactMessage from '../models/ContactMessage.js';
import { isDbConnected, ensureDbConnection } from './db.js';

// Force IPv4 DNS resolution — Render blocks outbound IPv6 to Gmail SMTP
dns.setDefaultResultOrder('ipv4first');

const RECIPIENT = 'snirfain@gmail.com';

function buildTransporter() {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) return null;
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
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
    const transporter = buildTransporter();
    if (transporter) {
      try {
        await transporter.sendMail({
          from: `"מד״א Quiz — יצירת קשר" <${process.env.SMTP_USER}>`,
          to: RECIPIENT,
          replyTo: email.trim(),
          subject: `פנייה חדשה מאתר מד״א Quiz — ${full_name.trim()}`,
          text: [
            `שם מלא: ${full_name.trim()}`,
            `דוא"ל: ${email.trim()}`,
            '',
            'תוכן הפנייה:',
            message.trim(),
          ].join('\n'),
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
        emailSent = true;
        if (saved) {
          saved.email_sent = true;
          await saved.save();
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
