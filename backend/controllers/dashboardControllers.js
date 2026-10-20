const Income = require("../models/Income")
const Expense = require("../models/Expense")
const { Types } = require("mongoose")
const cache = require("../services/cache")

// How long a dashboard result may be reused. Writes invalidate the entry
// immediately, so this only helps when a user reloads without changing data.
const DASHBOARD_TTL_MS = Number(process.env.DASHBOARD_CACHE_TTL_MS || 15000)

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Builds the dashboard payload.
 *
 * The whole dashboard is produced with two round trips to MongoDB: one
 * aggregation per collection, each using $facet to compute every figure the
 * UI needs in a single pass. It used to take nine separate queries.
 */
const buildDashboard = async (userId) => {
    const userObjectId = new Types.ObjectId(String(userId))
    const now = Date.now()
    const sixtyDaysAgo = new Date(now - 60 * DAY_MS)
    const thirtyDaysAgo = new Date(now - 30 * DAY_MS)

    const [incomeResult, expenseResult] = await Promise.all([
        Income.aggregate([
            { $match: { userId: userObjectId } },
            // Only the fields the dashboard renders, so the pipeline moves as
            // little data as possible.
            { $project: { amount: 1, source: 1, date: 1, icon: 1 } },
            {
                $facet: {
                    totals: [{ $group: { _id: null, total: { $sum: "$amount" } } }],
                    bySourceAll: [
                        { $group: { _id: "$source", total: { $sum: "$amount" } } },
                        { $sort: { total: -1 } },
                        { $limit: 8 },
                    ],
                    bySource60: [
                        { $match: { date: { $gte: sixtyDaysAgo } } },
                        { $group: { _id: "$source", total: { $sum: "$amount" } } },
                        { $sort: { total: -1 } },
                        { $limit: 8 },
                    ],
                    last60: [
                        { $match: { date: { $gte: sixtyDaysAgo } } },
                        { $sort: { date: -1 } },
                    ],
                    recent: [
                        { $sort: { date: -1 } },
                        { $limit: 5 },
                    ],
                },
            },
        ]),
        Expense.aggregate([
            { $match: { userId: userObjectId } },
            { $project: { amount: 1, category: 1, date: 1, icon: 1 } },
            {
                $facet: {
                    totals: [{ $group: { _id: null, total: { $sum: "$amount" } } }],
                    byCategory: [
                        { $group: { _id: "$category", total: { $sum: "$amount" } } },
                        { $sort: { total: -1 } },
                        { $limit: 8 },
                    ],
                    last30: [
                        { $match: { date: { $gte: thirtyDaysAgo } } },
                        { $sort: { date: -1 } },
                    ],
                    recent: [
                        { $sort: { date: -1 } },
                        { $limit: 5 },
                    ],
                },
            },
        ]),
    ])

    const income = incomeResult[0] || {}
    const expense = expenseResult[0] || {}

    const last60DaysIncomeTransactions = income.last60 || []
    const last30DaysExpenseTransactions = expense.last30 || []

    const sumAmounts = (rows) => rows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0)

    const lastTransactions = [
        ...(income.recent || []).map((txn) => ({ ...txn, type: "income" })),
        ...(expense.recent || []).map((txn) => ({ ...txn, type: "expense" })),
    ].sort((a, b) => new Date(b.date) - new Date(a.date))

    const totalIncome = income.totals?.[0]?.total || 0
    const totalExpenses = expense.totals?.[0]?.total || 0

    return {
        totalBalance: totalIncome - totalExpenses,
        totalIncome,
        totalExpenses,
        expensesByCategory: (expense.byCategory || []).map(({ _id, total }) => ({ name: _id, total })),
        incomeBySource: (income.bySource60 || []).map(({ _id, total }) => ({ name: _id, total })),
        allIncomeBySource: (income.bySourceAll || []).map(({ _id, total }) => ({ name: _id, total })),
        last30DaysExpense: {
            total: sumAmounts(last30DaysExpenseTransactions),
            transactions: last30DaysExpenseTransactions,
        },
        last60DaysIncome: {
            total: sumAmounts(last60DaysIncomeTransactions),
            transactions: last60DaysIncomeTransactions,
        },
        recentTransactions: lastTransactions,
    }
}

// Dashboard Data
exports.getDashboardData = async (req, res) => {
    try {
        const userId = req.user.id
        const cacheKey = `dashboard:${userId}`

        const cached = cache.get(cacheKey)
        if (cached) {
            return res.set('X-Cache', 'HIT').json(cached)
        }

        const data = await buildDashboard(userId)
        cache.set(cacheKey, data, DASHBOARD_TTL_MS)
        return res.set('X-Cache', 'MISS').json(data)
    } catch (error) {
        console.error('dashboardControllers.getDashboardData error:', error)
        res.status(500).json({ message: "Server Error", error })
    }
}

// Called whenever a transaction changes, so the next dashboard read is fresh.
exports.invalidateDashboard = (userId) => {
    cache.del(`dashboard:${userId}`)
}
