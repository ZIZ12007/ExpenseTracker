import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { LuMailCheck, LuCircleCheck, LuCircleX } from 'react-icons/lu';
import { API_PATHS } from '../../utils/apiPaths';
import axiosInstance from '../../utils/axiosInstance';

const VerifyEmail = () => {
    const [params] = useSearchParams();
    const navigate = useNavigate();
    const [status, setStatus] = useState('working');
    const [message, setMessage] = useState('Verifying your email address…');

    useEffect(() => {
        const token = params.get('token');
        if (!token) {
            setStatus('failed');
            setMessage('This link is missing its verification code.');
            return;
        }

        axiosInstance.post(API_PATHS.AUTH.VERIFY_EMAIL, { token })
            .then((response) => {
                setStatus('done');
                setMessage(response.data.message || 'Your email address is verified.');
            })
            .catch((error) => {
                setStatus('failed');
                setMessage(error.response?.data?.message || 'This verification link is invalid or has expired.');
            });
    }, [params]);

    return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
            <div className="w-full max-w-md rounded-3xl border border-slate-100 bg-white p-8 text-center shadow-sm">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-50">
                    {status === 'done' ? <LuCircleCheck className="text-3xl text-emerald-500" />
                        : status === 'failed' ? <LuCircleX className="text-3xl text-rose-500" />
                            : <LuMailCheck className="text-3xl text-violet-500" />}
                </div>

                <h1 className="mt-6 text-2xl font-bold text-slate-900">
                    {status === 'done' ? 'Email verified' : status === 'failed' ? 'That did not work' : 'Verifying your email'}
                </h1>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{message}</p>

                <button
                    type="button"
                    onClick={() => navigate('/dashboard')}
                    className="mt-6 w-full rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-violet-700"
                >
                    Go to my dashboard
                </button>
            </div>
        </div>
    );
};

export default VerifyEmail;
