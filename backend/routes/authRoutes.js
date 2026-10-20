const express = require("express")
const { protect } = require("../middleware/authMiddleware")

const {
    registerUser,
    loginUser,
    getUserInfo,
    refreshSession,
} = require("../controllers/authController")
const upload = require("../middleware/uploadMiddleware")
const fs = require('fs')
const { isEnabled: cloudinaryEnabled, uploadBuffer: uploadToCloudinary } = require("../services/cloudinary")

const router = express.Router()

router.post("/register", registerUser)

router.post("/login", loginUser)    

router.get("/me", protect, getUserInfo)

router.post("/refresh", refreshSession)

router.post("/upload-image", upload.single("image"), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
    }

    const localUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;

    if (cloudinaryEnabled()) {
        try {
            // Stored in Cloudinary, so it survives redeploys.
            const imageUrl = await uploadToCloudinary(fs.readFileSync(req.file.path), {
                folder: process.env.CLOUDINARY_FOLDER || 'expensetracker/avatars',
                filename: req.file.originalname,
                contentType: req.file.mimetype,
            });
            // The local copy is no longer needed.
            fs.unlink(req.file.path, () => {});
            return res.status(200).json({ imageUrl });
        } catch (err) {
            // Fall back to local storage rather than failing the request.
            console.error('Cloudinary upload failed, falling back to local storage:', err.message);
        }
    }

    // Stored on the local disk, which most hosts wipe on redeploy.
    res.status(200).json({ imageUrl: localUrl });
})

module.exports = router