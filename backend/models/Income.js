const mongoose = require('mongoose');

const IncomeSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true},
    icon: { type: String },
    source: { type: String, required: true }, // Example: Salary, Freelance, etc.
    amount: { type: Number, required: true },
    date: { type: Date, default: Date.now },
}, { timestamps: true});

// Every query filters by user and orders by date, so this compound index
// turns collection scans into index seeks.
IncomeSchema.index({ userId: 1, date: -1 });
IncomeSchema.index({ userId: 1, source: 1 });

module.exports = mongoose.model('Income', IncomeSchema)
