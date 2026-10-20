const xlsx = require('xlsx');
const Expense = require('../models/Expense');
const { invalidateDashboard } = require('./dashboardControllers');
const { listTransactions } = require('../services/transactionList');

// Excel exports are generated in memory, so the row count is capped to keep
// the response (and the function's memory) bounded.
const MAX_EXPORT_ROWS = 10000;

// Add Expense Source
exports.addExpense = async (req, res) => {

    const userId = req.user.id;

    try {
        const { icon, category, amount, date } = req.body;

        // Validation check for missing fields
        if (!category?.trim() || !Number.isFinite(Number(amount)) || Number(amount) <= 0) {
            return res.status(400).json({ message: 'Please provide source and amount' });
        }

        const expenseDate = date ? new Date(date) : new Date()
        if (Number.isNaN(expenseDate.getTime())) {
            return res.status(400).json({ message: 'Please provide a valid date' })
        }

        const newExpense = new Expense({
            userId,
            icon,
            category,
            amount,
            date: expenseDate
        })

        await newExpense.save();
        invalidateDashboard(userId);
        res.status(200).json({ newExpense })
    } catch (error) {
        console.error('expenseController.addExpense error:', error)
        res.status(500).json({ message: 'Server error' })
    }
}

// Get Expense Sources (paginated)
exports.getAllExpense = async (req, res) => {
    // Ensure the user is authenticated
    if (!req.user || !req.user.id) {
        return res.status(401).json({ message: 'Not authorized' })
    }

    try {
        const result = await listTransactions(Expense, {
            userId: req.user.id,
            query: req.query,
            searchFields: ['category'],
        })
        res.status(200).json(result)
    } catch (error) {
        console.error('expenseController.getAllExpense error:', error)
        res.status(500).json({ message: 'Server error' })
    }
}

// Delete Expense Source
exports.deleteExpense = async (req, res) => {
    try {
        const deletedExpense = await Expense.findOneAndDelete({
            _id: req.params.id,
            userId: req.user.id,
        })
        if (!deletedExpense) {
            return res.status(404).json({ message: 'Expense not found' })
        }
        invalidateDashboard(req.user.id);
        res.json({ message: 'Expense deleted successfully' })
    } catch (error) {
        console.error('expenseController.deleteExpense error:', error)
        res.status(500).json({ message: 'Server Error' })
    }
};

// Download Expense as Excel
exports.downloadExpenseExcel = async (req, res) => {
    const userId = req.user.id

    try {
        const expense = await Expense.find({ userId })
            .sort({ date: -1 })
            .limit(MAX_EXPORT_ROWS)
            .lean()

        //Prepare data for excel
        const data = expense.map((item) => ({
            Category: item.category,
            Amount: item.amount,
            Date: item.date,
        }))

        const wb = xlsx.utils.book_new()
        const ws = xlsx.utils.json_to_sheet(data)
        xlsx.utils.book_append_sheet(wb, ws, "Expenses")
        const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' })
        res.setHeader('Content-Disposition', 'attachment; filename="expense_details.xlsx"')
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        res.send(buffer)
    } catch (error) {
        res.status(500).json({ message: "Server Error" })
    }
}
