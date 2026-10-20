import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LuLoader } from 'react-icons/lu';

/**
 * Where Google sends the browser back to after signing in.
 *
 * The tokens arrive in the URL fragment so they never reach the server logs
 * or the referrer header.
 */
const GoogleCallback = () => {
    const navigate = useNavigate();
    const [error, setError] = useState('');

    useEffect(() => {
        const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : '';
        const params = new URLSearchParams(hash);
        const token = params.get('token');
        const refreshToken = params.get('refreshToken');
        const oauthError = params.get('error');

        if (oauthError) {
            setError(oauthError);
            return;
        }
        if (!token) {
            setError('Google sign in did not return a token.');
            return;
        }

        localStorage.setItem('token', token);
        if (refreshToken) localStorage.setItem('refreshToken', refreshToken);

        // Clean the fragment out of the address bar.
        window.history.replaceState({}, document.title, window.location.pathname);
        navigate('/dashboard', { replace: true });
    }, [navigate]);

    return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
            <div className="text-center">
                {error ? (
                    <>
                        <p className="text-sm text-rose-600">{error}</p>
                        <button
                            type="button"
                            onClick={() => navigate('/login')}
                            className="mt-4 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white"
                        >
                            Back to sign in
                        </button>
                    </>
                ) : (
                    <>
                        <LuLoader className="mx-auto animate-spin text-3xl text-violet-600" />
                        <p className="mt-4 text-sm text-slate-500">Signing you in…</p>
                    </>
                )}
            </div>
        </div>
    );
};

export default GoogleCallback;
