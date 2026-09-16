const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinary');
const ApiError = require('../utils/ApiError');

/// Common infra used by every part that stores an image (Plot, RentalListing,
/// CommunityPost, Complaint, ...).
///
/// Images are stored on Cloudinary (see config/cloudinary.js) so the URL
/// returned to the Flutter app is permanent and CDN-backed — local disk
/// storage doesn't survive a redeploy/restart on most hosts, which was
/// silently losing every uploaded photo. Set CLOUDINARY_CLOUD_NAME /
/// CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET in .env (see .env.example) —
/// free tier is plenty for this app.
///
/// If those env vars aren't set (e.g. local dev without a Cloudinary
/// account yet), this falls back to the old local-disk behaviour under
/// src/uploads/ so the app still runs — just without persistent storage.

const CLOUDINARY_ENABLED = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET
);

// Always computed (and created) even when Cloudinary is enabled, so
// index.js's static /uploads route and any pre-existing local files from
// before Cloudinary was configured keep working.
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

function fileFilter(req, file, cb) {
  if (!ALLOWED_MIME.has(file.mimetype)) {
    return cb(new ApiError(400, 'Only JPEG, PNG, WEBP or GIF images are allowed'));
  }
  cb(null, true);
}

let storage;

if (CLOUDINARY_ENABLED) {
  storage = new CloudinaryStorage({
    cloudinary,
    params: {
      folder: 'jolshiri-uploads',
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
      // Keeps a readable-ish unique name; Cloudinary still de-dupes via its
      // own asset id under the hood.
      public_id: (req, file) => `${Date.now()}-${Math.round(Math.random() * 1e9)}`,
    },
  });
} else {
  console.warn(
    '[upload] CLOUDINARY_* env vars not set — falling back to local disk storage under src/uploads/. ' +
    'Uploaded images will NOT survive a redeploy/restart. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY ' +
    'and CLOUDINARY_API_SECRET in .env to fix this (see .env.example).'
  );
  storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `${unique}${ext}`);
    },
  });
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

/// Builds the URL to store on the model / return to the Flutter app for an
/// uploaded file.
///  - Cloudinary path: multer-storage-cloudinary sets `file.path` to the
///    Cloudinary `secure_url` already, so we just return it as-is.
///  - Local-disk fallback path: builds a URL against PUBLIC_BASE_URL (or the
///    request's own host) pointing at the static /uploads route.
function fileUrlFor(req, file) {
  if (!file) return undefined;
  if (CLOUDINARY_ENABLED) return file.path;
  const base = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`;
  return `${base}/uploads/${file.filename}`;
}

module.exports = { upload, fileUrlFor, CLOUDINARY_ENABLED, UPLOAD_DIR };
