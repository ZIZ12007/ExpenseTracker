import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LuMail, LuArrowLeft } from 'react-icons/lu';
import { API_PATHS } from '../../utils/apiPaths';
import axiosInstance from '../../utils/axiosInstance';

const ForgotPassword = () => {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [sent, setSent] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    const submit = async (event) => {
        event.preventDefault();
        setBusy(true);
        setError('');
        try {
            const response = await axiosInstance.post(API_PATHS.AUTH.FORGOT_PASSWORD, { email: email.trim() });
            setSent(true);
            setMessage(response.data.message || 'If that address has an account, a reset link is on its way.');
        } catch (requestError) {
            setError(requestError.response?.data?.message || 'The link could not be sent.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
            <div className="w-full max-w-md rounded-3xl border border-slate-100 bg-white p-8 shadow-sm">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-50">
                    <LuMail className="text-2xl text-violet-600" />
                </div>
                <h1 className="mt-5 text-2xl font-bold text-slate-900">Forgot your password?</h1>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    Tell us the email address on your account and we will send you a link to choose a new password.
                </p>

                {error && <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
                {sent ? (
                    <p role="status" className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</p>
                ) : null}

                <form onSubmit={submit} className="mt-6 space-y-4">
                    <label className="block text-sm font-medium text-slate-700">
                        Email address
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            placeholder="you@example.com"
                            className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-violet-400"
                        />
                    </label>
                    <button
                        type="submit"
                        disabled={busy}
                        className="w-full rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:cursor-wait disabled:opacity-60"
                    >
                        {busy ? 'Sending…' : 'Send the reset link'}
                    </button>
                </form>

                <button
                    type="button"
                    onClick={() => navigate('/login')}
                    className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-violet-600"
                >
                    <LuArrowLeft /> Back to sign in
                </button>
            </div>
        </div>
    );
};

export default ForgotPassword;
