const RateLimit = require('../models/RateLimit');

/**
 * A rate limiter that counts across every instance of the app.
 *
 * The in-memory limiter in `express-rate-limit` only knows about the requests
 * that reach one process, which on a serverless host means an attacker can
 * spread requests over many instances. Counting in the database instead makes
 * the limit global.
 *
 * One counter is written per request, so this is used for the endpoints that
 * matter (authentication) rather than for every API call.
 */
const sharedLimit = ({ key, windowMs, limit, message, keyFn }) => async (req, res, next) => {
    const windowStart = Math.floor(Date.now() / windowMs) * windowMs;
    const subject = keyFn ? keyFn(req) : (req.ip || 'unknown');
    const id = `${key}:${subject}:${windowStart}`;

    try {
        const counter = await RateLimit.findOneAndUpdate(
            { _id: id },
            {
                $inc: { count: 1 },
                $setOnInsert: { expiresAt: new Date(windowStart + windowMs * 2) },
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        const count = counter?.count || 0;
        res.setHeader('RateLimit-Limit', limit);
        res.setHeader('RateLimit-Remaining', Math.max(0, limit - count));
        res.setHeader('RateLimit-Reset', Math.ceil((windowStart + windowMs) / 1000));

        if (count > limit) {
            return res.status(429).json({ message });
        }
    } catch (err) {
        // If the counter cannot be written, fail open rather than locking
        // real users out of the app.
        console.error('Shared rate limiter failed:', err.message);
    }
    next();
};

/**
 * The identity being protected, used as part of the counter key.
 */
const byIp = (req) => req.ip || 'unknown';

const byAccount = (req) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    return email ? `account:${email}` : 'account:unknown';
};

module.exports = { sharedLimit, byIp, byAccount };
