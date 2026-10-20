const multer = require('multer')
const { resolveUploadsDir } = require('../config/storage')

// The file is always written to disk first. If Cloudinary is configured the
// file is then uploaded from there, so a Cloudinary outage degrades to local
// storage instead of failing the request.
const uploadsDir = resolveUploadsDir()

const storage = multer.diskStorage({
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
