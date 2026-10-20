/**
 * Google Gemini integration.
 *
 * The free tier allows roughly 1,500 requests a day with no credit card,
 * which is more than enough for a few hundred users asking for a food
 * recommendation once or twice a day.
 *
 * Every function has a deterministic fallback, so the app keeps working if no
 * API key is set or if the API is unavailable.
 */
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

// The free tier limits differ a lot between models - some are as low as 20
// requests a day - and a model can be retired or busy at any time. The models
// are tried in order and the first one that answers is used.
const MODEL_CHAIN = (
    process.env.GEMINI_MODEL
        ? [process.env.GEMINI_MODEL]
        : ['gemini-3.5-flash-lite', 'gemini-3.5-flash', 'gemini-3.6-flash', 'gemini-3.1-flash-lite']
).concat(['gemini-3.5-flash-lite', 'gemini-3.5-flash', 'gemini-3.6-flash', 'gemini-3.1-flash-lite']);

const isConfigured = () => Boolean(process.env.GEMINI_API_KEY);

const callModel = async (model, { prompt, image, json = true }) => {
    const parts = [{ text: prompt }];
    if (image) {
        parts.push({ inline_data: { mime_type: image.mimeType, data: image.base64 } });
    }

    const response = await fetch(`${API_BASE}/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ role: 'user', parts }],
            generationConfig: {
                temperature: 0.4,
                ...(json ? { responseMimeType: 'application/json' } : {}),
            },
        }),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
        const err = new Error(`Gemini error ${response.status}: ${result?.error?.message || 'unknown'}`);
        err.status = response.status;
        throw err;
    }
    const text = result?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
    if (!text) throw new Error('Gemini returned an empty response');
    return text;
};

/**
 * Tries each model in turn, so a model that is out of quota or has been
 * retired does not take the feature down with it.
 *
 * The last model that worked is tried first next time, and a model that is
 * merely busy (503) is retried once before moving on.
 */
let lastWorkingModel = null;

const callGemini = async (options) => {
    const tried = new Set();
    let lastError = null;

    const order = lastWorkingModel
        ? [lastWorkingModel, ...MODEL_CHAIN]
        : MODEL_CHAIN;

    for (const model of order) {
        if (tried.has(model)) continue;
        tried.add(model);

        for (let attempt = 0; attempt < 2; attempt++) {
            try {
                const text = await callModel(model, options);
                lastWorkingModel = model;
                return { text, model };
            } catch (err) {
                lastError = err;
                // A busy model is worth one more try; a quota or missing model
                // is not.
                if (err.status === 503 && attempt === 0) {
                    await new Promise((r) => setTimeout(r, 1500));
                    continue;
                }
                break;
            }
        }
        console.error(`Gemini model ${model} failed: ${lastError?.message}`);
    }
    throw lastError || new Error('No Gemini model was available');
};

const parseJson = (text) => {
    const cleaned = text.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start === -1 || end === -1) throw new Error('no JSON object in the response');
    return JSON.parse(cleaned.slice(start, end + 1));
};

/**
 * Reads a school timetable from a photo and returns the meals for each day.
 */
const readTimetable = async ({ image, currency = 'NGN' }) => {
    if (!isConfigured()) {
        throw new Error('The AI service is not configured');
    }

    const prompt = `You are reading a school food timetable from a photograph.
Return JSON only, in exactly this shape:
{
  "meals": [
    { "day": "Monday", "breakfast": "...", "lunch": "...", "supper": "...", "estimatedCost": 0 }
  ]
}
Rules:
- "day" is the weekday name.
- Each meal is the dish as written on the timetable, or "" if that day has no such meal.
- "estimatedCost" is what one portion of that day's meals would cost in ${currency}, as a number.
- If the image is not a timetable, return { "meals": [], "notes": "could not be read" }.`;

    const text = await callGemini({ prompt, image, json: true });
    const parsed = parseJson(text.text);
    const meals = Array.isArray(parsed.meals) ? parsed.meals : [];
    return {
        meals: meals
            .filter((m) => m && (m.breakfast || m.lunch || m.supper))
            .map((m) => ({
                day: String(m.day || '').trim(),
                breakfast: String(m.breakfast || '').trim(),
                lunch: String(m.lunch || '').trim(),
                supper: String(m.supper || '').trim(),
                estimatedCost: Number(m.estimatedCost) || 0,
            })),
        notes: String(parsed.notes || ''),
    };
};

/**
 * Asks the model to plan meals that fit the user's remaining daily budget.
 */
const recommendMeals = async (context) => {
    const { currency = 'NGN', dailyBudget, committedDaily, timetable = [], preferences = [], recentSpend = 0 } = context;

    if (!isConfigured()) {
        return null;
    }

    const prompt = `You are a budget-conscious meal adviser for a student in Nigeria.
Currency: ${currency}.

Daily allowance: ${dailyBudget}
Already committed to other daily costs: ${committedDaily}
Remaining for food today: ${Math.max(0, dailyBudget - committedDaily)}
Spent on food today so far: ${recentSpend}
${timetable.length ? `School timetable this week:\n${timetable.map((m) => `- ${m.day}: breakfast ${m.breakfast || '-'}, lunch ${m.lunch || '-'}, supper ${m.supper || '-'}`).join('\n')}` : 'No timetable uploaded.'}
${preferences.length ? `Preferences: ${preferences.join(', ')}` : ''}
${preferences.includes('vegetarian') ? 'Only suggest vegetarian options.' : ''}

Return JSON only, in exactly this shape:
{
  "headline": "one short encouraging sentence, mentioning the daily food amount with the ${currency} symbol",
  "meals": [
    { "name": "dish", "slot": "breakfast|lunch|supper", "cost": 0, "reason": "why this fits the budget" }
  ],
  "tips": ["short practical tip"],
  "weeklyCost": 0,
  "canAfford": true
}
The combined cost of the meals must not exceed the remaining daily budget. Use realistic street prices in ${currency}.`;

    const text = await callGemini({ prompt, json: true });
    const parsed = parseJson(text.text);

    return {
        source: 'ai',
        headline: String(parsed.headline || 'Here is a plan that fits your budget.'),
        meals: (Array.isArray(parsed.meals) ? parsed.meals : [])
            .filter((m) => m && m.name)
            .map((m) => ({
                name: String(m.name),
                slot: String(m.slot || 'lunch'),
                cost: Number(m.cost) || 0,
                reason: String(m.reason || ''),
            })),
        tips: (Array.isArray(parsed.tips) ? parsed.tips : []).map(String).filter(Boolean),
        weeklyCost: Number(parsed.weeklyCost) || 0,
        canAfford: parsed.canAfford !== false,
    };
};

module.exports = { isConfigured, readTimetable, recommendMeals, MODEL_CHAIN };
