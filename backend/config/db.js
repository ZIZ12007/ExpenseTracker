const mongoose = require('mongoose');

const connectDB = async () => {
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

    console.warn('MongoDB not available; starting backend in offline mode.');
    if (lastError) {
        console.warn(lastError.message);
    }
};

module.exports = connectDB;