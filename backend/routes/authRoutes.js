const express = require("express")
const { protect } = require("../middleware/authMiddleware")

const {
    registerUser,
    loginUser,
    getUserInfo,
    refreshSession,
    verifyEmail,
    resendVerification,
    forgotPassword,
    resetPassword,
    googleStart,
    googleCallback,
    googleStatus,
    requestMagicLink,
    verifyMagicLink,
    magicLinkEntry,
    serviceStatus,
} = require("../controllers/authController")
const upload = require("../middleware/uploadMiddleware")
const { isEnabled: cloudinaryEnabled, uploadBuffer: uploadToCloudinary } = require("../services/cloudinary")

const router = express.Router()

router.post("/register", registerUser)

router.post("/login", loginUser)    

router.get("/me", protect, getUserInfo)

router.post("/refresh", refreshSession)

router.post("/verify-email", verifyEmail)
router.post("/resend-verification", resendVerification)
router.post("/forgot-password", forgotPassword)
router.post("/reset-password", resetPassword)

router.get("/google/status", googleStatus)
router.get("/service-status", serviceStatus)
router.get("/google", googleStart)
router.get("/google/callback", googleCallback)

router.post("/magic-link", requestMagicLink)
router.post("/magic-link/verify", verifyMagicLink)
router.get("/magic-link", magicLinkEntry)

router.post("/upload-image", upload.single("image"), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
    }

    if (!cloudinaryEnabled()) {
        return res.status(503).json({ message: 'Image storage is not set up on this server.' });
    }

    try {
        // Stored in Cloudinary, so the picture survives a redeploy.
        const imageUrl = await uploadToCloudinary(req.file.buffer, {
            folder: process.env.CLOUDINARY_FOLDER || 'expensetracker/avatars',
            filename: req.file.originalname,
            contentType: req.file.mimetype,
        });
        res.status(200).json({ imageUrl });
    } catch (err) {
        console.error('authRoutes.upload-image error:', err);
        res.status(500).json({ message: 'The image could not be uploaded.' });
    }
})

module.exports = router