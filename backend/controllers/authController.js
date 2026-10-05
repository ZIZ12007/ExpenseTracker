const User = require('../models/User');
const jwt = require('jsonwebtoken');

const publicUser = (user) => {
    const result = user.toObject()
    delete result.password
    return result
}

// GENERATE JWT TOKEN
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

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
            token: generateToken(user._id),
        });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
}

// LOGIN USER
exports.loginUser = async (req, res) => {
    const { email, password } = req.body || {}
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''
    if (!normalizedEmail || typeof password !== 'string' || !password) {
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
            token: generateToken(user._id),
        });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
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
        res.status(500).json({ message: 'Server error', error: err.message });
    }
}