/**
 * Media upload to Cloudinary.
 * חובה לוודא שמשתני הסביבה מוגדרים ב-Render: 
 * CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
 */
import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';

const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

// הגדרת קונפיגורציה
if (cloudName && apiKey && apiSecret) {
  cloudinary.config({ 
    cloud_name: cloudName, 
    api_key: apiKey, 
    api_secret: apiSecret,
    secure: true // תמיד להשתמש ב-HTTPS
  });
}

// הגדרת Multer לאחסון בזיכרון (מתאים לשרתים כמו Render ללא אחסון דיסק)
const memoryStorage = multer.memoryStorage();
export const uploadMiddleware = multer({
  storage: memoryStorage,
  limits: { fileSize: 100 * 1024 * 1024 }, // הגבלה ל-100MB (חשוב לסרטוני וידאו)
  fileFilter: (_req, file, cb) => {
    const allowed = /^(image\/|video\/|audio\/|application\/pdf)/.test(file.mimetype);
    if (allowed) {
      return cb(null, true);
    }
    return cb(new Error('סוג קובץ לא נתמך'), false);
  }
}).single('file');

/**
 * POST /api/upload-media
 * הפונקציה שמעלה את הקובץ לענן ומחזירה קישור קבוע
 */
export async function uploadMediaHandler(req, res) {
  if (!cloudName || !apiKey || !apiSecret) {
    console.error('Cloudinary config missing!');
    return res.status(503).json({ error: 'שרת האחסון (Cloudinary) לא מוגדר' });
  }

  if (!req.file || !req.file.buffer) {
    return res.status(400).json({ error: 'לא נשלח קובץ' });
  }

  try {
    // המרת הקובץ מהזיכרון לפורמט שניתן לשלוח
    const b64 = req.file.buffer.toString('base64');
    const dataUri = `data:${req.file.mimetype};base64,${b64}`;

    // העלאה ל-Cloudinary
    const result = await cloudinary.uploader.upload(dataUri, {
      folder: 'quiz-mda', // שם התיקייה בענן
      resource_type: 'auto', // זיהוי אוטומטי של סוג הקובץ (וידאו/תמונה)
      use_filename: true,
      unique_filename: true
    });

    console.log('Upload success:', result.secure_url);

    // מחזירים את ה-URL המאובטח שישמר במסד הנתונים (MongoDB)
    return res.json({ 
      url: result.secure_url, 
      public_id: result.public_id 
    });

  } catch (err) {
    console.error('Cloudinary upload error:', err);
    return res.status(500).json({ 
      error: 'העלאה נכשלה', 
      details: err.message 
    });
  }
}