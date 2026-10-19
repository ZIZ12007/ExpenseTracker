const express = require("express")
const { protect } = require("../middleware/authMiddleware")

const {
    registerUser,
    loginUser,
    getUserInfo,
} = require("../controllers/authController")
const upload = require("../middleware/uploadMiddleware")
const { isEnabled: cloudinaryEnabled, uploadBuffer } = require("../services/cloudinary")

const router = express.Router()

router.post("/register", registerUser)

router.post("/login", loginUser)    

router.get("/me", protect, getUserInfo)

router.post("/upload-image", upload.single("image"), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
    }

    try {
        let imageUrl;

        if (cloudinaryEnabled()) {
            // Stored in Cloudinary, so it survives redeploys.
            imageUrl = await uploadBuffer(req.file.buffer, {
                folder: process.env.CLOUDINARY_FOLDER || 'expensetracker/avatars',
                filename: req.file.originalname,
                contentType: req.file.mimetype,
            });
        } else {
            // Stored on the local disk, which most hosts wipe on redeploy.
            imageUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
        }

        res.status(200).json({ imageUrl });
    } catch (err) {
        console.error('authRoutes.upload-image error:', err);
        res.status(500).json({ message: 'Image upload failed' });
    }
})

module.exports = router