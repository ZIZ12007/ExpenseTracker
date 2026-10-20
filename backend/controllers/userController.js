const User = require('../models/User');
const cache = require('../services/cache');
const mailer = require('../services/mailer');

const publicUser = (user) => {
    const result = user.toObject();
    delete result.password;
    delete result.verifyToken;
    delete result.verifyTokenExpires;
    delete result.resetToken;
    delete result.resetTokenExpires;
    return result;
};

/**
 * GET /api/v1/user/profile
 * The signed-in user's profile and preferences.
 */
exports.getProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.status(200).json({ user: publicUser(user) });
    } catch (err) {
        console.error('userController.getProfile error:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

/**
 * PATCH /api/v1/user/profile
 * Updates the name, username, currency, allowance or notification preference.
 */
exports.updateProfile = async (req, res) => {
    const { fullName, username, currency, allowance, notifications, onboarded } = req.body || {};

    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        // A record of what changed, for the email.
        const changes = [];

        if (typeof fullName === 'string' && fullName.trim() && fullName.trim() !== user.fullName) {
            changes.push(`Name changed to ${fullName.trim()}`);
            user.fullName = fullName.trim();
        }

        if (typeof username === 'string') {
            const handle = username.trim();
            if (handle && handle !== user.username) {
                if (!/^[a-zA-Z0-9_.]{3,24}$/.test(handle)) {
                    return res.status(400).json({ message: 'A username must be 3-24 characters and may only use letters, numbers, dots and underscores.' });
                }
                const taken = await User.findOne({ username: handle, _id: { $ne: user._id } });
                if (taken) {
                    return res.status(400).json({ message: 'That username is already taken.' });
                }
                changes.push(`Username changed to ${handle}`);
                user.username = handle;
            } else if (!handle && user.username) {
                changes.push('Username removed');
                user.username = undefined;
            }
        }

        if (typeof currency === 'string' && currency !== user.currency) {
            changes.push(`Currency changed to ${currency}`);
            user.currency = currency;
        }
        if (allowance !== undefined) {
            const value = Number(allowance);
            if (!Number.isFinite(value) || value < 0) {
                return res.status(400).json({ message: 'The allowance must be a positive number.' });
            }
            if (value !== user.allowance) {
                changes.push(`Daily allowance changed to ${value}`);
            }
            user.allowance = value;
        }
        if (typeof notifications === 'boolean' && notifications !== user.notifications) {
            changes.push(notifications ? 'Budget reminders turned on' : 'Budget reminders turned off');
            user.notifications = notifications;
        }
        if (typeof onboarded === 'boolean') {
            user.onboarded = onboarded;
        }

        await user.save();
        // The cached user record is now out of date.
        cache.del(`user:${user._id}`);

        if (changes.length) {
            await mailer.sendSafely(() => mailer.sendProfileUpdatedEmail({
                to: user.email,
                name: user.fullName,
                changes,
                when: new Date().toUTCString(),
            }));
        }

        res.status(200).json({ user: publicUser(user), message: 'Settings saved.' });
    } catch (err) {
        console.error('userController.updateProfile error:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

/**
 * POST /api/v1/user/password
 * Changes the password of a local account.
 */
exports.changePassword = async (req, res) => {
    const { currentPassword, newPassword } = req.body || {};

    if (typeof newPassword !== 'string' || newPassword.length < 8) {
        return res.status(400).json({ message: 'The new password must be at least 8 characters.' });
    }

    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        if (user.provider === 'google' && !user.password) {
            return res.status(400).json({ message: 'This account signs in with Google, so it has no password to change.' });
        }
        if (!(await user.comparePassword(currentPassword || ''))) {
            return res.status(401).json({ message: 'Your current password is not correct.' });
        }

        user.password = newPassword;
        await user.save();
        cache.del(`user:${user._id}`);

        await mailer.sendSafely(() => mailer.sendPasswordChangedEmail({
            to: user.email,
            name: user.fullName,
            when: new Date().toUTCString(),
        }));

        res.status(200).json({ message: 'Your password has been changed.' });
    } catch (err) {
        console.error('userController.changePassword error:', err);
        res.status(500).json({ message: 'Server error' });
    }
};
