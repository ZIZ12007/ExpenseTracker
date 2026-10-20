const mongoose = require('mongoose');

/**
 * A counter used by the shared rate limiter.
 *
 * The document id is "<key>:<window start>", so each time window gets its
 * own counter and the old ones expire on their own.
 */
const RateLimitSchema = new mongoose.Schema({
    _id: { type: String },
    count: { type: Number, default: 0 },
    expiresAt: { type: Date },
}, { versionKey: false });

// Mongo removes the document once the window is over.
RateLimitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('RateLimit', RateLimitSchema);
