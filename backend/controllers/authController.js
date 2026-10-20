const User = require('../models/User');
const jwt = require('jsonwebtoken');

// A short-lived access token plus a long-lived refresh token. The access
// token lives long enough that a normal user never sees a login prompt, and
// the refresh token lets the app issue a new access token without a
// password once the access token is gone.
const ACCESS_TOKEN_TTL = process.env.JWT_EXPIRES_IN || '7d';
const REFRESH_TOKEN_TTL = process.env.JWT_REFRESH_EXPIRES_IN || '30d';

const publicUser = (user) => {
    const result = user.toObject()
    delete result.password
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

// REGISTER USER
exports.registerUser = async (req, res) => {
    const { fullName, email, password, profileImageUrl } = req.body || {};
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''

    if (!fullName?.trim() || !normalizedEmail || typeof password !== 'string' || password.length < 8) {
        return res.status(400).json({ message: 'Provide your name, a valid email, and a password with at least 8 characters.' });
    }

    try {
        // Check if user already exists
        const existingUser = await User.findOne({ email: normalizedEmail });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists with this email' });
        }

        // Create new user
        const user = await User.create({
            fullName: fullName.trim(),
            email: normalizedEmail,
            password,
            profileImageUrl
        });

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
