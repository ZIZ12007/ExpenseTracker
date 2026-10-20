const multer = require('multer')
const path = require('path')

// Images for avatars, and the formats a school timetable can arrive in.
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/jpg', 'image/webp', 'image/heic']
const DOCUMENT_TYPES = ['application/pdf', 'text/html', 'application/xhtml+xml', 'text/plain']

// Some browsers send a generic type for files it does not recognise, so the
// extension is checked as well.
const EXTENSION_TYPES = {
    '.pdf': 'application/pdf',
    '.html': 'text/html',
    '.htm': 'text/html',
    '.txt': 'text/plain',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
};

/**
 * Builds an uploader that accepts the given file types.
 *
 * The file is held in memory only. It is never written to the server's disk:
 * a serverless instance's disk does not outlive the request, so a file kept
 * there would be gone by the time anyone looked at it.
 */
const makeUploader = (allowedTypes) => {
    const storage = multer.memoryStorage();

    const fileFilter = (req, file, cb) => {
        const extension = path.extname(file.originalname || '').toLowerCase();
        const type = file.mimetype || EXTENSION_TYPES[extension];
        if (allowedTypes.includes(type)) {
            return cb(null, true);
        }
        const err = new Error(`That file type is not accepted. Please upload ${allowedTypes.includes('application/pdf') ? 'an image, a PDF or an HTML file' : 'an image'}.`);
        err.status = 400;
        cb(err, false);
    };

    return multer({ storage, fileFilter, limits: { fileSize: Number(process.env.UPLOAD_MAX_BYTES || 12 * 1024 * 1024) } });
};

// Avatars are images only.
const upload = makeUploader(IMAGE_TYPES);

// The school timetable can be a photo, a PDF or an HTML file.
const timetableUpload = makeUploader([...IMAGE_TYPES, ...DOCUMENT_TYPES]);

module.exports = upload;
module.exports.upload = upload;
module.exports.timetableUpload = timetableUpload;
module.exports.IMAGE_TYPES = IMAGE_TYPES;
module.exports.DOCUMENT_TYPES = DOCUMENT_TYPES;
