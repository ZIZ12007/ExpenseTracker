/**
 * Checks the configuration for weak or missing secrets at startup.
 *
 * Nothing here blocks the server - it is a warning, so a misconfigured
 * deployment is obvious in the logs rather than a surprise later.
 */

const isWeak = (value) => {
    if (!value) return true;
    const lowered = String(value).toLowerCase();
    return ['password', 'secret', 'changeme', 'your-', 'example', 'test', '1234', 'admin', 'default']
        .some((word) => lowered.includes(word));
};

const checkSecrets = () => {
    const problems = [];

    const jwt = process.env.JWT_SECRET;
    if (!jwt) {
        problems.push('JWT_SECRET is not set - sessions cannot be signed');
    } else {
        if (jwt.length < 32) problems.push(`JWT_SECRET is only ${jwt.length} characters (use at least 32)`);
        if (isWeak(jwt)) problems.push('JWT_SECRET looks like a placeholder');
    }

    const mongo = process.env.MONGO_URL || '';
    const password = mongo.match(/mongodb(?:\+srv)?:\/\/[^:]+:([^@]+)@/);
    if (password) {
        if (password[1].length < 16) problems.push('the database password is short (use at least 16 characters)');
        if (isWeak(password[1])) problems.push('the database password looks like a placeholder');
    }

    if (process.env.NODE_ENV === 'production' && !process.env.MONGO_URL) {
        problems.push('MONGO_URL is not set');
    }

    if (problems.length) {
        console.warn('\n--- security warnings ---');
        problems.forEach((problem) => console.warn(`  ! ${problem}`));
        console.warn('------------------------\n');
    } else {
        console.log('Secret check passed.');
    }

    return problems;
};

module.exports = { checkSecrets, isWeak };
