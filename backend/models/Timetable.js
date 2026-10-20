const mongoose = require('mongoose');

/**
 * A school food timetable uploaded by the user.
 *
 * The image (or PDF) is stored on the host, and the meals are extracted from
 * it by the AI. The extracted rows are kept here so the timetable can be
 * reviewed and corrected by the user.
 */
const MealSchema = new mongoose.Schema({
    day: { type: String, required: true },        // e.g. "Monday"
    breakfast: { type: String, default: '' },
    lunch: { type: String, default: '' },
    supper: { type: String, default: '' },
    estimatedCost: { type: Number, default: 0 },  // in the user's currency
}, { _id: false });

const TimetableSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, default: 'School timetable' },
    // The file is kept in Cloudinary. It is empty for an HTML timetable,
    // which is only read and never stored.
    fileUrl: { type: String, default: '' },
    fileName: { type: String, default: '' },
    status: { type: String, enum: ['processing', 'ready', 'failed'], default: 'processing' },
    meals: { type: [MealSchema], default: [] },
    notes: { type: String, default: '' },
    extractedAt: { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model('Timetable', TimetableSchema);
