const jwt = require('jsonwebtoken');
const User = require('../models/User');

exports.protect = async (req, res, next) => {
    let token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: 'No token provided, authorization denied' });

    try {
        if (!process.env.JWT_SECRET) {
            console.error('JWT_SECRET is not set in environment');
            return res.status(500).json({ message: 'Server configuration error' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id).select('-password');
        if (!user) return res.status(401).json({ message: 'User not found' });

        req.user = user;
        next();
    } catch (err) {
        console.error('authMiddleware.protect error:', err);
        res.status(401).json({ message: 'Token is not valid' });
    }
}