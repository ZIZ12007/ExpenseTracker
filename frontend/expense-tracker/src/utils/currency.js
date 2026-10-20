import { useEffect, useState } from 'react';

/**
 * Currency handling.
 *
 * Naira is the default. The choice is kept in localStorage so the app renders
 * the right symbol before the profile has loaded, and the user's preference
 * from the server overwrites it once they are known.
 */
export const CURRENCIES = {
    NGN: { code: 'NGN', symbol: '₦', locale: 'en-NG', label: 'Nigerian Naira' },
    USD: { code: 'USD', symbol: '$', locale: 'en-US', label: 'US Dollar' },
    GBP: { code: 'GBP', symbol: '£', locale: 'en-GB', label: 'British Pound' },
    EUR: { code: 'EUR', symbol: '€', locale: 'en-IE', label: 'Euro' },
    GHS: { code: 'GHS', symbol: '₵', locale: 'en-GH', label: 'Ghanaian Cedi' },
    ZAR: { code: 'ZAR', symbol: 'R', locale: 'en-ZA', label: 'South African Rand' },
    KES: { code: 'KES', symbol: 'KSh', locale: 'en-KE', label: 'Kenyan Shilling' },
};

const STORAGE_KEY = 'expensetracker:currency';
const EVENT = 'expensetracker:currency-changed';

let current = (typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY)) || 'NGN';
if (!CURRENCIES[current]) current = 'NGN';

export const getCurrency = () => current;

export const setCurrency = (code) => {
    if (!CURRENCIES[code]) return;
    current = code;
    try { localStorage.setItem(STORAGE_KEY, code); } catch { /* storage may be unavailable */ }
    window.dispatchEvent(new CustomEvent(EVENT, { detail: code }));
};

/**
 * Formats an amount, for example 1234.5 -> "₦1,234.50".
 */
export const formatMoney = (value, code = current) => {
    const currency = CURRENCIES[code] || CURRENCIES.NGN;
    const amount = Number(value) || 0;
    try {
        return new Intl.NumberFormat(currency.locale, {
            style: 'currency',
            currency: currency.code,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(amount);
    } catch {
        return `${currency.symbol}${amount.toFixed(2)}`;
    }
};

/**
 * A shorter version, for cards and chart labels.
 */
export const formatCompact = (value, code = current) => {
    const currency = CURRENCIES[code] || CURRENCIES.NGN;
    const amount = Number(value) || 0;
    if (Math.abs(amount) >= 1000000) return `${currency.symbol}${(amount / 1000000).toFixed(1)}m`;
    if (Math.abs(amount) >= 1000) return `${currency.symbol}${(amount / 1000).toFixed(1)}k`;
    return `${currency.symbol}${amount.toFixed(0)}`;
};

/**
 * A hook so components re-render when the currency changes.
 */
export const useCurrency = () => {
    const [code, setCode] = useState(getCurrency());

    useEffect(() => {
        const onChange = () => setCode(getCurrency());
        window.addEventListener(EVENT, onChange);
        return () => window.removeEventListener(EVENT, onChange);
    }, []);

    return {
        code,
        currency: CURRENCIES[code] || CURRENCIES.NGN,
        money: (value) => formatMoney(value, code),
        compact: (value) => formatCompact(value, code),
    };
};
