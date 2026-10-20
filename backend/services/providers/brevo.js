/**
 * Brevo (formerly Sendinblue) transactional email.
 *
 * The free tier allows 300 emails a day and, unlike Resend, a new account
 * can send to anybody as soon as the sender address is verified - no domain
 * purchase needed.
 *
 * The API is called directly so there is no SDK dependency.
 */
const ENDPOINT = 'https://api.brevo.com/v3/smtp/email';

const isConfigured = () => Boolean(process.env.BREVO_API_KEY);

/**
 * Splits "Name <address@example.com>" into its two parts.
 */
const parseFrom = (value) => {
    const match = String(value || '').match(/^(.*?)<([^>]+)>$/);
    if (match) {
        return { name: match[1].trim(), email: match[2].trim() };
    }
    return { name: 'Expense Tracker', email: String(value || '').trim() };
};

const sender = () => {
    const from = parseFrom(process.env.MAIL_FROM || '');
    return {
        name: process.env.MAIL_FROM_NAME || from.name || 'Expense Tracker',
        email: process.env.BREVO_SENDER_EMAIL || from.email,
    };
};

const send = async ({ to, subject, html, text }) => {
    if (!isConfigured()) {
        const link = (html.match(/href="(http[^"]+)"/) || [])[1] || '(no link)';
        console.log(`\n--- email (not sent, BREVO_API_KEY is not set) ---\n  to: ${to}\n  subject: ${subject}\n  ${link}\n`);
        return { sent: false, preview: link };
    }

    const from = sender();
    if (!from.email) {
        throw new Error('MAIL_FROM or BREVO_SENDER_EMAIL must be set to the address the emails are sent from');
    }

    const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
            'api-key': process.env.BREVO_API_KEY,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
        body: JSON.stringify({
            sender: from,
            to: [{ email: to }],
            subject,
            htmlContent: html,
            textContent: text,
        }),
        signal: AbortSignal.timeout(Number(process.env.MAIL_TIMEOUT_MS || 8000)),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(`Brevo rejected the message: ${result?.message || response.status}`);
    }
    return { sent: true, id: result.messageId };
};

module.exports = { isConfigured, send, parseFrom, sender };
