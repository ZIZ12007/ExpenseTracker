require ("dotenv").config();
const express = require("express")
const cors = require("cors")
const path = require("path")
const mongoose = require("mongoose")
const connectDB = require("./config/db")
const authRoutes = require("./routes/authRoutes")
const incomeRoutes = require("./routes/incomeRoutes")
const expenseRoutes = require("./routes/expenseRoutes")
const dashboardRoutes = require("./routes/dashboardRoutes")

const app = express()

app.use(
    cors({
        origin: process.env.CLIENT_URL || "*",
        methods: ["GET", "POST", "PUT", "DELETE"],
        allowedHeaders: ["Content-Type", "Authorization"]
    })
)

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

connectDB();

// Fail fast instead of letting Mongoose buffer requests until the client times out.
app.use("/api/v1", (req, res, next) => {
    if (mongoose.connection.readyState !== 1) {
        return res.status(503).json({
            message: "Database unavailable. Check the MongoDB connection and try again.",
        })
    }
    next()
})

app.use("/api/v1/auth", authRoutes)
app.use("/api/v1/income", require("./routes/incomeRoutes"))
app.use("/api/v1/expense", expenseRoutes)
app.use("/api/v1/dashboard", dashboardRoutes)

// Serve uploaded images statically folder
app.use("/uploads", express.static(path.join(__dirname, "uploads")))

// Global error handler
app.use((err, req, res, next) => {
    console.error(err)
    res.status(err.status || 500).json({ message: err.message || 'Server error' })
})

const PORT = process.env.PORT || 8000
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`))