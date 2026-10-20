const mongoose = require('mongoose');

/**
 * An expense the user expects to make regularly - transport every day,
 * data bundle every week, rent every month.
 *
 * These are planned commitments, kept separate from the transactions that have
 * actually happened, so the app can work out how much of the allowance is
 * already spoken for.
 */
const RecurringExpenseSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    frequency: { type: String, enum: ['daily', 'weekly', 'monthly'], required: true },
    category: { type: String, default: 'Other' },
    icon: { type: String, default: '📌' },
    // Which day a weekly or monthly charge lands on.
    dayOfWeek: { type: Number, default: 1, min: 0, max: 6 },
    dayOfMonth: { type: Number, default: 1, min: 1, max: 28 },
    startDate: { type: Date, default: Date.now },
    active: { type: Boolean, default: true },
}, { timestamps: true });

RecurringExpenseSchema.index({ userId: 1, active: 1 });

module.exports = mongoose.model('RecurringExpense', RecurringExpenseSchema);
