const crypto = require('crypto');
const jwt = require('jsonwebtoken');

/**
 * One-time tokens for email verification and password recovery.
 *
 * They are random, stored hashed, and expire.
 */
const randomToken = () => crypto.randomBytes(32).toString('hex');

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const issueToken = (user, field, ttlMs) => {
    const token = randomToken();
    user[field] = hashToken(token);
    user[`${field}Expires`] = new Date(Date.now() + ttlMs);
    return token;
};

const VERIFY_TTL_MS = 24 * 60 * 60 * 1000;        // 24 hours
const RESET_TTL_MS = 60 * 60 * 1000;             // 1 hour
const LOGIN_TTL_MS = 15 * 60 * 1000;             // 15 minutes

const issueVerificationToken = (user) => issueToken(user, 'verifyToken', VERIFY_TTL_MS);
const issueResetToken = (user) => issueToken(user, 'resetToken', RESET_TTL_MS);
const issueLoginToken = (user) => issueToken(user, 'loginToken', LOGIN_TTL_MS);

const findByToken = (User, field, token) =>
    User.findOne({
        [field]: hashToken(token),
        [`${field}Expires`]: { $gt: new Date() },
    });

const clearToken = (user, field) => {
    user[field] = null;
    user[`${field}Expires`] = null;
};

/**
 * The state parameter for the Google sign-in redirect.
 *
 * It is a signed token so the callback can prove the redirect came from this
 * app, and it carries the redirect the user should land on afterwards.
 */
const signState = ({ redirectTo }) =>
    jwt.sign({ redirectTo: redirectTo || '/dashboard', nonce: crypto.randomBytes(8).toString('hex') }, process.env.JWT_SECRET, { expiresIn: '10m' });

const verifyState = (state) => {
    try {
        return jwt.verify(state, process.env.JWT_SECRET);
    } catch {
        return null;
    }
};

module.exports = {
    issueVerificationToken,
    issueResetToken,
    issueLoginToken,
    findByToken,
    clearToken,
    hashToken,
    signState,
    verifyState,
    VERIFY_TTL_MS,
    RESET_TTL_MS,
    LOGIN_TTL_MS,
};
