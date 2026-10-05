const express = require("express")
const { addIncome, getAllIncome, deleteIncome, downloadIncomeExcel } = require("../controllers/IncomeController")
const { protect } = require("../middleware/authMiddleware")

const router = express.Router()

router.post("/add", protect, addIncome)
router.get("/all", protect, getAllIncome)
router.get("/get", protect, getAllIncome)
router.get("/downloadExcel", protect, downloadIncomeExcel)
router.delete("/:id", protect, deleteIncome)   
 
module.exports = router