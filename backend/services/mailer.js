/**
 * Sends transactional email.
 *
 * Two providers are supported:
 *   - Brevo   300 emails a day, and can send to anybody once the sender
 *             address is verified. No domain purchase needed.
 *   - Resend  3,000 a month, but a new account can only send to its own
 *             address until a domain is verified.
 *
 * The provider is chosen with MAIL_PROVIDER, or automatically: Brevo if its
 * key is set, otherwise Resend.
 *
 * When no key is configured the message is written to the server log
 * instead, so the flow can be tested end to end.
 */
const brevo = require('./providers/brevo');
const resend = require('./providers/resend');

const provider = () => {
    const chosen = (process.env.MAIL_PROVIDER || '').toLowerCase();
    if (chosen === 'brevo') return brevo;
    if (chosen === 'resend') return resend;
    return brevo.isConfigured() ? brevo : resend;
};

const isConfigured = () => provider().isConfigured();

// Where the app lives, used for the links inside the emails.
const frontendUrl = () => process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:5173';

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
    const active = provider();
    if (!active.isConfigured()) {
        const link = (html.match(/href="(http[^"]+)"/) || [])[1] || '(no link)';
        console.log(`\n--- email (not sent, no mail provider is configured) ---\n  to: ${to}\n  subject: ${subject}\n  ${link}\n`);
        return { sent: false, preview: link };
    }
    return active.send({ to, subject, html, text });
};

/**
 * Sends an email without letting a slow or broken mail service hold up the
 * request. It takes the function that builds and sends the email, so the
 * right template is always used.
 */
const sendSafely = async (sendEmail) => {
    try {
        await sendEmail();
    } catch (err) {
        console.error('Could not send the email:', err.message);
    }
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

const sendMagicLinkEmail = async ({ to, name, link, isNewAccount = false }) => {
    const subject = 'Your sign in link for Expense Tracker';
    const html = layout('Sign in to Expense Tracker', `
      <p style="font-size:15px;line-height:1.6">Hi ${escapeHtml(name || 'there')},</p>
      <p style="font-size:15px;line-height:1.6">
        ${isNewAccount
            ? 'We created an account for you. Use the button below to sign in and start tracking your spending.'
            : 'Use the button below to sign in. No password needed.'}
      </p>
      <p style="margin:24px 0">
        <a href="${escapeHtml(link)}" style="background:#7c3aed;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:600;display:inline-block">Sign in to Expense Tracker</a>
      </p>
      <p style="font-size:13px;color:#475569">This link works once and expires in 15 minutes.<br>If the button does not work, paste this link into your browser:<br><a href="${escapeHtml(link)}" style="color:#7c3aed">${escapeHtml(link)}</a></p>
    `);
    const text = `Sign in to Expense Tracker: ${link}`;
    return send({ to, subject, html, text });
};

/**
 * Sent every time somebody signs in, so the account holder knows.
 */
const sendSignInEmail = async ({ to, name, when, device, ip }) => {
    const subject = 'New sign in to your Expense Tracker account';
    const html = layout('A new sign in', `
      <p style="font-size:15px;line-height:1.6">Hi ${escapeHtml(name || 'there')},</p>
      <p style="font-size:15px;line-height:1.6">Your Expense Tracker account was just signed in to.</p>
      <table style="margin:20px 0;font-size:14px;border-collapse:collapse">
        <tr><td style="padding:4px 12px 4px 0;color:#64748b">When</td><td style="padding:4px 0;color:#0f172a">${escapeHtml(when)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#64748b">Device</td><td style="padding:4px 0;color:#0f172a">${escapeHtml(device || 'unknown')}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#64748b">IP address</td><td style="padding:4px 0;color:#0f172a">${escapeHtml(ip || 'unknown')}</td></tr>
      </table>
      <p style="font-size:14px;color:#475569">If this was not you, change your password straight away and sign out of anything you do not recognise.</p>
    `);
    const text = `Your Expense Tracker account was signed in to on ${when}. If this was not you, change your password.`;
    return send({ to, subject, html, text });
};

/**
 * Sent when the password is changed, so the change cannot happen silently.
 */
const sendPasswordChangedEmail = async ({ to, name, when }) => {
    const subject = 'Your Expense Tracker password was changed';
    const html = layout('Your password was changed', `
      <p style="font-size:15px;line-height:1.6">Hi ${escapeHtml(name || 'there')},</p>
      <p style="font-size:15px;line-height:1.6">
        The password on your Expense Tracker account was changed on ${escapeHtml(when)}.
      </p>
      <p style="font-size:15px;line-height:1.6">
        If that was not you, reset your password now and contact us.
      </p>
      <p style="margin:24px 0">
        <a href="${escapeHtml(`${frontendUrl()}/forgot-password`)}" style="background:#7c3aed;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:600;display:inline-block">Reset my password</a>
      </p>
    `);
    const text = `Your Expense Tracker password was changed on ${when}. If this was not you, reset your password.`;
    return send({ to, subject, html, text });
};

/**
 * Sent when the profile or settings are changed.
 */
const sendProfileUpdatedEmail = async ({ to, name, changes, when }) => {
    const subject = 'Your Expense Tracker profile was updated';
    const rows = changes.map((change) => `<li style="margin:4px 0">${escapeHtml(change)}</li>`).join('');
    const html = layout('Your profile was updated', `
      <p style="font-size:15px;line-height:1.6">Hi ${escapeHtml(name || 'there')},</p>
      <p style="font-size:15px;line-height:1.6">Your Expense Tracker profile was updated on ${escapeHtml(when)}.</p>
      ${rows ? `<ul style="margin:16px 0 0 18px;font-size:15px;line-height:1.7">${rows}</ul>` : ''}
      <p style="font-size:14px;color:#475569;margin-top:20px">
        If you did not make this change, reset your password and contact us straight away.
      </p>
    `);
    const text = `Your Expense Tracker profile was updated on ${when}. ${changes.join('; ')}`;
    return send({ to, subject, html, text });
};

module.exports = {
    isConfigured,
    send,
    sendSafely,
    sendVerificationEmail,
    sendPasswordResetEmail,
    sendMagicLinkEmail,
    sendSignInEmail,
    sendPasswordChangedEmail,
    sendProfileUpdatedEmail,
};
