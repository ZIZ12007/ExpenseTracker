require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const mongoose = require("mongoose");
const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const incomeRoutes = require("./routes/incomeRoutes");
const expenseRoutes = require("./routes/expenseRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");

const app = express();

// Behind a TLS-terminating proxy (Render, Railway, Heroku, Fly) the request
// arrives as http. Trusting the proxy makes req.protocol report https, so
// generated URLs (e.g. uploaded image URLs) are not served as mixed content.
app.set("trust proxy", true);

app.use(
    cors({
        origin: process.env.CLIENT_URL || "*",
        methods: ["GET", "POST", "PUT", "DELETE"],
        allowedHeaders: ["Content-Type", "Authorization"],
    })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

connectDB();

// Fail fast instead of letting Mongoose buffer requests until the client times out.
app.use("/api/v1", (req, res, next) => {
    if (mongoose.connection.readyState !== 1) {
        return res.status(503).json({
            message: "Database unavailable. Check the MongoDB connection and try again.",
        });
    }
    next();
});

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/income", incomeRoutes);
app.use("/api/v1/expense", expenseRoutes);
app.use("/api/v1/dashboard", dashboardRoutes);

// Ensure the upload directory exists (it is gitignored, so it is missing on
// fresh checkouts and on every deploy). Multer does not create it for us.
const uploadsDir = path.join(__dirname, "uploads");
fs.mkdirSync(uploadsDir, { recursive: true });

// Serve uploaded images statically
app.use("/uploads", express.static(uploadsDir));

// Serve frontend static files in production
const frontendDist = path.join(__dirname, "..", "frontend", "expense-tracker", "dist");
app.use(express.static(frontendDist));

// SPA catch-all: serve index.html for any non-API route.
// Express 5 requires named wildcards ("*splat"), a bare "*" throws at startup.
app.get("/{*splat}", (req, res, next) => {
    if (req.path.startsWith("/api/") || req.path.startsWith("/uploads/")) {
        return next();
    }
    const indexFile = path.join(frontendDist, "index.html");
    if (!fs.existsSync(indexFile)) {
        // Serverless hosts serve the SPA themselves and do not include the
        // frontend build in the function bundle.
        return res.status(404).json({ message: "Frontend build not found." });
    }
    res.sendFile(indexFile);
});

// Global error handler
app.use((err, req, res, next) => {
    console.error(err);
    res.status(err.status || 500).json({ message: err.message || "Server error" });
});

// Exported for serverless hosts (Vercel). Started as a normal server when run
// directly (node server.js).
module.exports = app;

if (require.main === module) {
    connectDB();
    const PORT = process.env.PORT || 8000;
    app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
}
