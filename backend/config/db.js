const mongoose = require('mongoose');

let connectionPromise = null;

/**
 * Connection options tuned for serverless hosting.
 *
 * Mongoose's default maxPoolSize is 100, so every warm instance can open up
 * to 100 MongoDB connections. A handful of concurrent instances would then
 * exhaust the database's connection limit. A small pool per instance keeps
 * the total well under control, and waitQueueTimeoutMS makes the overload
 * visible as a fast error instead of a hanging request.
 */
const connectionOptions = {
    serverSelectionTimeoutMS: Number(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS || 10000),
    connectTimeoutMS: Number(process.env.MONGO_CONNECT_TIMEOUT_MS || 10000),
    maxPoolSize: Number(process.env.MONGO_MAX_POOL_SIZE || 5),
    minPoolSize: Number(process.env.MONGO_MIN_POOL_SIZE || 0),
    waitQueueTimeoutMS: Number(process.env.MONGO_WAIT_QUEUE_TIMEOUT_MS || 5000),
    maxIdleTimeMS: Number(process.env.MONGO_MAX_IDLE_TIME_MS || 30000),
};

/**
 * Creates the indexes the queries rely on.
 *
 * Without an index on { userId, date } every dashboard query is a full
 * collection scan, which is the single biggest cost at scale. Indexes are
 * created explicitly (instead of relying on Mongoose's autoIndex, which is
 * off in production) and are safe to run on every connection.
 */
const ensureIndexes = async () => {
    try {
        const User = require('../models/User');
        const Income = require('../models/Income');
        const Expense = require('../models/Expense');
        await Promise.all([
            User.createIndexes(),
            Income.createIndexes(),
            Expense.createIndexes(),
        ]);
        console.log('MongoDB indexes are up to date.');
    } catch (err) {
        // Never block startup on an index build.
        console.error('Index creation failed:', err.message);
    }
};

const attemptConnection = async () => {
    const candidates = [
        process.env.MONGO_URL,
        'mongodb://127.0.0.1:27017/expensetracker',
    ].filter(Boolean);

    let lastError = null;

    for (const mongoUrl of candidates) {
        try {
            await mongoose.connect(mongoUrl, connectionOptions);
            console.log('MongoDB connected.');
            await ensureIndexes();
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
        await mongoose.connect(uri, connectionOptions);
        console.log('In-memory MongoDB connected at', uri);
        await ensureIndexes();
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
module.exports.ensureIndexes = ensureIndexes;
module.exports.connectionOptions = connectionOptions;
