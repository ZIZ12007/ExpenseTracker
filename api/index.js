/**
 * Vercel Serverless Function entry point.
 *
 * Vercel runs this file instead of a listening server. The Express app is
 * exported from backend/server.js, and the database connection is awaited
 * before the first request is handled so cold starts never return 503.
 */
const app = require('../backend/server');
const connectDB = require('../backend/config/db');

module.exports = async (req, res) => {
    try {
        await connectDB();
    } catch (err) {
        console.error('MongoDB connection failed:', err);
    }
    return app(req, res);
};
