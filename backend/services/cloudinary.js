const crypto = require('crypto');

/**
 * Optional Cloudinary upload support.
 *
 * When CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET are
 * set, profile photos are stored in Cloudinary instead of the container's
 * local disk (which is wiped on every redeploy on most hosts).
 *
 * When they are not set, the app keeps using local disk storage.
 */

const isEnabled = () =>
    Boolean(
        process.env.CLOUDINARY_CLOUD_NAME &&
        process.env.CLOUDINARY_API_KEY &&
        process.env.CLOUDINARY_API_SECRET
    );

// Cloudinary signs the sorted "key=value" string of every parameter except
// `file`, `api_key` and `signature`, concatenated with the API secret.
const signParams = (params, apiSecret) => {
    const toSign = Object.keys(params)
        .filter((key) => params[key] !== undefined && params[key] !== null && params[key] !== '')
        .sort()
        .map((key) => `${key}=${params[key]}`)
        .join('&');
    return crypto.createHash('sha1').update(toSign + apiSecret).digest('hex');
};

const uploadBuffer = async (buffer, { folder, filename, contentType } = {}) => {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    const params = { timestamp: Math.floor(Date.now() / 1000) };
    if (folder) params.folder = folder;
    if (process.env.CLOUDINARY_PUBLIC_ID_PREFIX) {
        params.public_id = `${process.env.CLOUDINARY_PUBLIC_ID_PREFIX}-${Date.now()}`;
    }

    const form = new FormData();
    form.append('file', new Blob([buffer], { type: contentType || 'image/png' }), filename || 'upload.png');
    form.append('api_key', apiKey);
    for (const [key, value] of Object.entries(params)) form.append(key, String(value));
    form.append('signature', signParams(params, apiSecret));

    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: 'POST',
        body: form,
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(`Cloudinary upload failed: ${result?.error?.message || response.status}`);
    }
    if (!result.secure_url) {
        throw new Error('Cloudinary upload failed: no secure_url in response');
    }
    return result.secure_url;
};

module.exports = { isEnabled, signParams, uploadBuffer };
