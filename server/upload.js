/**
 * Media upload to Cloudinary.
 * Expects CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET in env.
 */
import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';
const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

if (cloudName && apiKey && apiSecret) {
  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });
}

const memoryStorage = multer.memoryStorage();
export const uploadMiddleware = multer({
  storage: memoryStorage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = /^(image\/|video\/|audio\/|application\/pdf)/.test(file.mimetype);
    cb(null, !!allowed);
  }
}).single('file');

/**
 * POST /api/upload-media
 * Body: multipart/form-data with field "file".
 * Returns: { url, public_id } or 400/500.
 */
export async function uploadMediaHandler(req, res) {
  if (!cloudName || !apiKey || !apiSecret) {
    return res.status(503).json({ error: 'Cloudinary is not configured' });
  }
  if (!req.file || !req.file.buffer) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const mimetype = req.file.mimetype || 'application/octet-stream';
  const b64 = req.file.buffer.toString('base64');
  const dataUri = `data:${mimetype};base64,${b64}`;

  try {
    const result = await cloudinary.uploader.upload(dataUri, {
      folder: 'quiz-mda',
      resource_type: 'auto'
    });
    return res.json({ url: result.secure_url, public_id: result.public_id });
  } catch (err) {
    console.error('Cloudinary upload error:', err);
    return res.status(500).json({ error: 'Upload failed', details: err.message });
  }
}
