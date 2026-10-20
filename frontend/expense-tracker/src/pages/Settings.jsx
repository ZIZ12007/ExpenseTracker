import { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    LuUser, LuCoins, LuBell, LuKeyRound, LuMail, LuLogOut, LuShieldCheck, LuSparkles, LuInfo,
} from 'react-icons/lu';
import DashboardLayout from '../components/Layout/DashboardLayout';
import { useUserAuth } from '../hooks/useUserAuth';
import { UserContext } from '../context/UserContextDefinition';
import { API_PATHS } from '../utils/apiPaths';
import axiosInstance from '../utils/axiosInstance';
import { CURRENCIES, useCurrency, setCurrency } from '../utils/currency';

const Settings = () => {
    useUserAuth();
    const { user, updateUser, clearUser } = useContext(UserContext);
    const navigate = useNavigate();
    const { money } = useCurrency();

    const [fullName, setFullName] = useState('');
    const [username, setUsername] = useState('');
    const [currency, setCurrencyState] = useState('NGN');
    const [allowance, setAllowance] = useState('');
    const [notifications, setNotifications] = useState(true);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    const [services, setServices] = useState({});

    // Which services this deployment has switched on.
    useEffect(() => {
        axiosInstance.get(`${API_PATHS.AUTH.SERVICE_STATUS}`)
            .then((response) => setServices(response.data || {}))
            .catch(() => setServices({}));
    }, []);

    useEffect(() => {
        if (!user) return;
        setFullName(user.fullName || '');
        setUsername(user.username || '');
        setCurrencyState(user.currency || 'NGN');
        setAllowance(user.allowance ? String(user.allowance) : '');
        setNotifications(user.notifications !== false);
    }, [user]);

    const flash = (text) => {
        setMessage(text);
        setError('');
        window.setTimeout(() => setMessage(''), 4000);
    };

    const fail = (text) => {
        setError(text);
        setMessage('');
    };

    const saveProfile = async (event) => {
        event.preventDefault();
        setSaving(true);
        try {
            const response = await axiosInstance.patch(API_PATHS.USER.PROFILE, {
                fullName,
                username,
                currency,
                allowance: allowance === '' ? 0 : Number(allowance),
                notifications,
            });
            updateUser(response.data.user);
            setCurrency(currency);
            flash('Your settings have been saved.');
        } catch (requestError) {
            fail(requestError.response?.data?.message || 'Your settings could not be saved.');
        } finally {
            setSaving(false);
        }
    };

    const changePassword = async (event) => {
        event.preventDefault();
        setSaving(true);
        try {
            const response = await axiosInstance.post(API_PATHS.USER.PASSWORD, { currentPassword, newPassword });
            setCurrentPassword('');
            setNewPassword('');
            flash(response.data.message || 'Your password has been changed.');
        } catch (requestError) {
            fail(requestError.response?.data?.message || 'Your password could not be changed.');
        } finally {
            setSaving(false);
        }
    };

    const resendVerification = async () => {
        try {
            const response = await axiosInstance.post(API_PATHS.AUTH.RESEND_VERIFICATION, { email: user?.email });
            flash(response.data.message || 'A new link is on its way.');
        } catch (requestError) {
            fail(requestError.response?.data?.message || 'The link could not be sent.');
        }
    };

    const signOut = () => {
        localStorage.clear();
        clearUser();
        navigate('/login');
    };

    const isGoogle = user?.provider === 'google';

    return (
        <DashboardLayout activeMenu='Settings'>
            <div className="mx-auto max-w-4xl space-y-6 py-2">
                <header>
                    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-violet-600">Your account</p>
                    <h1 className="mt-2 text-3xl font-bold text-slate-900">Settings</h1>
                    <p className="mt-1 text-sm text-slate-500">Change how the app looks and works for you.</p>
                </header>

                {message && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</p>}
                {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}

                {!user?.emailVerified && (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-start gap-3">
                                <LuMail className="mt-0.5 text-xl text-amber-600" />
                                <div>
                                    <p className="font-semibold text-amber-900">Your email is not verified yet</p>
                                    <p className="mt-0.5 text-sm text-amber-800">Verifying it keeps your account safe if you ever forget your password.</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={resendVerification}
                                className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-700"
                            >
                                Resend the link
                            </button>
                        </div>
                    </div>
                )}

                <form onSubmit={saveProfile} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
                    <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900"><LuUser className="text-violet-600" /> Profile</h2>

                    <div className="mt-5 grid gap-4 sm:grid-cols-2">
                        <label className="block text-sm font-medium text-slate-700">
                            Full name
                            <input
                                value={fullName}
                                onChange={(event) => setFullName(event.target.value)}
                                className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-violet-400"
                            />
                        </label>
                        <label className="block text-sm font-medium text-slate-700">
                            Username
                            <input
                                value={username}
                                onChange={(event) => setUsername(event.target.value.replace(/\s/g, ''))}
                                placeholder="e.g. ada.b"
                                className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-violet-400"
                            />
                            <span className="mt-1 block text-xs font-normal text-slate-400">3-24 characters. Letters, numbers, dots and underscores.</span>
                        </label>
                        <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
                            Email address
                            <input
                                value={user?.email || ''}
                                readOnly
                                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-500"
                            />
                            {isGoogle && <span className="mt-1 block text-xs font-normal text-slate-400">This account signs in with Google.</span>}
                        </label>
                    </div>

                    <h2 className="mt-8 flex items-center gap-2 text-lg font-semibold text-slate-900"><LuCoins className="text-violet-600" /> Money</h2>
                    <div className="mt-5 grid gap-4 sm:grid-cols-2">
                        <label className="block text-sm font-medium text-slate-700">
                            Currency
                            <select
                                value={currency}
                                onChange={(event) => setCurrencyState(event.target.value)}
                                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-violet-400"
                            >
                                {Object.values(CURRENCIES).map((item) => (
                                    <option key={item.code} value={item.code}>{item.symbol}  {item.label}</option>
                                ))}
                            </select>
                        </label>
                        <label className="block text-sm font-medium text-slate-700">
                            Daily allowance
                            <input
                                type="number"
                                min="0"
                                step="100"
                                value={allowance}
                                onChange={(event) => setAllowance(event.target.value)}
                                placeholder="0"
                                className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-violet-400"
                            />
                            <span className="mt-1 block text-xs font-normal text-slate-400">
                                How much you plan to spend in a day. {money(Number(allowance) || 0)} right now.
                            </span>
                        </label>
                    </div>

                    <label className="mt-5 flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3">
                        <input
                            type="checkbox"
                            checked={notifications}
                            onChange={(event) => setNotifications(event.target.checked)}
                            className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-400"
                        />
                        <LuBell className="text-slate-500" />
                        <span className="text-sm text-slate-700">Send me a nudge when I go over my daily budget</span>
                    </label>

                    <button
                        type="submit"
                        disabled={saving}
                        className="mt-6 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:cursor-wait disabled:opacity-60"
                    >
                        {saving ? 'Saving…' : 'Save settings'}
                    </button>
                </form>

                {!isGoogle && (
                    <form onSubmit={changePassword} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
                        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900"><LuKeyRound className="text-violet-600" /> Password</h2>
                        <div className="mt-5 grid gap-4 sm:grid-cols-2">
                            <label className="block text-sm font-medium text-slate-700">
                                Current password
                                <input
                                    type="password"
                                    value={currentPassword}
                                    onChange={(event) => setCurrentPassword(event.target.value)}
                                    className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-violet-400"
                                />
                            </label>
                            <label className="block text-sm font-medium text-slate-700">
                                New password
                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={(event) => setNewPassword(event.target.value)}
                                    placeholder="At least 8 characters"
                                    className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-violet-400"
                                />
                            </label>
                        </div>
                        <button
                            type="submit"
                            disabled={saving}
                            className="mt-5 rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-violet-300 hover:text-violet-700 disabled:opacity-60"
                        >
                            Change password
                        </button>
                    </form>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                    <button
                        type="button"
                        onClick={signOut}
                        className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-semibold text-slate-700 transition hover:border-rose-300 hover:text-rose-600"
                    >
                        <LuLogOut /> Sign out
                    </button>
                    <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white px-5 py-4">
                        {user?.emailVerified
                            ? <LuShieldCheck className="text-xl text-emerald-600" />
                            : <LuMail className="text-xl text-amber-500" />}
                        <div>
                            <p className="text-sm font-semibold text-slate-900">
                                {user?.emailVerified ? 'Email verified' : 'Email not verified'}
                            </p>
                            <p className="text-xs text-slate-500">{user?.email}</p>
                        </div>
                    </div>
                </div>

                <p className="flex items-center gap-2 text-xs text-slate-400">
                    <LuSparkles className="text-violet-500" />
                    Tip: set your daily allowance in Settings and Expense Tracker will work out what is left for food each day.
                </p>

                <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
                    <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900"><LuInfo className="text-violet-600" /> Services</h2>
                    <p className="mt-1 text-sm text-slate-500">What this deployment has switched on.</p>
                    <dl className="mt-4 space-y-2 text-sm">
                        <div className="flex items-center justify-between gap-3">
                            <dt className="text-slate-600">Email</dt>
                            <dd className="font-medium text-slate-900">
                                {services.email?.configured
                                    ? `${services.email.provider} (${services.email.sender || 'no sender set'})`
                                    : 'not configured - emails are written to the server log'}
                            </dd>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                            <dt className="text-slate-600">Food suggestions</dt>
                            <dd className="font-medium text-slate-900">
                                {services.ai?.configured ? 'AI enabled' : 'built-in planner'}
                            </dd>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                            <dt className="text-slate-600">Google sign in</dt>
                            <dd className="font-medium text-slate-900">
                                {services.google?.enabled ? 'available' : 'not set up'}
                            </dd>
                        </div>
                    </dl>
                </section>
            </div>
        </DashboardLayout>
    );
};

export default Settings;
