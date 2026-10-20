const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    fullName: { type: String, required: true },
    // A short, unique handle the user can change. Optional, because the
    // account may be created through Google without one.
    username: {
        type: String,
        unique: true,
        sparse: true,
        trim: true,
        minlength: 3,
        maxlength: 24,
        match: /^[a-zA-Z0-9_.]+$/,
    },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: false },
    profileImageUrl: { type: String, default: null },

    // How the account signs in.
    provider: { type: String, enum: ['local', 'google', 'email'], default: 'local' },
    googleId: { type: String, unique: true, sparse: true },

    // Email verification and password recovery.
    emailVerified: { type: Boolean, default: false },
    verifyToken: { type: String, default: null },
    verifyTokenExpires: { type: Date, default: null },
    resetToken: { type: String, default: null },
    resetTokenExpires: { type: Date, default: null },
    // A one time sign in link.
    loginToken: { type: String, default: null },
    loginTokenExpires: { type: Date, default: null },

    // Preferences.
    currency: { type: String, default: 'NGN', enum: ['NGN', 'USD', 'GBP', 'EUR', 'GHS', 'ZAR', 'KES'] },
    allowance: { type: Number, default: 0, min: 0 },   // daily allowance, in the user's currency
    notifications: { type: Boolean, default: true },
    onboarded: { type: Boolean, default: false },
},{
    timestamps: true
});

userSchema.pre('save', async function () {
    if (!this.isModified('password') || !this.password) return;
    this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.comparePassword = async function (candidatePassword) {
    if (!this.password) return false;
    return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema)
