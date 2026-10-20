import { useEffect, useLayoutEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getTourStep, setTourStep, resetTourStep } from '../utils/onboardingState';

/**
 * A guided first-run tour.
 *
 * A spotlight is cut out of an overlay around the element being described,
 * with a pointing finger and a small card of instructions. The tour can be
 * skipped at any point, and it remembers that it has been seen.
 *
 * A step may point at a different page: the tour moves there first, then
 * highlights the element.
 */
const STEPS = [
    {
        title: 'Welcome to Expenza 👋',
        body: 'This short tour shows you the three things that matter: tracking what you spend, planning your allowance, and the settings you can change.',
        target: null,
    },
    {
        title: 'Your money at a glance',
        body: 'Your balance, income and expenses are always on the dashboard. The charts break your spending down by category and by day.',
        target: '[data-tour="summary"]',
        path: '/dashboard',
    },
    {
        title: 'Add what you spend',
        body: 'Record an expense or some income in a couple of taps. The totals update straight away, and you can export everything to Excel.',
        target: '[data-tour="add"]',
        path: '/expense',
    },
    {
        title: 'Plan your allowance',
        body: 'Set a daily allowance, list what you always spend on - transport, data, rent - and upload your school timetable to get meal suggestions that fit what is left.',
        target: '[data-tour="budget"]',
        path: '/dashboard',
    },
    {
        title: 'Make it yours',
        body: 'Change your username, pick your currency, update your allowance and change your password in Settings.',
        target: '[data-tour="settings"]',
        path: '/dashboard',
    },
];

const PADDING = 8;

const Onboarding = ({ onComplete, onSkip }) => {
    const [step, setStep] = useState(getTourStep());
    const [rect, setRect] = useState(null);
    const navigate = useNavigate();
    const location = useLocation();

    const current = STEPS[step];

    const goToStep = (value) => {
        setTourStep(value);
        setStep(value);
    };

    // Move to the page the step points at, if it is not the current one.
    useEffect(() => {
        if (current?.path && current.path !== location.pathname) {
            navigate(current.path);
        }
    }, [step, current, navigate, location.pathname]);

    useLayoutEffect(() => {
        if (!current?.target) {
            setRect(null);
            return;
        }
        // Give the page a moment to render the element being pointed at.
        const timer = setTimeout(() => {
            const element = document.querySelector(current.target);
            if (!element) {
                setRect(null);
                return;
            }
            element.scrollIntoView({ block: 'center', behavior: 'smooth' });
            const update = () => setRect(element.getBoundingClientRect());
            update();
            window.addEventListener('resize', update);
            window.addEventListener('scroll', update, true);
            setTimeout(() => window.removeEventListener('scroll', update, true), 1500);
        }, 350);
        return () => clearTimeout(timer);
    }, [step, current, location.pathname]);

    useEffect(() => {
        const onKey = (event) => {
            if (event.key === 'Escape') onSkip?.();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onSkip]);

    const finish = () => {
        resetTourStep();
        onComplete?.();
        onSkip?.();
    };

    const next = () => {
        if (step === STEPS.length - 1) {
            finish();
            return;
        }
        goToStep(step + 1);
    };

    const isLast = step === STEPS.length - 1;

    // The card sits next to the highlighted element, and flips to the other
    // side when there is not enough room.
    let cardStyle = { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' };
    if (rect) {
        const cardWidth = 320;
        const below = rect.bottom + 24;
        const fitsBelow = below + 220 < window.innerHeight;
        const left = Math.min(Math.max(rect.left + rect.width / 2 - cardWidth / 2, 16), window.innerWidth - cardWidth - 16);
        cardStyle = fitsBelow
            ? { left, top: below }
            : { left, top: Math.max(16, rect.top - 232) };
    }

    return (
        <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-label="Getting started">
            {/* The spotlight: four panels around the highlighted element. */}
            {rect ? (
                <>
                    <div className="absolute bg-slate-950/60" style={{ top: 0, left: 0, right: 0, height: Math.max(0, rect.top - PADDING) }} />
                    <div className="absolute bg-slate-950/60" style={{ top: rect.bottom + PADDING, left: 0, right: 0, bottom: 0 }} />
                    <div className="absolute bg-slate-950/60" style={{ top: rect.top - PADDING, left: 0, width: Math.max(0, rect.left - PADDING), height: rect.height + PADDING * 2 }} />
                    <div className="absolute bg-slate-950/60" style={{ top: rect.top - PADDING, left: rect.right + PADDING, right: 0, height: rect.height + PADDING * 2 }} />
                    <div
                        className="pointer-events-none absolute rounded-2xl ring-2 ring-violet-400"
                        style={{
                            top: rect.top - PADDING,
                            left: rect.left - PADDING,
                            width: rect.width + PADDING * 2,
                            height: rect.height + PADDING * 2,
                        }}
                    />
                </>
            ) : (
                <div className="absolute inset-0 bg-slate-950/60" />
            )}

            <div
                className="absolute w-[320px] rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"
                style={cardStyle}
            >
                <div className="mb-3 flex items-center gap-3">
                    {rect && <span className="text-2xl">👆</span>}
                    <h3 className="text-base font-semibold text-slate-900">{current.title}</h3>
                </div>
                <p className="text-sm leading-relaxed text-slate-600">{current.body}</p>

                <div className="mt-5 flex items-center justify-between">
                    <button
                        type="button"
                        onClick={() => onSkip?.()}
                        className="text-xs font-medium text-slate-400 transition hover:text-slate-600"
                    >
                        Skip tour
                    </button>
                    <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-400">
                            {step + 1} of {STEPS.length}
                        </span>
                        <button
                            type="button"
                            onClick={next}
                            className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-700"
                        >
                            {isLast ? 'Get started' : 'Next'}
                        </button>
                    </div>
                </div>

                <div className="mt-4 flex gap-1.5">
                    {STEPS.map((item, index) => (
                        <span
                            key={item.title}
                            className={`h-1.5 flex-1 rounded-full ${index <= step ? 'bg-violet-500' : 'bg-slate-200'}`}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

export default Onboarding;
export { STEPS };
