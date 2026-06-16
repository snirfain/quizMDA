/**
 * REST API for daily challenges + archive.
 * Scoring: today's challenge = 2 points, archived challenge = 1.5 points.
 * A unique (user_id, challenge_date) index prevents solving the same challenge twice.
 * Hebrew: אתגר יומי, ארכיון, ניקוד ומניעת פתרון כפול.
 */
import mongoose from 'mongoose';
import ChallengeQuestion from '../models/ChallengeQuestion.js';
import ChallengeAttempt from '../models/ChallengeAttempt.js';
import User from '../models/User.js';
import { isDbConnected, ensureDbConnection } from './db.js';
import { getActor } from './authMiddleware.js';

const POINTS_TODAY = 2;
const POINTS_ARCHIVE = 1.5;

/** Current calendar day in Israel time as 'YYYY-MM-DD'. */
export function israelToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/** Strip the answer/explanation so the client can't cheat before answering. */
function toPublicChallenge(doc, attempt) {
  return {
    id: doc._id.toString(),
    challenge_date: doc.challenge_date,
    question_text: doc.question_text,
    options: doc.options || [],
    category: doc.category || '',
    media_url: doc.media_url || null,
    is_today: doc.challenge_date === israelToday(),
    // Reveal the solution only once the user has an attempt on record.
    solved: !!attempt,
    your_answer: attempt?.answer ?? null,
    is_correct: attempt ? attempt.is_correct : null,
    points_awarded: attempt ? attempt.points_awarded : null,
    correct_answer: attempt ? doc.correct_answer : undefined,
    explanation: attempt ? doc.explanation : undefined,
  };
}

async function attemptsByDate(userId, dates) {
  if (!userId || dates.length === 0) return new Map();
  const list = await ChallengeAttempt.find({
    user_id: userId,
    challenge_date: { $in: dates },
  }).lean();
  return new Map(list.map((a) => [a.challenge_date, a]));
}

/** GET /api/challenges/today */
export async function getTodayChallenge(req, res) {
  try {
    await ensureDbConnection();
    if (!isDbConnected()) return res.status(200).json(null);

    const date = israelToday();
    const doc = await ChallengeQuestion.findOne({ challenge_date: date, active: true });
    if (!doc) return res.status(200).json(null);

    const actor = getActor(req);
    const userId = actor.user_id || actor.email || null;
    const attempt = userId
      ? await ChallengeAttempt.findOne({ user_id: userId, challenge_date: date }).lean()
      : null;

    res.json(toPublicChallenge(doc, attempt));
  } catch (err) {
    console.error('GET /api/challenges/today error:', err);
    res.status(500).json({ error: 'טעינת האתגר היומי נכשלה' });
  }
}

/** GET /api/challenges/archive — past challenges (excludes today). */
export async function getChallengeArchive(req, res) {
  try {
    await ensureDbConnection();
    if (!isDbConnected()) return res.status(200).json([]);

    const date = israelToday();
    const docs = await ChallengeQuestion.find({ challenge_date: { $lt: date }, active: true })
      .sort({ challenge_date: -1 })
      .limit(120)
      .lean();

    const actor = getActor(req);
    const userId = actor.user_id || actor.email || null;
    const attempts = await attemptsByDate(userId, docs.map((d) => d.challenge_date));

    res.json(docs.map((d) => toPublicChallenge(d, attempts.get(d.challenge_date))));
  } catch (err) {
    console.error('GET /api/challenges/archive error:', err);
    res.status(500).json({ error: 'טעינת ארכיון האתגרים נכשלה' });
  }
}

/** POST /api/challenges/:date/answer — body: { answer } */
export async function answerChallenge(req, res) {
  try {
    await ensureDbConnection();
    if (!isDbConnected()) return res.status(503).json({ error: 'מסד הנתונים אינו זמין כעת' });

    const { date } = req.params;
    const { answer } = req.body || {};
    if (answer === undefined || answer === null || String(answer) === '') {
      return res.status(400).json({ error: 'יש לבחור תשובה' });
    }

    const actor = getActor(req);
    const userId = actor.user_id || actor.email;
    if (!userId) return res.status(401).json({ error: 'נדרשת התחברות כדי לפתור אתגר' });

    const doc = await ChallengeQuestion.findOne({ challenge_date: date, active: true });
    if (!doc) return res.status(404).json({ error: 'האתגר לא נמצא' });

    const today = israelToday();
    if (date > today) return res.status(400).json({ error: 'אתגר זה עדיין לא זמין' });

    const isToday = date === today;
    const isCorrect = String(answer) === String(doc.correct_answer);
    const pointsAwarded = isCorrect ? (isToday ? POINTS_TODAY : POINTS_ARCHIVE) : 0;

    // Atomically guarantee a single attempt per user/challenge.
    let attempt;
    try {
      attempt = await ChallengeAttempt.create({
        user_id: userId,
        challenge_date: date,
        challenge_id: doc._id.toString(),
        is_correct: isCorrect,
        points_awarded: pointsAwarded,
        solved_from: isToday ? 'today' : 'archive',
      });
    } catch (e) {
      if (e?.code === 11000) {
        return res.status(409).json({ error: 'כבר פתרת את האתגר הזה' });
      }
      throw e;
    }

    if (pointsAwarded > 0) {
      await User.findOneAndUpdate(
        actor.user_id ? { user_id: actor.user_id } : { email: (actor.email || '').toLowerCase() },
        { $inc: { points: pointsAwarded } },
      );
    }

    res.json({
      is_correct: isCorrect,
      correct_answer: doc.correct_answer,
      explanation: doc.explanation || '',
      points_awarded: pointsAwarded,
      attempt_id: attempt._id.toString(),
    });
  } catch (err) {
    console.error('POST /api/challenges/:date/answer error:', err);
    res.status(500).json({ error: 'שמירת התשובה נכשלה' });
  }
}

// ── Admin authoring ─────────────────────────────────────────────────

/** GET /api/challenges/admin — full list incl. answers, for management. */
export async function listChallengesAdmin(_req, res) {
  try {
    await ensureDbConnection();
    if (!isDbConnected()) return res.status(200).json([]);
    const list = await ChallengeQuestion.find({}).sort({ challenge_date: -1 }).limit(365).lean();
    res.json(list.map(({ _id, ...rest }) => ({ id: _id.toString(), ...rest })));
  } catch (err) {
    console.error('GET /api/challenges/admin error:', err);
    res.status(500).json({ error: 'טעינת רשימת האתגרים נכשלה' });
  }
}

/** POST /api/challenges/admin — upsert a challenge by its date. */
export async function upsertChallengeAdmin(req, res) {
  try {
    await ensureDbConnection();
    if (!isDbConnected()) return res.status(503).json({ error: 'מסד הנתונים אינו זמין כעת' });

    const actor = getActor(req);
    const { challenge_date, question_text, options, correct_answer, explanation, category, media_url, active } =
      req.body || {};

    if (!challenge_date || !/^\d{4}-\d{2}-\d{2}$/.test(challenge_date)) {
      return res.status(400).json({ error: 'תאריך האתגר חייב להיות בפורמט YYYY-MM-DD' });
    }
    if (!question_text || !String(question_text).trim()) {
      return res.status(400).json({ error: 'יש למלא את נוסח השאלה' });
    }
    if (!Array.isArray(options) || options.length < 2) {
      return res.status(400).json({ error: 'יש להגדיר לפחות שתי אפשרויות' });
    }
    if (correct_answer === undefined || correct_answer === null || String(correct_answer) === '') {
      return res.status(400).json({ error: 'יש לבחור תשובה נכונה' });
    }

    const update = {
      question_text: String(question_text).trim(),
      options,
      correct_answer: String(correct_answer),
      explanation: String(explanation || '').trim(),
      category: String(category || '').trim(),
      media_url: media_url || null,
      active: active !== false,
      author_id: actor.user_id || actor.email || null,
      author_name: actor.name || null,
    };

    const doc = await ChallengeQuestion.findOneAndUpdate(
      { challenge_date },
      { $set: update, $setOnInsert: { challenge_date } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    const { _id, ...rest } = doc.toObject();
    res.status(201).json({ id: _id.toString(), ...rest });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ error: 'כבר קיים אתגר לתאריך זה' });
    }
    console.error('POST /api/challenges/admin error:', err);
    res.status(500).json({ error: 'שמירת האתגר נכשלה' });
  }
}

/** DELETE /api/challenges/admin/:id */
export async function deleteChallengeAdmin(req, res) {
  try {
    await ensureDbConnection();
    if (!isDbConnected()) return res.status(503).json({ error: 'מסד הנתונים אינו זמין כעת' });
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'מזהה שגוי' });
    const deleted = await ChallengeQuestion.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ error: 'האתגר לא נמצא' });
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/challenges/admin/:id error:', err);
    res.status(500).json({ error: 'מחיקת האתגר נכשלה' });
  }
}
