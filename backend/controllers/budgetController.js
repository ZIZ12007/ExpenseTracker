const fs = require('fs');
const path = require('path');
const Expense = require('../models/Expense');
const Income = require('../models/Income');
const Timetable = require('../models/Timetable');
const RecurringExpense = require('../models/RecurringExpense');
const budget = require('../services/budget');
const ai = require('../services/ai');
const { resolveUploadsDir } = require('../config/storage');

const DAY = 24 * 60 * 60 * 1000;

const startOfToday = () => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now;
};

/**
 * How much the user has actually spent, over the given windows.
 */
const spending = async (userId) => {
    const today = startOfToday();
    const weekAgo = new Date(today.getTime() - 7 * DAY);
    const monthAgo = new Date(today.getTime() - 30 * DAY);

    const [todayAgg, weekAgg, monthAgg] = await Promise.all([
        Expense.aggregate([
            { $match: { userId, date: { $gte: today } } },
            { $group: { _id: null, total: { $sum: '$amount' } } },
        ]),
        Expense.aggregate([
            { $match: { userId, date: { $gte: weekAgo } } },
            { $group: { _id: null, total: { $sum: '$amount' } } },
        ]),
        Expense.aggregate([
            { $match: { userId, date: { $gte: monthAgo } } },
            { $group: { _id: null, total: { $sum: '$amount' } } },
        ]),
    ]);

    return {
        today: todayAgg[0]?.total || 0,
        week: weekAgg[0]?.total || 0,
        month: monthAgg[0]?.total || 0,
    };
};

/**
 * GET /api/v1/budget
 * The budget picture: allowance, commitments, what is left and what has been
 * spent.
 */
exports.getBudget = async (req, res) => {
    try {
        const user = req.user;
        const [recurring, spent, timetables] = await Promise.all([
            RecurringExpense.find({ userId: user._id, active: true }).sort({ createdAt: -1 }).lean(),
            spending(user._id),
            Timetable.find({ userId: user._id }).sort({ createdAt: -1 }).lean(),
        ]);

        const summary = budget.summarise({
            allowance: user.allowance,
            recurring,
            spentToday: spent.today,
            spentThisWeek: spent.week,
            spentThisMonth: spent.month,
        });

        res.status(200).json({
            summary,
            recurring,
            timetables,
            currency: user.currency,
            aiEnabled: ai.isConfigured(),
        });
    } catch (err) {
        console.error('budgetController.getBudget error:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

/**
 * POST /api/v1/budget/recurring
 * Adds a planned recurring expense.
 */
exports.addRecurring = async (req, res) => {
    const { title, amount, frequency, category, icon, dayOfWeek, dayOfMonth, startDate } = req.body || {};

    if (!title?.trim()) {
        return res.status(400).json({ message: 'Give the expense a name.' });
    }
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
        return res.status(400).json({ message: 'The amount must be greater than zero.' });
    }
    if (!['daily', 'weekly', 'monthly'].includes(frequency)) {
        return res.status(400).json({ message: 'Choose how often this happens: daily, weekly or monthly.' });
    }

    try {
        const item = await RecurringExpense.create({
            userId: req.user._id,
            title: title.trim(),
            amount: value,
            frequency,
            category: category || 'Other',
            icon: icon || '📌',
            dayOfWeek: Number(dayOfWeek) || 1,
            dayOfMonth: Math.min(Math.max(Number(dayOfMonth) || 1, 1), 28),
            startDate: startDate ? new Date(startDate) : new Date(),
        });
        res.status(201).json({ recurring: item });
    } catch (err) {
        console.error('budgetController.addRecurring error:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

/**
 * DELETE /api/v1/budget/recurring/:id
 */
exports.deleteRecurring = async (req, res) => {
    try {
        const deleted = await RecurringExpense.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
        if (!deleted) return res.status(404).json({ message: 'That recurring expense was not found' });
        res.status(200).json({ message: 'Removed.' });
    } catch (err) {
        console.error('budgetController.deleteRecurring error:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

/**
 * POST /api/v1/budget/timetable
 * Uploads a photo of the school timetable and reads the meals from it.
 */
exports.uploadTimetable = async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'Please choose an image of your timetable.' });
    }

    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'];
    if (!allowed.includes(req.file.mimetype)) {
        return res.status(400).json({ message: 'Upload a photo (JPG, PNG or WebP) of your timetable.' });
    }

    try {
        // Multer has already written the file to the uploads directory.
        const uploadsDir = resolveUploadsDir();
        const storedName = req.file.filename;
        const storedPath = path.join(uploadsDir, storedName);

        const timetable = await Timetable.create({
            userId: req.user._id,
            title: req.body?.title || 'School timetable',
            fileUrl: `/uploads/${storedName}`,
            fileName: req.file.originalname,
            status: 'processing',
        });

        if (!ai.isConfigured()) {
            timetable.status = 'failed';
            timetable.notes = 'The AI service is not configured, so the timetable could not be read. You can still add your meals by hand.';
            await timetable.save();
            return res.status(201).json({ timetable, message: 'Uploaded, but the AI is not configured so the meals were not read.' });
        }

        // Images are read directly; PDFs are left for the user to confirm.
        if (req.file.mimetype === 'application/pdf') {
            timetable.status = 'failed';
            timetable.notes = 'PDFs are not read automatically yet - upload a photo of the timetable instead.';
            await timetable.save();
            return res.status(201).json({ timetable, message: timetable.notes });
        }

        try {
            const bytes = fs.readFileSync(storedPath);
            const extracted = await ai.readTimetable({
                image: { base64: bytes.toString('base64'), mimeType: req.file.mimetype },
                currency: req.user.currency,
            });
            timetable.meals = extracted.meals;
            timetable.notes = extracted.notes;
            timetable.status = extracted.meals.length ? 'ready' : 'failed';
            timetable.extractedAt = new Date();
            await timetable.save();
        } catch (aiError) {
            console.error('Timetable extraction failed:', aiError.message);
            timetable.status = 'failed';
            timetable.notes = 'The timetable could not be read. Try a clearer, straight-on photo.';
            await timetable.save();
        }

        res.status(201).json({ timetable });
    } catch (err) {
        console.error('budgetController.uploadTimetable error:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

/**
 * PUT /api/v1/budget/timetable/:id
 * Corrects the meals that were read from the timetable.
 */
exports.updateTimetable = async (req, res) => {
    const { meals, title } = req.body || {};
    try {
        const timetable = await Timetable.findOne({ _id: req.params.id, userId: req.user._id });
        if (!timetable) return res.status(404).json({ message: 'Timetable not found' });

        if (typeof title === 'string' && title.trim()) timetable.title = title.trim();
        if (Array.isArray(meals)) {
            timetable.meals = meals.map((m) => ({
                day: String(m.day || '').trim(),
                breakfast: String(m.breakfast || '').trim(),
                lunch: String(m.lunch || '').trim(),
                supper: String(m.supper || '').trim(),
                estimatedCost: Number(m.estimatedCost) || 0,
            }));
            timetable.status = 'ready';
        }
        await timetable.save();
        res.status(200).json({ timetable });
    } catch (err) {
        console.error('budgetController.updateTimetable error:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

/**
 * DELETE /api/v1/budget/timetable/:id
 */
exports.deleteTimetable = async (req, res) => {
    try {
        const deleted = await Timetable.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
        if (!deleted) return res.status(404).json({ message: 'Timetable not found' });
        res.status(200).json({ message: 'Removed.' });
    } catch (err) {
        console.error('budgetController.deleteTimetable error:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

/**
 * POST /api/v1/budget/recommendations
 * A meal plan that fits what is left of the daily allowance.
 */
exports.getRecommendations = async (req, res) => {
    try {
        const user = req.user;
        const [recurring, spent, timetables] = await Promise.all([
            RecurringExpense.find({ userId: user._id, active: true }).lean(),
            spending(user._id),
            Timetable.find({ userId: user._id, status: 'ready' }).sort({ createdAt: -1 }).lean(),
        ]);

        const summary = budget.summarise({
            allowance: user.allowance,
            recurring,
            spentToday: spent.today,
            spentThisWeek: spent.week,
            spentThisMonth: spent.month,
        });

        const preferences = Array.isArray(req.body?.preferences) ? req.body.preferences : [];
        const timetable = timetables[0]?.meals || [];

        let plan = null;
        if (ai.isConfigured() && summary.hasAllowance) {
            try {
                plan = await ai.recommendMeals({
                    currency: user.currency,
                    dailyBudget: summary.dailyAllowance,
                    committedDaily: summary.committedDaily,
                    remainingToday: summary.remainingToday,
                    timetable,
                    preferences,
                    recentSpend: summary.spentToday,
                });
            } catch (aiError) {
                console.error('The AI could not produce a plan, using the built-in planner:', aiError.message);
            }
        }

        if (!plan) {
            plan = budget.fallbackPlan({
                foodBudget: summary.remainingToday || summary.foodBudget,
                currency: user.currency,
                preferences,
            });
        }

        res.status(200).json({ plan, summary, timetable });
    } catch (err) {
        console.error('budgetController.getRecommendations error:', err);
        res.status(500).json({ message: 'Server error' });
    }
};
