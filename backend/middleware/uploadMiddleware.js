const multer = require('multer')
const path = require('path')
const fs = require('fs')
const { isEnabled } = require('../services/cloudinary')

// Resolve the upload directory from this file, not from process.cwd(), so the
// folder is the same one that server.js serves statically at /uploads.
const uploadsDir = path.join(__dirname, '..', 'uploads')
fs.mkdirSync(uploadsDir, { recursive: true })

// When Cloudinary is configured the file is kept in memory and uploaded from
// there; otherwise it is written to local disk.
const storage = isEnabled()
    ? multer.memoryStorage()
    : multer.diskStorage({
        destination: (req, file, cb) => {
            cb(null, uploadsDir)
        },
        filename: (req, file, cb) => {
            cb(null, `${Date.now()}-${file.originalname}`)
        },
    })

//File Filter
const fileFilter = (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/jpg'];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and JPG are allowed.'), false);
    }
}

const upload = multer({ storage, fileFilter })

module.exports = upload;
