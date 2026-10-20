const express = require("express")
const { protect } = require("../middleware/authMiddleware")
const upload = require("../middleware/uploadMiddleware")
const {
    getBudget,
    addRecurring,
    deleteRecurring,
    uploadTimetable,
    updateTimetable,
    deleteTimetable,
    getRecommendations,
} = require("../controllers/budgetController")

const router = express.Router()

router.get("/", protect, getBudget)
router.post("/recurring", protect, addRecurring)
router.delete("/recurring/:id", protect, deleteRecurring)
router.post("/timetable", protect, upload.single("timetable"), uploadTimetable)
router.put("/timetable/:id", protect, updateTimetable)
router.delete("/timetable/:id", protect, deleteTimetable)
router.post("/recommendations", protect, getRecommendations)

module.exports = router
