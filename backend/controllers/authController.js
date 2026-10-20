const User = require('../models/User');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const mailer = require('../services/mailer');
const {
    issueVerificationToken,
    issueResetToken,
    issueLoginToken,
    findByToken,
    clearToken,
    signState,
    verifyState,
} = require('../services/accountTokens');

// A short-lived access token plus a long-lived refresh token. The access
// token lives long enough that a normal user never sees a login prompt, and
// the refresh token lets the app issue a new access token without a
// password once the access token is gone.
const ACCESS_TOKEN_TTL = process.env.JWT_EXPIRES_IN || '7d';
const REFRESH_TOKEN_TTL = process.env.JWT_REFRESH_EXPIRES_IN || '30d';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';

const frontendUrl = () => process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:5173';
// Where the API is reachable from the outside world. On a single service
// deploy this is the same address as the frontend.
const apiUrl = () => process.env.PUBLIC_URL || process.env.FRONTEND_URL || frontendUrl();

const publicUser = (user) => {
    const result = user.toObject()
    delete result.password
    delete result.verifyToken
    delete result.verifyTokenExpires
    delete result.resetToken
    delete result.resetTokenExpires
    return result
}

// GENERATE JWT TOKEN
const generateToken = (id, type = 'access') => {
    const expiresIn = type === 'refresh' ? REFRESH_TOKEN_TTL : ACCESS_TOKEN_TTL;
    return jwt.sign({ id, type }, process.env.JWT_SECRET, { expiresIn });
}

// The token pair returned to the client
const issueTokens = (id) => ({
    token: generateToken(id, 'access'),
    refreshToken: generateToken(id, 'refresh'),
});

const verificationLink = (token) => `${frontendUrl()}/verify-email?token=${encodeURIComponent(token)}`;
const resetLink = (token) => `${frontendUrl()}/reset-password?token=${encodeURIComponent(token)}`;

/**
 * Sends the verification email, logging a warning rather than failing the
 * request if the mail service is unavailable.
 */
const sendVerification = async (user) => {
    const token = issueVerificationToken(user);
    await user.save();
    try {
        await mailer.sendVerificationEmail({
            to: user.email,
            name: user.fullName,
            link: verificationLink(token),
        });
    } catch (err) {
        console.error('Could not send the verification email:', err.message);
    }
    return token;
}

/**
 * Tells the account holder that somebody signed in.
 *
 * How often this happens is controlled by SEND_SIGN_IN_EMAIL:
 *   always       - every sign in (the default)
 *   new_device   - only the first sign in from a device, which keeps a shared
 *                  email allowance from being used up by one busy user
 *   off          - never
 */
const notifySignIn = async (user, req) => {
    const mode = (process.env.SEND_SIGN_IN_EMAIL || 'always').toLowerCase();
    if (mode === 'off') return;

    const fingerprint = crypto.createHash('sha256')
        .update(`${req.get('user-agent') || ''}|${req.ip || ''}`)
        .digest('hex')
        .slice(0, 16);

    const known = user.knownDevices || [];
    const isNewDevice = !known.includes(fingerprint);

    if (mode === 'new_device' && !isNewDevice) {
        return;
    }

    if (isNewDevice) {
        user.knownDevices = [fingerprint, ...known].slice(0, 5);
        await user.save();
    }

    const device = (req.get('user-agent') || '').split(')')[0].replace(/^.*\//, '') || 'unknown';
    await mailer.sendSafely(() => mailer.sendSignInEmail({
        to: user.email,
        name: user.fullName,
        when: new Date().toUTCString(),
        device: device.slice(0, 60),
        ip: req.ip,
    }));
};

// REGISTER USER
exports.registerUser = async (req, res) => {
    const { fullName, email, password, username, profileImageUrl } = req.body || {};
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''

    if (!fullName?.trim() || !normalizedEmail || typeof password !== 'string' || password.length < 8) {
        return res.status(400).json({ message: 'Provide your name, a valid email, and a password with at least 8 characters.' });
    }

    try {
        // Check if user already exists
        const existingUser = await User.findOne({ email: normalizedEmail });
        if (existingUser) {
            // Signing up with an address that is already registered signs them
            // in, as long as the password matches. Anything else would let
            // anyone into an account just by knowing its email address.
            if (await existingUser.comparePassword(password)) {
                await notifySignIn(existingUser, req);
                return res.status(200).json({
                    id: existingUser._id,
                    user: publicUser(existingUser),
                    ...issueTokens(existingUser._id),
                    alreadyRegistered: true,
                    message: 'You already have an account, so you have been signed in.',
                });
            }
            return res.status(409).json({
                message: 'An account already exists with this email. Sign in instead, or reset your password.',
            });
        }

        if (username) {
            const taken = await User.findOne({ username: username.trim() });
            if (taken) {
                return res.status(400).json({ message: 'That username is already taken.' });
            }
        }

        // Create new user
        const user = await User.create({
            fullName: fullName.trim(),
            email: normalizedEmail,
            password,
            username: username ? username.trim() : undefined,
            profileImageUrl,
            provider: 'local',
        });

        await sendVerification(user);

        res.status(201).json({
            id: user._id,
            user: publicUser(user),
            ...issueTokens(user._id),
        });
    } catch (err) {
        console.error('authController.registerUser error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
}

// LOGIN USER
exports.loginUser = async (req, res) => {
    const { email, password } = req.body || {}
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''
    if (!normalizedEmail || !password || typeof password !== 'string') {
        return res.status(400).json({ message: 'Please provide email and password' });
    }
    try {
        const user = await User.findOne({ email: normalizedEmail });
        if (!user || !(await user.comparePassword(password))) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        await notifySignIn(user, req);

        res.status(200).json({
            id: user._id,
            user: publicUser(user),
            ...issueTokens(user._id),
        });
    } catch (err) {
        console.error('authController.loginUser error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
}

// REFRESH TOKEN - exchange a refresh token for a new token pair
exports.refreshSession = async (req, res) => {
    const { refreshToken } = req.body || {}
    if (!refreshToken) {
        return res.status(400).json({ message: 'A refresh token is required.' });
    }

    try {
        const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
        if (decoded.type !== 'refresh') {
            return res.status(401).json({ message: 'Invalid refresh token' });
        }

        const user = await User.findById(decoded.id).select('-password');
        if (!user) {
            return res.status(401).json({ message: 'User not found' });
        }

        res.status(200).json({
            id: user._id,
            user: publicUser(user),
            ...issueTokens(user._id),
        });
    } catch (err) {
        console.error('authController.refreshSession error:', err);
        res.status(401).json({ message: 'Refresh token is not valid' });
    }
}

// GET USER INFO
exports.getUserInfo = async (req, res) => {
    try{
        const user = await User.findById(req.user.id).select('-password');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.status(200).json(user);
    } catch (err) {
        console.error('authController.getUserInfo error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
}

// VERIFY EMAIL
exports.verifyEmail = async (req, res) => {
    const { token } = req.body || {};
    if (!token) {
        return res.status(400).json({ message: 'A verification token is required.' });
    }

    try {
        const user = await findByToken(User, 'verifyToken', token);
        if (!user) {
            return res.status(400).json({ message: 'This verification link is invalid or has expired.' });
        }

        user.emailVerified = true;
        clearToken(user, 'verifyToken');
        await user.save();

        res.status(200).json({ message: 'Your email address is verified.', user: publicUser(user) });
    } catch (err) {
        console.error('authController.verifyEmail error:', err);
        res.status(500).json({ message: 'Server error' });
    }
}

// RESEND THE VERIFICATION EMAIL
exports.resendVerification = async (req, res) => {
    const { email } = req.body || {};
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (!normalizedEmail) {
        return res.status(400).json({ message: 'Please provide your email address.' });
    }

    try {
        const user = await User.findOne({ email: normalizedEmail });
        // The same answer either way, so the endpoint cannot be used to find
        // out which addresses are registered.
        if (user && !user.emailVerified) {
            await sendVerification(user);
        }
        res.status(200).json({ message: 'If that address needs verifying, a new link is on its way.' });
    } catch (err) {
        console.error('authController.resendVerification error:', err);
        res.status(500).json({ message: 'Server error' });
    }
}

// FORGOT PASSWORD - send a reset link
exports.forgotPassword = async (req, res) => {
    const { email } = req.body || {};
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (!normalizedEmail) {
        return res.status(400).json({ message: 'Please provide your email address.' });
    }

    try {
        const user = await User.findOne({ email: normalizedEmail });
        if (user && user.provider === 'local') {
            const token = issueResetToken(user);
            await user.save();
            try {
                await mailer.sendPasswordResetEmail({
                    to: user.email,
                    name: user.fullName,
                    link: resetLink(token),
                });
            } catch (err) {
                console.error('Could not send the password reset email:', err.message);
            }
        }
        // Always the same answer, so the endpoint cannot be used to find out
        // which addresses are registered.
        res.status(200).json({ message: 'If that address has an account, a reset link is on its way.' });
    } catch (err) {
        console.error('authController.forgotPassword error:', err);
        res.status(500).json({ message: 'Server error' });
    }
}

// RESET PASSWORD
exports.resetPassword = async (req, res) => {
    const { token, password } = req.body || {};
    if (!token || typeof password !== 'string' || password.length < 8) {
        return res.status(400).json({ message: 'Provide a valid token and a password with at least 8 characters.' });
    }

    try {
        const user = await findByToken(User, 'resetToken', token);
        if (!user) {
            return res.status(400).json({ message: 'This reset link is invalid or has expired.' });
        }

        user.password = password;
        clearToken(user, 'resetToken');
        await user.save();

        await mailer.sendSafely(() => mailer.sendPasswordChangedEmail({
            to: user.email,
            name: user.fullName,
            when: new Date().toUTCString(),
        }));

        res.status(200).json({ message: 'Your password has been changed.', ...issueTokens(user._id) });
    } catch (err) {
        console.error('authController.resetPassword error:', err);
        res.status(500).json({ message: 'Server error' });
    }
}

// GOOGLE SIGN IN - start the redirect
exports.googleStart = async (req, res) => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
        return res.status(501).json({ message: 'Google sign in is not configured on this server.' });
    }

    const redirectUri = `${req.protocol}://${req.get('host')}${req.baseUrl}${req.path}/callback`;
    const state = signState({ redirectTo: req.query.redirectTo });

    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'openid email profile',
        access_type: 'offline',
        prompt: 'select_account',
        state,
    });

    res.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`);
};

// GOOGLE SIGN IN - handle the callback
exports.googleCallback = async (req, res) => {
    const { code, state, error } = req.query;

    if (error) {
        return res.redirect(`${frontendUrl()}/login?error=${encodeURIComponent('Google sign in was cancelled.')}`);
    }
    if (!code) {
        return res.redirect(`${frontendUrl()}/login?error=${encodeURIComponent('Google sign in failed.')}`);
    }

    const verifiedState = verifyState(state);
    if (!verifiedState) {
        return res.redirect(`${frontendUrl()}/login?error=${encodeURIComponent('The sign in request could not be verified.')}`);
    }

    try {
        const redirectUri = `${req.protocol}://${req.get('host')}${req.baseUrl}${req.path}`;

        const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                code,
                client_id: process.env.GOOGLE_CLIENT_ID,
                client_secret: process.env.GOOGLE_CLIENT_SECRET,
                redirect_uri: redirectUri,
                grant_type: 'authorization_code',
            }),
        });
        const tokenData = await tokenResponse.json();
        if (!tokenResponse.ok) {
            throw new Error(tokenData?.error_description || 'Could not exchange the code');
        }

        const profileResponse = await fetch(GOOGLE_USERINFO_URL, {
            headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        const profile = await profileResponse.json();
        if (!profileResponse.ok || !profile.email) {
            throw new Error('Could not read the Google profile');
        }

        const email = profile.email.toLowerCase();
        let user = await User.findOne({ email });

        if (!user) {
            user = await User.create({
                fullName: profile.name || email.split('@')[0],
                email,
                username: (profile.given_name || email.split('@')[0]).replace(/[^a-zA-Z0-9_.]/g, '').slice(0, 24) || undefined,
                password: undefined,
                profileImageUrl: profile.picture || null,
                provider: 'google',
                googleId: profile.sub,
                emailVerified: true,   // Google has already confirmed the address
            });
        } else {
            // An existing local account keeps its password; the Google link
            // simply becomes another way in.
            user.provider = 'google';
            user.googleId = user.googleId || profile.sub;
            user.emailVerified = true;
            if (profile.picture && !user.profileImageUrl) user.profileImageUrl = profile.picture;
            await user.save();
        }

        const tokens = issueTokens(user._id);
        await notifySignIn(user, req);
        const fragment = new URLSearchParams({ token: tokens.token, refreshToken: tokens.refreshToken });
        res.redirect(`${frontendUrl()}/auth/callback#${fragment.toString()}`);
    } catch (err) {
        console.error('authController.googleCallback error:', err);
        res.redirect(`${frontendUrl()}/login?error=${encodeURIComponent('Google sign in failed. Please try again.')}`);
    }
};

// SIGN IN WITH AN EMAIL LINK - send a one time link
exports.requestMagicLink = async (req, res) => {
    const { email } = req.body || {};
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (!normalizedEmail) {
        return res.status(400).json({ message: 'Please provide your email address.' });
    }

    try {
        let user = await User.findOne({ email: normalizedEmail });
        const isNewAccount = !user;

        if (!user) {
            // Signing up and signing in are the same action with a link.
            user = await User.create({
                fullName: normalizedEmail.split('@')[0].replace(/[._-]+/g, ' '),
                email: normalizedEmail,
                password: undefined,
                provider: 'email',
                emailVerified: true,   // the link proves they own the address
            });
        }

        const token = issueLoginToken(user);
        await user.save();

        try {
            await mailer.sendMagicLinkEmail({
                to: user.email,
                name: user.fullName,
                link: `${apiUrl()}/api/v1/auth/magic-link?token=${encodeURIComponent(token)}`,
                isNewAccount,
            });
        } catch (err) {
            console.error('Could not send the sign in link:', err.message);
        }

        res.status(200).json({ message: 'If that address can receive mail, a sign in link is on its way.' });
    } catch (err) {
        console.error('authController.requestMagicLink error:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

// SIGN IN WITH AN EMAIL LINK - the link itself
exports.magicLinkEntry = async (req, res) => {
    const { token } = req.query || {};
    if (!token) {
        return res.redirect(`${frontendUrl()}/login?error=${encodeURIComponent('That sign in link is invalid.')}`);
    }

    try {
        const user = await findByToken(User, 'loginToken', token);
        if (!user) {
            return res.redirect(`${frontendUrl()}/login?error=${encodeURIComponent('That sign in link is invalid or has expired.')}`);
        }

        clearToken(user, 'loginToken');
        user.emailVerified = true;
        await user.save();

        await notifySignIn(user, req);

        const tokens = issueTokens(user._id);
        const fragment = new URLSearchParams({ token: tokens.token, refreshToken: tokens.refreshToken });
        res.redirect(`${frontendUrl()}/auth/callback#${fragment.toString()}`);
    } catch (err) {
        console.error('authController.magicLinkEntry error:', err);
        res.redirect(`${frontendUrl()}/login?error=${encodeURIComponent('That sign in link could not be used.')}`);
    }
};

// SIGN IN WITH AN EMAIL LINK - exchange the link for a session
exports.verifyMagicLink = async (req, res) => {
    const { token } = req.body || {};
    if (!token) {
        return res.status(400).json({ message: 'A sign in token is required.' });
    }

    try {
        const user = await findByToken(User, 'loginToken', token);
        if (!user) {
            return res.status(400).json({ message: 'This sign in link is invalid or has expired.' });
        }

        clearToken(user, 'loginToken');
        user.emailVerified = true;
        await user.save();

        res.status(200).json({
            id: user._id,
            user: publicUser(user),
            ...issueTokens(user._id),
        });
    } catch (err) {
        console.error('authController.verifyMagicLink error:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

// Does this server have Google sign in available?
exports.googleStatus = async (req, res) => {
    res.status(200).json({ enabled: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) });
};

/**
 * What is switched on, so it can be checked without guessing.
 */
exports.serviceStatus = async (req, res) => {
    const brevo = require('../services/providers/brevo');
    const resend = require('../services/providers/resend');
    const ai = require('../services/ai');

    const provider = process.env.MAIL_PROVIDER?.toLowerCase()
        || (brevo.isConfigured() ? 'brevo' : 'resend');

    res.status(200).json({
        email: {
            provider,
            configured: provider === 'brevo' ? brevo.isConfigured() : resend.isConfigured(),
            sender: provider === 'brevo' ? brevo.sender().email : (process.env.MAIL_FROM || ''),
            signInEmails: process.env.SEND_SIGN_IN_EMAIL || 'always',
        },
        ai: {
            configured: ai.isConfigured(),
            models: ai.MODEL_CHAIN,
        },
        google: {
            enabled: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
        },
    });
};
