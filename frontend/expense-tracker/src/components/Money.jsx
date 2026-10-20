import { useCurrency } from '../utils/currency';

/**
 * Shows an amount with its currency symbol.
 *
 * The symbol is rendered separately from the digits, in a font stack that
 * really has the naira sign. Poppins does not include it, so the browser
 * falls back to a system font and then fakes the bold - which draws the
 * symbol as a smudged, doubled mark next to the bold digits.
 */
const Money = ({ amount, className = '', sign = '' }) => {
    const { split } = useCurrency();
    const { symbol, number } = split(amount);
    return (
        <span className={className}>
            <span className="currency-symbol">{sign || symbol}</span>
            {number}
        </span>
    );
};

export default Money;
