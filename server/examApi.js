/**
 * Exam API — persists submitted mock-exam attempts.
 * Hebrew: API מבחנים
 */
import ExamSubmission from '../models/ExamSubmission.js';
import { getActor } from './authMiddleware.js';
import { isDbConnected, ensureDbConnection } from './db.js';

/**
 * POST /api/exam/submit
 * Body: { user_id?, score, totalQuestions, scoreUnits, questionIds, answers, timeSpent, submittedAt }
 * Returns: { ok: true, id }
 */
export async function submitExam(req, res) {
  try {
    await ensureDbConnection();
    if (!isDbConnected()) {
      return res.status(503).json({ error: 'מסד הנתונים אינו מחובר' });
    }
    const body = req.body || {};
    const actor = getActor(req);

    const doc = await ExamSubmission.create({
      user_id: body.user_id || actor.user_id || null,
      user_email: actor.email || null,
      score: Number(body.score) || 0,
      total_questions: Number(body.totalQuestions) || 0,
      score_units: {
        scored: Number(body.scoreUnits?.scored) || 0,
        total: Number(body.scoreUnits?.total) || 0,
      },
      question_ids: Array.isArray(body.questionIds) ? body.questionIds.map(String) : [],
      answers: body.answers && typeof body.answers === 'object' ? body.answers : {},
      time_spent_seconds: Number(body.timeSpent) || 0,
      submitted_at: body.submittedAt ? new Date(body.submittedAt) : new Date(),
    });

    res.status(201).json({ ok: true, id: doc._id.toString() });
  } catch (err) {
    console.error('POST /api/exam/submit error:', err);
    res.status(500).json({ error: err.message || 'שמירת המבחן נכשלה' });
  }
}
