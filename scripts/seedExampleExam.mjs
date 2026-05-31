#!/usr/bin/env node
/**
 * Seeds an example exam — one question of every supported type:
 *   נכון/לא נכון · אמריקאי תשובה אחת · אמריקאי כמה תשובות · שאלה מתגלגלת ·
 *   שאלה עם סאונד · שאלה עם תמונה · שאלה עם וידאו
 *
 * All questions share case_name = "מבחן לדוגמה — כל סוגי השאלות" so they are
 * easy to find and so re-running the script is idempotent (old copies are
 * removed first). Questions are created active and ready for use.
 *
 * Usage:
 *   node scripts/seedExampleExam.mjs
 *
 * Loads .env from the project root when MONGODB_URI is not already set.
 * NOTE: the media URLs are public sample assets — replace them with real
 * lung-sound / ECG / clip media from your media bank when ready.
 */
import mongoose from 'mongoose';
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

function loadEnvFile() {
  const envPath = path.join(ROOT, '.env');
  if (!existsSync(envPath)) return;
  const txt = readFileSync(envPath, 'utf8');
  for (const raw of txt.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env) || process.env[key] === '') process.env[key] = val;
  }
}

loadEnvFile();

const EXAM_NAME = 'מבחן לדוגמה — כל סוגי השאלות';
const RESPIRATORY = '4. החולה הנשימתי';
const RESPIRATORY_SUB = 'סימנים למצוקה נשימתית';
const ECG_CAT = '9. הפרעות קצב ואוטם בשריר הלב';
const ECG_SUB = 'הגלים הבסיסיים בבדיקת אק"ג';

const base = {
  case_name: EXAM_NAME,
  category: RESPIRATORY,
  sub_category: RESPIRATORY_SUB,
  thinking_level: 'Understanding',
  training_level: 'A',
  medical_levels: ['ALS'],
  status: 'active',
};

const questions = [
  // 1) נכון / לא נכון
  {
    ...base,
    question_type: 'true_false',
    question_text: 'נכון או לא נכון: ערך סטורציה (SpO₂) באדם בריא הנושם אוויר חדר הוא בדרך כלל מעל 94%.',
    options: [
      { value: 'true', label: 'נכון' },
      { value: 'false', label: 'לא נכון' },
    ],
    correct_answer: { value: 'true' },
    explanation: 'באדם בריא הנושם אוויר חדר, ערך הסטורציה התקין הוא 94%–100%.',
  },

  // 2) אמריקאי — תשובה אחת נכונה
  {
    ...base,
    category: '8. מחלות קרדיווסקולאריות',
    sub_category: 'החייאה',
    question_type: 'single_choice',
    question_text: 'מהו קצב הלחיצות המומלץ בעיסויי חזה בהחייאת מבוגר?',
    options: [
      { value: '0', label: '60–80 לחיצות בדקה' },
      { value: '1', label: '100–120 לחיצות בדקה' },
      { value: '2', label: '140–160 לחיצות בדקה' },
      { value: '3', label: '180–200 לחיצות בדקה' },
    ],
    correct_answer: { value: '1' },
    explanation: 'הקצב המומלץ הוא 100–120 לחיצות בדקה לעומק של כ-5–6 ס"מ.',
  },

  // 3) אמריקאי — כמה תשובות נכונות
  {
    ...base,
    question_type: 'multi_choice',
    question_text: 'אילו מהבאים הם סימנים למצוקה נשימתית? (בחר/י את כל התשובות הנכונות)',
    options: [
      { value: '0', label: 'שימוש בשרירי עזר לנשימה' },
      { value: '1', label: 'ציאנוזה (כחלון)' },
      { value: '2', label: 'דיבור שוטף במשפטים ארוכים' },
      { value: '3', label: 'נשימה מהירה (טכיפניאה)' },
    ],
    correct_answer: { values: ['0', '1', '3'] },
    explanation: 'דיבור שוטף במשפטים ארוכים מעיד דווקא על מצב נשימתי תקין; השאר סימני מצוקה.',
  },

  // 4) שאלה מתגלגלת (גזע + 3 ענפים, DAG תקין)
  {
    ...base,
    case_name: EXAM_NAME,
    category: '8. מחלות קרדיווסקולאריות',
    sub_category: 'דום לב (Cardiac Arrest: CA)',
    question_type: 'rolling_case',
    question_text:
      'גבר בן 64 מתלונן על כאב לוחץ בחזה שהחל לפני כ-30 דקות, מקרין ליד שמאל ומלווה בהזעה. הוזעקתם לביתו. נהל/י את האירוע.',
    options: [],
    correct_answer: null,
    explanation: 'מקרה לדוגמה הממחיש זרימת ענפים: פעולה ראשונה → טיפול / סוגיית הסכמה.',
    rolling_case: {
      branches: [
        {
          id: 'b1',
          question_type: 'single_choice',
          question_text: 'מהי הפעולה הראשונה שתבצע/י עם הגעתך למטופל?',
          options: [
            { value: '0', label: 'חיבור מוניטור, מדידת מדדים וביצוע אק"ג 12 לידים' },
            { value: '1', label: 'הנחיה למטופל להגיע עצמאית לבית החולים' },
            { value: '2', label: 'השכבה והמתנה ללא ניטור' },
          ],
          correct_answer: { value: '0' },
          explanation: 'בכאב חזה חשוד יש לנטר ולבצע אק"ג 12 לידים מוקדם ככל האפשר.',
        },
        {
          id: 'b2',
          question_type: 'multi_choice',
          question_text: 'בהתאם לפרוטוקול, אילו טיפולים נשקול במטופל זה? (בחר/י את כל הנכונות)',
          options: [
            { value: '0', label: 'אספירין ללעיסה (בהיעדר התווית נגד)' },
            { value: '1', label: 'מתן חמצן בהתאם לסטורציה/מצב' },
            { value: '2', label: 'אנטיביוטיקה רחבת טווח' },
          ],
          correct_answer: { values: ['0', '1'] },
          explanation: 'אנטיביוטיקה אינה רלוונטית לתסמונת כלילית חריפה.',
          is_terminal: true,
        },
        {
          id: 'b3',
          question_type: 'true_false',
          question_text: 'נכון/לא נכון: גם אם המטופל בהכרה מלאה ומסרב לפינוי, מותר לפנותו בכוח ללא הסכמתו.',
          options: [
            { value: 'true', label: 'נכון' },
            { value: 'false', label: 'לא נכון' },
          ],
          correct_answer: { value: 'false' },
          explanation: 'מטופל כשיר בהכרה רשאי לסרב; פינוי בכפייה אינו מותר ככלל.',
          is_terminal: true,
        },
      ],
      transitions: [
        { from_branch_id: 'b1', to_branch_id: 'b2', priority: 1, condition: { mode: 'is_correct' } },
        { from_branch_id: 'b1', to_branch_id: 'b3', priority: 2, condition: { mode: 'is_incorrect' } },
      ],
      terminal_branch_ids: ['b2', 'b3'],
    },
  },

  // 5) שאלה עם סאונד
  {
    ...base,
    question_type: 'single_choice',
    question_text: 'האזן/י להקלטת קולות הנשימה. איזה ממצא נשמע בהאזנה?',
    media_attachment: {
      url: 'https://www.w3schools.com/html/horse.mp3',
      type: 'audio',
      name: 'דוגמת שמע (להחלפה בהקלטת קולות נשימה אמיתית)',
    },
    options: [
      { value: '0', label: 'צפצופים (Wheezing)' },
      { value: '1', label: 'חרחורים (Crackles)' },
      { value: '2', label: 'קולות נשימה תקינים' },
      { value: '3', label: 'היעדר קולות נשימה' },
    ],
    correct_answer: { value: '0' },
    explanation: 'הקלטה זו היא דוגמה בלבד — החליפו אותה בקובץ קולות נשימה אמיתי מהמדיה.',
  },

  // 6) שאלה עם תמונה
  {
    ...base,
    category: ECG_CAT,
    sub_category: ECG_SUB,
    question_type: 'single_choice',
    question_text: 'התבונן/י בתרשים האק"ג המצורף. מהו הקצב המוצג?',
    media_attachment: {
      url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/SinusRhythmLabels.svg/640px-SinusRhythmLabels.svg.png',
      type: 'image',
      name: 'תרשים אק"ג — קצב סינוס',
    },
    options: [
      { value: '0', label: 'קצב סינוס תקין' },
      { value: '1', label: 'פרפור פרוזדורים (AF)' },
      { value: '2', label: 'טכיקרדיה חדרית (VT)' },
      { value: '3', label: 'אסיסטולה' },
    ],
    correct_answer: { value: '0' },
    explanation: 'התרשים מציג קצב סינוס תקין עם גלי P לפני כל קומפלקס QRS.',
  },

  // 7) שאלה עם וידאו
  {
    ...base,
    question_type: 'single_choice',
    question_text: 'צפה/י בסרטון ההדגמה. אילו עקרונות תרצה/י לוודא שמבוצעים נכון בעת ביצוע הפעולה?',
    media_attachment: {
      url: 'https://www.w3schools.com/html/mov_bbb.mp4',
      type: 'video',
      name: 'סרטון הדגמה (להחלפה בסרטון פעולה אמיתי)',
    },
    options: [
      { value: '0', label: 'תנוחת ידיים, עומק וקצב נכונים' },
      { value: '1', label: 'אין צורך בניטור במהלך הפעולה' },
      { value: '2', label: 'יש לעצור את הפעולה כל 10 שניות' },
      { value: '3', label: 'הפעולה מבוצעת רק על ידי רופא' },
    ],
    correct_answer: { value: '0' },
    explanation: 'סרטון זה הוא דוגמה בלבד — החליפו אותו בסרטון פעולה אמיתי מהמדיה.',
  },
];

const uri = process.env.MONGODB_URI?.trim();
if (!uri) {
  console.error('חסר MONGODB_URI (ב-.env או בסביבה).');
  process.exit(1);
}

try {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
  console.log(`מחובר ל-${mongoose.connection.db?.databaseName}`);

  const { default: Question } = await import('../models/Question.js');

  const removed = await Question.deleteMany({ case_name: EXAM_NAME });
  if (removed.deletedCount) {
    console.log(`הוסרו ${removed.deletedCount} שאלות דוגמה קודמות (idempotent).`);
  }

  // create() runs the pre('save') hook so has_media is computed correctly.
  const created = await Question.create(questions);
  console.log(`נוצרו ${created.length} שאלות תחת המבחן "${EXAM_NAME}":`);
  for (const q of created) {
    console.log(`  • [${q.question_type}] ${q.question_text.slice(0, 48)}…  (id: ${q._id})`);
  }

  await mongoose.disconnect();
  console.log('הושלם.');
  process.exit(0);
} catch (err) {
  console.error('שגיאה:', err.message || err);
  try { await mongoose.disconnect(); } catch (_) {}
  process.exit(1);
}
