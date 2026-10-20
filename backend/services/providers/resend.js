/**
 * Resend transactional email.
 *
 * The free tier allows 3,000 emails a month, but a new account can only send
 * to its own address until a domain is verified.
 */
const ENDPOINT = 'https://api.resend.com/emails';

const isConfigured = () => Boolean(process.env.RESEND_API_KEY);

const from = () => process.env.MAIL_FROM || 'Expenza <onboarding@resend.dev>';

const send = async ({ to, subject, html, text }) => {
    if (!isConfigured()) {
        const link = (html.match(/href="(http[^"]+)"/) || [])[1] || '(no link)';
        console.log(`\n--- email (not sent, RESEND_API_KEY is not set) ---\n  to: ${to}\n  subject: ${subject}\n  ${link}\n`);
        return { sent: false, preview: link };
    }

    const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from: from(), to: [to], subject, html, text }),
        signal: AbortSignal.timeout(Number(process.env.MAIL_TIMEOUT_MS || 8000)),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(`Resend rejected the message: ${result?.message || response.status}`);
    }
    return { sent: true, id: result.id };
};

module.exports = { isConfigured, send };
