import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
    LuWallet, LuUpload, LuSparkles, LuPlus, LuTrash2, LuCalendarDays, LuInfo,
} from 'react-icons/lu';
import DashboardLayout from '../components/Layout/DashboardLayout';
import { useUserAuth } from '../hooks/useUserAuth';
import { UserContext } from '../context/UserContextDefinition';
import { API_PATHS } from '../utils/apiPaths';
import axiosInstance from '../utils/axiosInstance';
import { useCurrency } from '../utils/currency';

const FREQUENCIES = [
    { value: 'daily', label: 'Every day' },
    { value: 'weekly', label: 'Every week' },
    { value: 'monthly', label: 'Every month' },
];

const CATEGORIES = ['Transport', 'Data', 'Food', 'Rent', 'School', 'Health', 'Other'];

const Budget = () => {
    useUserAuth();
    const { user, updateUser } = useContext(UserContext);
    const { money } = useCurrency();
    const fileInput = useRef(null);

    const [summary, setSummary] = useState(null);
    const [recurring, setRecurring] = useState([]);
    const [timetables, setTimetables] = useState([]);
    const [aiEnabled, setAiEnabled] = useState(false);
    const [plan, setPlan] = useState(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    const [form, setForm] = useState({ title: '', amount: '', frequency: 'daily', category: 'Transport' });
    const [allowanceInput, setAllowanceInput] = useState('');

    const flash = (text) => { setMessage(text); setError(''); window.setTimeout(() => setMessage(''), 4000); };
    const fail = (text) => { setError(text); setMessage(''); };

    const load = useCallback(async () => {
        try {
            const response = await axiosInstance.get(API_PATHS.BUDGET.SUMMARY);
            const data = response.data || {};
            setSummary(data.summary || null);
            setRecurring(data.recurring || []);
            setTimetables(data.timetables || []);
            setAiEnabled(Boolean(data.aiEnabled));
            setAllowanceInput(data.summary?.dailyAllowance ? String(data.summary.dailyAllowance) : '');
        } catch (requestError) {
            fail(requestError.response?.data?.message || 'Your budget could not be loaded.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);
    useEffect(() => {
        if (user && user.allowance !== undefined) setAllowanceInput(user.allowance ? String(user.allowance) : '');
    }, [user]);

    const saveAllowance = async () => {
        try {
            const response = await axiosInstance.patch(API_PATHS.USER.PROFILE, { allowance: Number(allowanceInput) || 0 });
            updateUser(response.data.user);
            flash('Your daily allowance is updated.');
            load();
        } catch (requestError) {
            fail(requestError.response?.data?.message || 'The allowance could not be saved.');
        }
    };

    const addRecurring = async (event) => {
        event.preventDefault();
        if (!form.title.trim() || !Number(form.amount)) {
            fail('Give the expense a name and an amount.');
            return;
        }
        try {
            await axiosInstance.post(API_PATHS.BUDGET.RECURRING, {
                title: form.title.trim(),
                amount: Number(form.amount),
                frequency: form.frequency,
                category: form.category,
            });
            setForm({ title: '', amount: '', frequency: 'daily', category: 'Transport' });
            flash('Added to your planned costs.');
            load();
        } catch (requestError) {
            fail(requestError.response?.data?.message || 'That could not be added.');
        }
    };

    const removeRecurring = async (id) => {
        try {
            await axiosInstance.delete(API_PATHS.BUDGET.DELETE_RECURRING(id));
            load();
        } catch (requestError) {
            fail(requestError.response?.data?.message || 'That could not be removed.');
        }
    };

    const uploadTimetable = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const formData = new FormData();
        formData.append('timetable', file);
        setBusy(true);
        try {
            const response = await axiosInstance.post(API_PATHS.BUDGET.TIMETABLE, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            if (response.data?.timetable?.status === 'ready') {
                flash('Your timetable was read. Check the meals below.');
            } else {
                flash(response.data?.message || 'The timetable was uploaded.');
            }
            load();
        } catch (requestError) {
            fail(requestError.response?.data?.message || 'The timetable could not be uploaded.');
        } finally {
            setBusy(false);
            if (fileInput.current) fileInput.current.value = '';
        }
    };

    const getRecommendations = async () => {
        setBusy(true);
        try {
            const response = await axiosInstance.post(API_PATHS.BUDGET.RECOMMENDATIONS, { preferences: [] });
            setPlan(response.data.plan);
            setSummary(response.data.summary);
        } catch (requestError) {
            fail(requestError.response?.data?.message || 'A plan could not be made right now.');
        } finally {
            setBusy(false);
        }
    };

    const removeTimetable = async (id) => {
        try {
            await axiosInstance.delete(API_PATHS.BUDGET.DELETE_TIMETABLE(id));
            load();
        } catch (requestError) {
            fail(requestError.response?.data?.message || 'That could not be removed.');
        }
    };

    return (
        <DashboardLayout activeMenu='Budget'>
            <div className="mx-auto max-w-6xl space-y-6 py-2">
                <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
                    <div>
                        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-violet-600">Plan your spending</p>
                        <h1 className="mt-2 text-3xl font-bold text-slate-900">Budget & meals</h1>
                        <p className="mt-1 text-sm text-slate-500">Work out what your allowance really covers, and get meal ideas that fit.</p>
                    </div>
                    <button
                        type="button"
                        onClick={getRecommendations}
                        disabled={busy}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:cursor-wait disabled:opacity-60"
                    >
                        <LuSparkles /> {busy ? 'Working…' : 'Suggest meals for today'}
                    </button>
                </header>

                {message && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</p>}
                {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}

                {loading ? (
                    <div className="rounded-2xl border border-slate-100 bg-white p-10 text-center text-sm text-slate-500 shadow-sm">Loading your budget…</div>
                ) : (
                    <>
                        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" data-tour="summary">
                            <div className="rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 p-5 text-white">
                                <p className="text-sm text-white/80">Daily allowance</p>
                                <p className="mt-3 text-3xl font-bold">{money(summary?.dailyAllowance || 0)}</p>
                            </div>
                            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                                <p className="text-sm text-slate-500">Already committed</p>
                                <p className="mt-3 text-3xl font-bold text-slate-900">{money(summary?.committedDaily || 0)}</p>
                                <p className="mt-1 text-xs text-slate-400">{summary?.committedPercent || 0}% of your allowance</p>
                            </div>
                            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                                <p className="text-sm text-slate-500">Left for food</p>
                                <p className="mt-3 text-3xl font-bold text-emerald-600">{money(summary?.foodBudget || 0)}</p>
                            </div>
                            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                                <p className="text-sm text-slate-500">Spent today</p>
                                <p className="mt-3 text-3xl font-bold text-slate-900">{money(summary?.spentToday || 0)}</p>
                            </div>
                        </section>

                        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
                            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900"><LuWallet className="text-violet-600" /> Your daily allowance</h2>
                            <p className="mt-1 text-sm text-slate-500">Everything else on this page is worked out from this number.</p>
                            <div className="mt-4 flex flex-wrap items-end gap-3">
                                <label className="block text-sm font-medium text-slate-700">
                                    Amount per day
                                    <input
                                        type="number"
                                        min="0"
                                        step="100"
                                        value={allowanceInput}
                                        onChange={(event) => setAllowanceInput(event.target.value)}
                                        className="mt-1.5 w-48 rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-violet-400"
                                    />
                                </label>
                                <button
                                    type="button"
                                    onClick={saveAllowance}
                                    className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                                >
                                    Save
                                </button>
                            </div>
                        </section>

                        <div className="grid gap-6 lg:grid-cols-2">
                            <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
                                <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900"><LuCalendarDays className="text-violet-600" /> Planned costs</h2>
                                <p className="mt-1 text-sm text-slate-500">Transport, data, rent - anything you spend regularly.</p>

                                <form onSubmit={addRecurring} className="mt-5 space-y-3">
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <input
                                            value={form.title}
                                            onChange={(event) => setForm({ ...form, title: event.target.value })}
                                            placeholder="What is it? e.g. Transport to school"
                                            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-violet-400"
                                        />
                                        <input
                                            type="number"
                                            min="0"
                                            value={form.amount}
                                            onChange={(event) => setForm({ ...form, amount: event.target.value })}
                                            placeholder="Amount"
                                            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-violet-400"
                                        />
                                    </div>
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <select
                                            value={form.frequency}
                                            onChange={(event) => setForm({ ...form, frequency: event.target.value })}
                                            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-violet-400"
                                        >
                                            {FREQUENCIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                                        </select>
                                        <select
                                            value={form.category}
                                            onChange={(event) => setForm({ ...form, category: event.target.value })}
                                            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-violet-400"
                                        >
                                            {CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}
                                        </select>
                                    </div>
                                    <button
                                        type="submit"
                                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-violet-300 hover:text-violet-700"
                                    >
                                        <LuPlus /> Add
                                    </button>
                                </form>

                                <ul className="mt-5 divide-y divide-slate-100">
                                    {recurring.length === 0 && (
                                        <li className="py-6 text-center text-sm text-slate-400">Nothing planned yet.</li>
                                    )}
                                    {recurring.map((item) => (
                                        <li key={item._id} className="flex items-center gap-3 py-3">
                                            <span className="text-lg">{item.icon}</span>
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-sm font-medium text-slate-800">{item.title}</p>
                                                <p className="text-xs text-slate-500">
                                                    {FREQUENCIES.find((f) => f.value === item.frequency)?.label} · {item.category}
                                                </p>
                                            </div>
                                            <span className="text-sm font-semibold text-slate-900">{money(item.amount)}</span>
                                            <button
                                                type="button"
                                                onClick={() => removeRecurring(item._id)}
                                                aria-label={`Remove ${item.title}`}
                                                className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                                            >
                                                <LuTrash2 />
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </section>

                            <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
                                <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900"><LuUpload className="text-violet-600" /> School timetable</h2>
                                <p className="mt-1 text-sm text-slate-500">
                                    Upload a photo of your school food timetable and the meals are read for you.
                                    {aiEnabled ? '' : ' (The AI needs a key - the upload still works.)'}
                                </p>

                                <label className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 px-4 py-8 text-center transition hover:border-violet-300">
                                    <LuUpload className="text-2xl text-slate-400" />
                                    <span className="mt-2 text-sm font-semibold text-slate-700">Take or choose a photo</span>
                                    <span className="mt-1 text-xs text-slate-400">JPG, PNG or WebP</span>
                                    <input ref={fileInput} type="file" accept="image/*" onChange={uploadTimetable} className="hidden" />
                                </label>

                                <div className="mt-5 space-y-4">
                                    {timetables.map((timetable) => (
                                        <div key={timetable._id} className="rounded-2xl border border-slate-100 p-4">
                                            <div className="flex items-center justify-between gap-3">
                                                <p className="text-sm font-semibold text-slate-900">{timetable.title}</p>
                                                <button
                                                    type="button"
                                                    onClick={() => removeTimetable(timetable._id)}
                                                    aria-label="Remove timetable"
                                                    className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                                                >
                                                    <LuTrash2 />
                                                </button>
                                            </div>
                                            {timetable.status === 'failed' && (
                                                <p className="mt-2 flex items-start gap-2 text-xs text-amber-700">
                                                    <LuInfo className="mt-0.5 shrink-0" />{timetable.notes || 'The timetable could not be read.'}
                                                </p>
                                            )}
                                            {timetable.meals?.length > 0 && (
                                                <ul className="mt-3 divide-y divide-slate-100 text-sm">
                                                    {timetable.meals.map((meal, index) => (
                                                        <li key={`${meal.day}-${index}`} className="py-2">
                                                            <p className="font-medium text-slate-800">{meal.day}</p>
                                                            <p className="text-xs text-slate-500">
                                                                {[meal.breakfast, meal.lunch, meal.supper].filter(Boolean).join(' · ')}
                                                            </p>
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </section>
                        </div>

                        {plan && (
                            <section className="rounded-2xl border border-violet-100 bg-white p-5 shadow-sm sm:p-6">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                                        <LuSparkles className="text-violet-600" /> Today's plan
                                        {plan.source === 'ai' && <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700">AI</span>}
                                    </h2>
                                    <p className="text-sm text-slate-500">{plan.headline}</p>
                                </div>

                                {plan.meals?.length > 0 ? (
                                    <ul className="mt-4 grid gap-3 sm:grid-cols-3">
                                        {plan.meals.map((meal, index) => (
                                            <li key={`${meal.name}-${index}`} className="rounded-2xl border border-slate-100 p-4">
                                                <p className="text-xs uppercase tracking-wide text-slate-400">{meal.slot}</p>
                                                <p className="mt-1 font-semibold text-slate-900">{meal.name}</p>
                                                <p className="mt-1 text-sm font-semibold text-emerald-600">{money(meal.cost)}</p>
                                                {meal.reason && <p className="mt-2 text-xs text-slate-500">{meal.reason}</p>}
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="mt-4 text-sm text-slate-500">No plan yet - set your allowance and try again.</p>
                                )}

                                {plan.tips?.length > 0 && (
                                    <ul className="mt-5 space-y-2">
                                        {plan.tips.map((tip, index) => (
                                            <li key={index} className="flex items-start gap-2 text-sm text-slate-600">
                                                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400" />{tip}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </section>
                        )}
                    </>
                )}
            </div>
        </DashboardLayout>
    );
};

export default Budget;
