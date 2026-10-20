const jwt = require('jsonwebtoken');
const User = require('../models/User');
const cache = require('../services/cache');

// The user record is looked up on every authenticated request. At the
// request rates this app sees, that lookup is a large share of all database
// traffic, so it is cached briefly. The TTL is short enough that a deleted
// or changed user is picked up almost immediately.
const USER_CACHE_TTL_MS = Number(process.env.USER_CACHE_TTL_MS || 60000);

exports.protect = async (req, res, next) => {
    let token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: 'No token provided, authorization denied' });

    try {
        if (!process.env.JWT_SECRET) {
            console.error('JWT_SECRET is not set in environment');
            return res.status(500).json({ message: 'Server configuration error' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // A refresh token must never be accepted as an access token.
        if (decoded.type && decoded.type !== 'access') {
            return res.status(401).json({ message: 'Invalid token type' });
        }

        const cacheKey = `user:${decoded.id}`;
        let user = cache.get(cacheKey);
        if (!user) {
            user = await User.findById(decoded.id).select('-password');
            if (!user) return res.status(401).json({ message: 'User not found' });
            cache.set(cacheKey, user, USER_CACHE_TTL_MS);
        }

        req.user = user;
        next();
    } catch (err) {
        console.error('authMiddleware.protect error:', err);
        res.status(401).json({ message: 'Token is not valid' });
    }
}
