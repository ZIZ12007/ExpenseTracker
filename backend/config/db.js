const mongoose = require('mongoose');

let connectionPromise = null;

/**
 * Connects to MongoDB once and caches the promise.
 *
 * The cached promise matters on serverless hosts (Vercel), where the module is
 * re-evaluated on every cold start: without it each invocation would try to
 * open a new connection.
 */
const connectDB = async () => {
    if (connectionPromise) return connectionPromise;

    connectionPromise = (async () => {
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
    })();

    return connectionPromise;
};

module.exports = connectDB;
