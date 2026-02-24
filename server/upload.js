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
    // #region agent log
    if (!allowed) fetch('http://127.0.0.1:7243/ingest/128e287e-a01f-48c3-a335-b3685c6b2ca9',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'28554a'},body:JSON.stringify({sessionId:'28554a',hypothesisId:'H2',location:'server/upload.js:fileFilter',message:'file rejected by filter',data:{mimetype:file.mimetype,fieldname:file.fieldname},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
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
  // #region agent log
  const hasConfig = !!(cloudName && apiKey && apiSecret);
  const hasFile = !!(req.file && req.file.buffer);
  fetch('http://127.0.0.1:7243/ingest/128e287e-a01f-48c3-a335-b3685c6b2ca9',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'28554a'},body:JSON.stringify({sessionId:'28554a',hypothesisId:'H1_H2_H3',location:'server/upload.js:uploadMediaHandler:entry',message:'upload handler entry',data:{hasConfig,hasFile,fileKeys:req.file?Object.keys(req.file):null,bufferLength:req.file?.buffer?.byteLength??null,mimetype:req.file?.mimetype??null},timestamp:Date.now()})}).catch(()=>{});
  // #endregion

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

    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/128e287e-a01f-48c3-a335-b3685c6b2ca9',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'28554a'},body:JSON.stringify({sessionId:'28554a',hypothesisId:'H4',location:'server/upload.js:before-cloudinary',message:'before cloudinary upload',data:{dataUriLength:dataUri.length,mimetype:req.file.mimetype},timestamp:Date.now()})}).catch(()=>{});
    // #endregion

    // העלאה לענן
    const result = await cloudinary.uploader.upload(dataUri, {
      folder: 'quiz-mda',
      resource_type: 'auto',
      use_filename: true,
      unique_filename: true
    });

    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/128e287e-a01f-48c3-a335-b3685c6b2ca9',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'28554a'},body:JSON.stringify({sessionId:'28554a',hypothesisId:'H5',location:'server/upload.js:success',message:'upload success',data:{hasSecureUrl:!!result?.secure_url,publicId:result?.public_id||null},timestamp:Date.now()})}).catch(()=>{});
    // #endregion

    // החזרת הקישור שישמר ב-MongoDB
    return res.json({ 
      url: result.secure_url, 
      public_id: result.public_id 
    });

  } catch (err) {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/128e287e-a01f-48c3-a335-b3685c6b2ca9',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'28554a'},body:JSON.stringify({sessionId:'28554a',hypothesisId:'H4',location:'server/upload.js:catch',message:'upload error',data:{errMessage:err?.message||String(err),errCode:err?.error?.http_code??null,errName:err?.name??null},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    console.error('Upload error:', err);
    return res.status(500).json({ 
      error: 'Upload failed', 
      details: err.message 
    });
  }
}