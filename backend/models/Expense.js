const mongoose = require("mongoose")

const ExpenseSchema = new mongoose.Schema ({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true},
    icon: { type: String },
    category: { type: String, required: true },
    amount: { type: Number, required: true },
    date: { type: Date, default: Date.now },
}, { timestamps: true});

// Every query filters by user and orders by date, so this compound index
// turns collection scans into index seeks.
ExpenseSchema.index({ userId: 1, date: -1 });
ExpenseSchema.index({ userId: 1, category: 1 });

module.exports = mongoose.model("Expense", ExpenseSchema)
