/**
 * Sends transactional email.
 *
 * Uses the Resend HTTP API (no SDK dependency). The free tier allows 3,000
 * emails a month and 100 a day, which covers verification and password
 * recovery for a few hundred users.
 *
 * When no API key is configured the message is written to the server log
 * instead, so the flow can be tested end to end before the account exists.
 */
const RESEND_ENDPOINT = 'https://api.resend.com/emails';

const isConfigured = () => Boolean(process.env.RESEND_API_KEY);

const from = () => process.env.MAIL_FROM || 'Expense Tracker <onboarding@resend.dev>';

const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const layout = (title, bodyHtml) => `
<div style="font-family:Inter,Segoe UI,system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#0f172a">
  <h1 style="font-size:20px;margin:0 0 16px">${escapeHtml(title)}</h1>
  ${bodyHtml}
  <p style="margin-top:28px;font-size:12px;color:#64748b">
    This message was sent by Expense Tracker. If you did not expect it, you can ignore this email.
  </p>
</div>`;

const send = async ({ to, subject, html, text }) => {
    if (!isConfigured()) {
        const link = (html.match(/href="(http[^"]+)"/) || [])[1] || '(no link)';
        console.log(`\n--- email (not sent, RESEND_API_KEY is not set) ---\n  to: ${to}\n  subject: ${subject}\n  ${link}\n`);
        return { sent: false, preview: link };
    }

    const response = await fetch(RESEND_ENDPOINT, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from: from(), to: [to], subject, html, text }),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(`Resend rejected the message: ${result?.message || response.status}`);
    }
    return { sent: true, id: result.id };
};

const sendVerificationEmail = async ({ to, name, link }) => {
    const subject = 'Verify your Expense Tracker account';
    const html = layout('Verify your email', `
      <p style="font-size:15px;line-height:1.6">Hi ${escapeHtml(name || 'there')},</p>
      <p style="font-size:15px;line-height:1.6">Confirm your email address to finish setting up your account.</p>
      <p style="margin:24px 0">
        <a href="${escapeHtml(link)}" style="background:#7c3aed;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:600;display:inline-block">Verify my email</a>
      </p>
      <p style="font-size:13px;color:#475569">Or paste this link into your browser:<br><a href="${escapeHtml(link)}" style="color:#7c3aed">${escapeHtml(link)}</a></p>
    `);
    const text = `Hi ${name || 'there'}, verify your email address: ${link}`;
    return send({ to, subject, html, text });
};

const sendPasswordResetEmail = async ({ to, name, link }) => {
    const subject = 'Reset your Expense Tracker password';
    const html = layout('Reset your password', `
      <p style="font-size:15px;line-height:1.6">Hi ${escapeHtml(name || 'there')},</p>
      <p style="font-size:15px;line-height:1.6">We received a request to reset your password. This link works for 60 minutes.</p>
      <p style="margin:24px 0">
        <a href="${escapeHtml(link)}" style="background:#7c3aed;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:600;display:inline-block">Choose a new password</a>
      </p>
      <p style="font-size:13px;color:#475569">If you did not ask for this, you can ignore this email - your password will not change.</p>
    `);
    const text = `Reset your Expense Tracker password: ${link}`;
    return send({ to, subject, html, text });
};

module.exports = {
    isConfigured,
    send,
    sendVerificationEmail,
    sendPasswordResetEmail,
};
