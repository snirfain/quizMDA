import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';

// טעינת מפתחות מהסביבה
const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

// הגדרת Cloudinary רק אם המפתחות קיימים
if (cloudName && apiKey && apiSecret) {
  cloudinary.config({ 
    cloud_name: cloudName, 
    api_key: apiKey, 
    api_secret: apiSecret,
    secure: true 
  });
}

// הגדרת Multer לשמירה בזיכרון (מתאים ל-Render)
const memoryStorage = multer.memoryStorage();

export const uploadMiddleware = multer({
  storage: memoryStorage,
  limits: { fileSize: 100 * 1024 * 1024 }, // עד 100MB
  fileFilter: (req, file, cb) => {
    const allowed = /^(image\/|video\/|audio\/|application\/pdf)/.test(file.mimetype);
    if (allowed) {
      cb(null, true);
    } else {
      cb(new Error('סוג קובץ לא נתמך'), false);
    }
  }
}).single('file');

/**
 * פונקציית ההעלאה הראשית
 */
export async function uploadMediaHandler(req, res) {
  // בדיקה שהגדרות הענן קיימות
  if (!cloudName || !apiKey || !apiSecret) {
    return res.status(503).json({ error: 'Cloudinary not configured' });
  }

  // בדיקה שהקובץ הגיע
  if (!req.file || !req.file.buffer) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    // המרת הקובץ לפורמט ש-Cloudinary מבין
    const b64 = req.file.buffer.toString('base64');
    const dataUri = `data:${req.file.mimetype};base64,${b64}`;

    // העלאה לענן
    const result = await cloudinary.uploader.upload(dataUri, {
      folder: 'quiz-mda',
      resource_type: 'auto',
      use_filename: true,
      unique_filename: true
    });

    // החזרת הקישור שישמר ב-MongoDB
    return res.json({ 
      url: result.secure_url, 
      public_id: result.public_id 
    });

  } catch (err) {
    console.error('Upload error:', err);
    return res.status(500).json({ 
      error: 'Upload failed', 
      details: err.message 
    });
  }
}