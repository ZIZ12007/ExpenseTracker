const mongoose = require('mongoose');

let connectionPromise = null;

const attemptConnection = async () => {
    const candidates = [
        process.env.MONGO_URL,
        'mongodb://127.0.0.1:27017/expensetracker',
    ].filter(Boolean);

    let lastError = null;

    for (const mongoUrl of candidates) {
        try {
            await mongoose.connect(mongoUrl, {
                serverSelectionTimeoutMS: 15000,
            });
            console.log('MongoDB connected.');
            return;
        } catch (error) {
            lastError = error;
            console.warn('MongoDB connection failed for a configured URI.');
            console.warn(error.message);
        }
    }

    // Fallback: spin up an in-memory MongoDB server for local development
    try {
        console.log('Attempting to start in-memory MongoDB server...');
        // Resolved dynamically so bundlers do not require this dev-only
        // package to exist in production bundles.
        const packageName = 'mongodb-memory-server';
        const { MongoMemoryServer } = require(packageName);
        const mongod = await MongoMemoryServer.create();
        const uri = mongod.getUri();
        await mongoose.connect(uri);
        console.log('In-memory MongoDB connected at', uri);
        return;
    } catch (memError) {
        console.warn('In-memory MongoDB failed:', memError.message);
    }

    console.warn('MongoDB not available; starting backend in offline mode.');
    if (lastError) {
        console.warn(lastError.message);
    }
};

// A dropped connection must not leave the app permanently broken: clear the
// cached promise so the next request reconnects.
mongoose.connection.on('disconnected', () => {
    if (connectionPromise) {
        console.warn('MongoDB connection dropped; will reconnect on the next request.');
        connectionPromise = null;
    }
});
mongoose.connection.on('error', (err) => {
    console.error('MongoDB connection error:', err.message);
});

/**
 * Connects to MongoDB once and caches the promise.
 *
 * The cached promise matters on serverless hosts (Vercel), where the module is
 * re-evaluated on every cold start: without it each invocation would try to
 * open a new connection. It is cleared when the connection drops so a
 * long-lived instance can recover.
 */
const connectDB = async () => {
    if (mongoose.connection.readyState === 1) return;      // already connected

    // The 'disconnected' handler clears the cached promise, so a stale promise
    // here means a connection attempt is still in flight.
    if (!connectionPromise) {
        connectionPromise = attemptConnection();
    }

    try {
        await connectionPromise;
    } catch (err) {
        connectionPromise = null;
        throw err;
    }
};

module.exports = connectDB;
