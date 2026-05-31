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
    secure: true,
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
  },
}).single('file');

/**
 * שם קובץ שעלול להגיע מקודד כ-latin1 אך הוא למעשה UTF-8 (לדוגמה עברית).
 * מחזיר את השם המפוענח אם זוהו תווים עבריים.
 */
function decodeUtf8Filename(raw) {
  if (!raw || typeof raw !== 'string') return '';
  try {
    const decoded = Buffer.from(raw, 'latin1').toString('utf8');
    if (decoded && /[\u0590-\u05FF]/.test(decoded)) return decoded;
  } catch (_) {
    /* ignore */
  }
  return raw;
}

/** הסרת הסיומת משם קובץ (לדוגמה .png) */
function stripExtension(filename) {
  return String(filename || '').replace(/\.[^./\\]+$/, '');
}

/**
 * הפיכת שם הבסיס ל-public_id חוקי ל-Cloudinary:
 * שומר עברית/אותיות/ספרות/רווח/קו-תחתון/מקף, ומחליף תווים אסורים בקו-תחתון.
 */
function toCloudinaryPublicId(baseName) {
  return String(baseName || '')
    .replace(/[\\/?&#%"<>:|*\n\r\t]+/g, '_') // תווים ש-Cloudinary אינו מקבל
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
}

/**
 * חילוץ תג קטלוג מתוך שם הקובץ המקורי.
 * לדוגמה: "פרק_4_החייאת_מבוגר.png" → "פרק 4 החייאת מבוגר".
 */
export function extractTagFromFilename(originalName) {
  const base = stripExtension(decodeUtf8Filename(originalName));
  return base
    .replace(/[_\-.]+/g, ' ') // מקפים/קווים תחתונים/נקודות → רווח
    .replace(/[^\u0590-\u05FF0-9a-zA-Z ]+/g, ' ') // הסרת סימנים מיוחדים
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * פונקציית ההעלאה הראשית.
 * שומרת את הקובץ ב-Cloudinary תחת השם המקורי (public_id), ומחזירה גם תג קטלוג
 * אוטומטי (media_bank_tag) שחולץ משם הקובץ.
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
    const originalName = decodeUtf8Filename(req.file.originalname || '');
    const baseName = stripExtension(originalName);
    const publicId = toCloudinaryPublicId(baseName) || undefined;
    const mediaBankTag = extractTagFromFilename(req.file.originalname || '');

    // המרת הקובץ לפורמט ש-Cloudinary מבין
    const b64 = req.file.buffer.toString('base64');
    const dataUri = `data:${req.file.mimetype};base64,${b64}`;

    // העלאה לענן — שם הקובץ ב-Cloudinary יהיה השם המקורי, ועדכון קובץ עם אותו שם יחליף את הקיים.
    const result = await cloudinary.uploader.upload(dataUri, {
      folder: 'quiz-mda',
      resource_type: 'auto',
      public_id: publicId,
      use_filename: true,
      unique_filename: false,
      overwrite: true,
    });

    // החזרת הקישור והמטא-דאטה שיישמרו ב-MongoDB / מאגר המדיה
    return res.json({
      url: result.secure_url,
      public_id: result.public_id,
      original_filename: originalName,
      media_bank_tag: mediaBankTag,
    });
  } catch (err) {
    console.error('Upload error:', err);
    return res.status(500).json({
      error: 'Upload failed',
      details: err.message,
    });
  }
}
