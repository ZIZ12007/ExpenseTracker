/**
 * The budget engine.
 *
 * Works out how much of the daily allowance is already spoken for by the
 * recurring expenses, what is left for food, and - when the AI is not
 * available - produces a sensible plan anyway.
 */

// Rough street prices in naira, used by the fallback planner so the advice is
// still useful without an AI key.
const MEAL_PRICES = [
    { name: 'Beans and plantain', cost: 1200, slots: ['breakfast', 'lunch'] },
    { name: 'Rice and chicken', cost: 2200, slots: ['lunch', 'supper'] },
    { name: 'Rice and stew', cost: 1500, slots: ['lunch', 'supper'] },
    { name: 'Pasta', cost: 1300, slots: ['lunch', 'supper'] },
    { name: 'Noodles', cost: 800, slots: ['lunch', 'supper'] },
    { name: 'Akara and pap', cost: 700, slots: ['breakfast', 'lunch'] },
    { name: 'Moi moi and bread', cost: 800, slots: ['breakfast'] },
    { name: 'Egg and bread', cost: 900, slots: ['breakfast'] },
    { name: 'Yam and egg sauce', cost: 1300, slots: ['breakfast', 'lunch'] },
    { name: 'Okro soup and swallow', cost: 1100, slots: ['lunch', 'supper'] },
    { name: 'Egusi and rice', cost: 1800, slots: ['lunch', 'supper'] },
    { name: 'Fried rice', cost: 1600, slots: ['lunch', 'supper'] },
    { name: 'Fruit and yoghurt', cost: 600, slots: ['breakfast'] },
    { name: 'Suya and yaji', cost: 1000, slots: ['lunch', 'supper'] },
];

const DAY = 24 * 60 * 60 * 1000;

/**
 * Converts a recurring expense into what it costs per day.
 */
const dailyCost = (item) => {
    if (!item || !item.active) return 0;
    const amount = Number(item.amount) || 0;
    if (item.frequency === 'daily') return amount;
    if (item.frequency === 'weekly') return amount / 7;
    if (item.frequency === 'monthly') return amount / 30;
    return 0;
};

/**
 * The full budget picture for a user.
 */
const summarise = ({ allowance, recurring = [], spentToday = 0, spentThisWeek = 0, spentThisMonth = 0 }) => {
    const committedDaily = recurring.reduce((sum, item) => sum + dailyCost(item), 0);
    const committedWeekly = recurring.reduce((sum, item) => {
        if (!item.active) return sum;
        const amount = Number(item.amount) || 0;
        if (item.frequency === 'daily') return sum + amount * 7;
        if (item.frequency === 'weekly') return sum + amount;
        if (item.frequency === 'monthly') return sum + (amount * 12) / 52;
        return sum;
    }, 0);

    const dailyAllowance = Number(allowance) || 0;
    const foodBudget = Math.max(0, dailyAllowance - committedDaily);
    const remainingToday = Math.max(0, foodBudget - spentToday);

    return {
        dailyAllowance,
        committedDaily: Math.round(committedDaily * 100) / 100,
        committedWeekly: Math.round(committedWeekly * 100) / 100,
        foodBudget: Math.round(foodBudget * 100) / 100,
        spentToday: Math.round(spentToday * 100) / 100,
        spentThisWeek: Math.round(spentThisWeek * 100) / 100,
        spentThisMonth: Math.round(spentThisMonth * 100) / 100,
        remainingToday: Math.round(remainingToday * 100) / 100,
        // How much of the allowance the planned commitments already use.
        committedPercent: dailyAllowance > 0
            ? Math.min(100, Math.round((committedDaily / dailyAllowance) * 100))
            : 0,
        hasAllowance: dailyAllowance > 0,
    };
};

/**
 * A deterministic meal plan, used when the AI is not configured or fails.
 */
const fallbackPlan = ({ foodBudget, currency = 'NGN', preferences = [] }) => {
    const wantsVegetarian = preferences.includes('vegetarian');
    const affordable = MEAL_PRICES
        .filter((m) => (wantsVegetarian ? !/chicken|egusi|suya|egg/i.test(m.name) : true))
        .sort((a, b) => a.cost - b.cost);

    const plan = [];
    let budget = foodBudget;
    const slots = ['breakfast', 'lunch', 'supper'];

    for (const slot of slots) {
        const choice = affordable.find((m) => m.slots.includes(slot) && m.cost <= budget);
        if (!choice) break;
        plan.push({
            name: choice.name,
            slot,
            cost: choice.cost,
            reason: `Fits the remaining ${currency} ${budget.toLocaleString('en-NG')} food budget`,
        });
        budget -= choice.cost;
    }

    const tips = [];
    if (foodBudget <= 0) {
        tips.push('Your recurring costs already use the whole allowance. Lower the daily cap on one of them, or raise your allowance.');
    } else {
        tips.push(`Plan for about ${currency} ${foodBudget.toLocaleString('en-NG')} a day on food and keep the rest for transport and data.`);
        tips.push('Cooking in batches at the start of the week is usually the single biggest saving.');
    }
    if (wantsVegetarian) tips.push('Beans, okra and moi moi are the cheapest proteins on this list.');

    return {
        source: 'rules',
        headline: foodBudget > 0
            ? `Here is a plan for ${currency} ${foodBudget.toLocaleString('en-NG')} a day.`
            : 'Your allowance is fully committed right now.',
        meals: plan,
        tips,
        weeklyCost: plan.reduce((sum, m) => sum + m.cost, 0) * 7,
        canAfford: foodBudget > 0,
    };
};

module.exports = { summarise, fallbackPlan, dailyCost, MEAL_PRICES, DAY };
