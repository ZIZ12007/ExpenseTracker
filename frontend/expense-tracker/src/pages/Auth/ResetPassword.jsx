import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { LuKeyRound } from 'react-icons/lu';
import { API_PATHS } from '../../utils/apiPaths';
import axiosInstance from '../../utils/axiosInstance';

const ResetPassword = () => {
    const [params] = useSearchParams();
    const navigate = useNavigate();
    const token = params.get('token') || '';

    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    const submit = async (event) => {
        event.preventDefault();
        setError('');
        if (password.length < 8) {
            setError('The new password must be at least 8 characters.');
            return;
        }
        if (password !== confirm) {
            setError('The two passwords do not match.');
            return;
        }

        setBusy(true);
        try {
            const response = await axiosInstance.post(API_PATHS.AUTH.RESET_PASSWORD, { token, password });
            // The reset returns a fresh token pair, so the user stays signed in.
            if (response.data?.token) {
                localStorage.setItem('token', response.data.token);
                if (response.data.refreshToken) localStorage.setItem('refreshToken', response.data.refreshToken);
            }
            setMessage(response.data.message || 'Your password has been changed.');
            window.setTimeout(() => navigate('/dashboard'), 1500);
        } catch (requestError) {
            setError(requestError.response?.data?.message || 'Your password could not be changed.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
            <div className="w-full max-w-md rounded-3xl border border-slate-100 bg-white p-8 shadow-sm">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-50">
                    <LuKeyRound className="text-2xl text-violet-600" />
                </div>
                <h1 className="mt-5 text-2xl font-bold text-slate-900">Choose a new password</h1>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">Pick something you have not used before. At least 8 characters.</p>

                {error && <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
                {message && <p role="status" className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</p>}

                <form onSubmit={submit} className="mt-6 space-y-4">
                    <label className="block text-sm font-medium text-slate-700">
                        New password
                        <input
                            type="password"
                            required
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-violet-400"
                        />
                    </label>
                    <label className="block text-sm font-medium text-slate-700">
                        Confirm new password
                        <input
                            type="password"
                            required
                            value={confirm}
                            onChange={(event) => setConfirm(event.target.value)}
                            className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-violet-400"
                        />
                    </label>
                    <button
                        type="submit"
                        disabled={busy || !token}
                        className="w-full rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:cursor-wait disabled:opacity-60"
                    >
                        {busy ? 'Saving…' : 'Save new password'}
                    </button>
                    {!token && (
                        <p className="text-xs text-amber-700">This link is missing its reset code. Request a new one.</p>
                    )}
                </form>
            </div>
        </div>
    );
};

export default ResetPassword;
