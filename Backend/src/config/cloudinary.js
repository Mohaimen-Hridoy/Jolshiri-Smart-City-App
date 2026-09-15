const cloudinary = require('cloudinary').v2;

/// Configures the Cloudinary SDK from env vars (see .env.example).
/// Used by middleware/upload.js so every uploaded photo (Rental, Community
/// Post, Complaint) is stored on Cloudinary instead of the container's local
/// disk — local disk storage doesn't survive a redeploy/restart on most
/// hosts (Render, Railway, etc.), which was silently losing every uploaded
/// image. Cloudinary URLs are permanent and CDN-backed.
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

module.exports = cloudinary;
