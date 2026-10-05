const Income = require("../models/Income")
const Expense = require("../models/Expense")
const { Types } = require("mongoose")

// Dashboard Data
exports.getDashboardData = async (req, res) => {
    try {
        const userId = req.user.id
        const userObjectId = new Types.ObjectId(String(userId))

        const [incomeTotals, expenseTotals, expensesByCategory, incomeBySource, allIncomeBySource] = await Promise.all([
            Income.aggregate([
                { $match: { userId: userObjectId } },
                { $group: { _id: null, total: { $sum: "$amount" } } },
            ]),
            Expense.aggregate([
                { $match: { userId: userObjectId } },
                { $group: { _id: null, total: { $sum: "$amount" } } },
            ]),
            Expense.aggregate([
                { $match: { userId: userObjectId } },
                { $group: { _id: "$category", total: { $sum: "$amount" } } },
                { $sort: { total: -1 } },
                { $limit: 8 },
            ]),
            Income.aggregate([
                {
                    $match: {
                        userId: userObjectId,
                        date: { $gte: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) },
                    },
                },
                { $group: { _id: "$source", total: { $sum: "$amount" } } },
                { $sort: { total: -1 } },
                { $limit: 8 },
            ]),
            Income.aggregate([
                { $match: { userId: userObjectId } },
                { $group: { _id: "$source", total: { $sum: "$amount" } } },
                { $sort: { total: -1 } },
                { $limit: 8 },
            ]),
        ])

        // Get Income transactions in the last 60 days
        const [last60DaysIncomeTransactions, last30DaysExpenseTransactions] = await Promise.all([
            Income.find({
                userId: userObjectId,
                date: { $gte: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)},
            }).sort({ date: -1 }),
            Expense.find({
                userId: userObjectId,
                date: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)},
            }).sort({ date: -1 }),
        ])

        // Get total income for last 60 days
        const incomeLast60Days = last60DaysIncomeTransactions.reduce(
            (sum, transaction) => sum + transaction.amount,
            0
        )

        // Get Expense transactions in the last 30 days
        // Get total Expense for last 30 days
        const expensesLast30Days = last30DaysExpenseTransactions.reduce(
            (sum, transaction) => sum + transaction.amount,
            0
        )

        // Fetch last 5 transactions (income + expenses)
        const lastTransactions = [
            ...(await Income.find({ userId: userObjectId }).sort({ date: -1 }).limit(5)).map(
                (txn) => ({
                    ...txn.toObject(),
                    type: "income",
                })
            ), 
            ...(await Expense.find({ userId: userObjectId }).sort({ date: -1 }).limit(5)).map(
                (txn) => ({
                    ...txn.toObject(),
                    type: "expense",
                })
            ),
        ].sort((a, b) => b.date - a.date)

        // Final Response
        res.json({
            totalBalance:
                (incomeTotals[0]?.total || 0) - (expenseTotals[0]?.total || 0),
            totalIncome: incomeTotals[0]?.total || 0,
            totalExpenses: expenseTotals[0]?.total || 0,
            expensesByCategory: expensesByCategory.map(({ _id, total }) => ({ name: _id, total })),
            incomeBySource: incomeBySource.map(({ _id, total }) => ({ name: _id, total })),
            allIncomeBySource: allIncomeBySource.map(({ _id, total }) => ({ name: _id, total })),
            last30DaysExpense: {
                total: expensesLast30Days,
                transactions: last30DaysExpenseTransactions,
            },
            last60DaysIncome: {
                total: incomeLast60Days,
                transactions: last60DaysIncomeTransactions,
            },
            recentTransactions: lastTransactions,
        })
    } catch (error) {
        res.status(500).json({ message: "Server Error", error })
    }
}