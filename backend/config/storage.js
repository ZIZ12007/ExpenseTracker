const os = require('os');
const path = require('path');
const fs = require('fs');

/**
 * Resolves the directory used for uploaded files.
 *
 * On a normal host this is `backend/uploads`. On serverless platforms
 * (Vercel) the deployment directory is read-only, so it falls back to the
 * system temp directory. Files there only live as long as the instance does,
 * which is why Cloudinary is the recommended setup for those hosts.
 */
const resolveUploadsDir = () => {
    const localDir = path.join(__dirname, '..', 'uploads');
    try {
        fs.mkdirSync(localDir, { recursive: true });
        fs.accessSync(localDir, fs.constants.W_OK);
        return localDir;
    } catch (err) {
        const fallback = path.join(os.tmpdir(), 'expensetracker-uploads');
        fs.mkdirSync(fallback, { recursive: true });
        console.warn(
            `Uploads directory is not writable (${err.code || err.message}); using ${fallback}. ` +
            'Files will not survive a restart - configure Cloudinary for persistent uploads.'
        );
        return fallback;
    }
};

module.exports = { resolveUploadsDir };
