require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const mongoose = require("mongoose");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const { sharedLimit, byIp, byAccount } = require("./middleware/sharedRateLimit");
const connectDB = require("./config/db");
const { resolveUploadsDir } = require("./config/storage");
const authRoutes = require("./routes/authRoutes");
const incomeRoutes = require("./routes/incomeRoutes");
const expenseRoutes = require("./routes/expenseRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");

const app = express();

// Behind a TLS-terminating proxy (Render, Railway, Heroku, Fly, Vercel) the
// request arrives as http. Trusting the first hop makes req.protocol report
// https (so generated URLs are not served as mixed content) while keeping
// req.ip as the real client address, which the rate limiter relies on.
app.set("trust proxy", 1);

app.use(
    cors({
        origin: process.env.CLIENT_URL || "*",
        methods: ["GET", "POST", "PUT", "DELETE"],
        allowedHeaders: ["Content-Type", "Authorization"],
    })
);

// Compress JSON responses - the dashboard payload is mostly numbers and
// repeated keys, which gzip well.
app.use(compression());

// Basic hardening headers.
app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    next();
});

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// Rate limiting. The store is per instance, so on serverless hosts this
// bounds each instance rather than the whole account - enough to stop a
// runaway client without needing a shared store.
const apiLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    limit: Number(process.env.RATE_LIMIT_API_MAX || 600),
    standardHeaders: "draft-7",
    legacyHeaders: false,
    validate: { trustProxy: false, xForwardedForHeader: false },
    message: { message: "Too many requests. Please slow down and try again shortly." },
});

// A fast, per-instance guard. The shared limiters below enforce the real
// limits, so this one is deliberately generous.
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: Number(process.env.RATE_LIMIT_AUTH_IP_MAX || 100),
    standardHeaders: "draft-7",
    legacyHeaders: false,
    validate: { trustProxy: false, xForwardedForHeader: false },
    message: { message: "Too many authentication attempts. Please try again later." },
});

// The in-memory limiter only sees the requests that reach one instance, so
// the auth endpoints also use counters that are shared through the database.
//
// Two budgets are enforced:
//   - per IP, generous, so one person cannot spray many accounts
//   - per account, strict, so one account cannot be brute forced
// The per-account budget is what stops guessing a password, and because it is
// per account it does not punish people who share an IP (a campus, an office,
// a mobile carrier).
const authIpLimiter = sharedLimit({
    key: 'auth-ip',
    windowMs: 15 * 60 * 1000,
    limit: Number(process.env.RATE_LIMIT_AUTH_IP_MAX || 100),
    keyFn: byIp,
    message: "Too many authentication attempts. Please try again later.",
});

const authAccountLimiter = sharedLimit({
    key: 'auth-account',
    windowMs: 15 * 60 * 1000,
    limit: Number(process.env.RATE_LIMIT_AUTH_MAX || 10),
    keyFn: byAccount,
    message: "Too many attempts for this account. Please try again later.",
});

connectDB();

// Fail fast instead of letting Mongoose buffer requests until the client times
// out - but try to recover first, so a dropped connection heals itself.
app.use("/api/v1", async (req, res, next) => {
    if (mongoose.connection.readyState !== 1) {
        try {
            await connectDB();
        } catch (err) {
            console.error('MongoDB reconnect failed:', err.message);
        }
        if (mongoose.connection.readyState !== 1) {
            return res.status(503).json({
                message: "Database unavailable. Check the MongoDB connection and try again.",
            });
        }
    }
    next();
});

app.use("/api/v1/auth/login", authLimiter, authIpLimiter, authAccountLimiter);
app.use("/api/v1/auth/register", authLimiter, authIpLimiter, authAccountLimiter);
app.use("/api/v1/auth/refresh", authLimiter, authIpLimiter);
app.use("/api/v1", apiLimiter);

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/income", incomeRoutes);
app.use("/api/v1/expense", expenseRoutes);
app.use("/api/v1/dashboard", dashboardRoutes);

// Ensure the upload directory exists (it is gitignored, so it is missing on
// fresh checkouts and on every deploy). On read-only hosts this falls back to
// the system temp directory.
const uploadsDir = resolveUploadsDir();

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
