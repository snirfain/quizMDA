/**
 * REST API for question reports — users flag problems, admins review.
 */
import mongoose from 'mongoose';
import QuestionReport from '../models/QuestionReport.js';
import Question from '../models/Question.js';
import { isDbConnected, ensureDbConnection } from './db.js';

/** POST /api/reports — create a new report */
export async function createReport(req, res) {
  try {
    await ensureDbConnection();
    if (!isDbConnected()) return res.status(503).json({ error: 'Database not connected' });

    const { question_id, reporter_id, reporter_name, original, suggested, description } = req.body || {};
    if (!question_id || !reporter_id) {
      return res.status(400).json({ error: 'question_id and reporter_id required' });
    }
    if (!suggested || typeof suggested !== 'object' || Object.keys(suggested).length === 0) {
      return res.status(400).json({ error: 'suggested changes required' });
    }

    let qSerial = null;
    try {
      const q = await Question.findById(question_id).select('serial_number').lean();
      if (q) qSerial = q.serial_number;
    } catch (_) {}

    const doc = await QuestionReport.create({
      question_id,
      question_serial: qSerial,
      reporter_id,
      reporter_name: reporter_name || '',
      original: original || {},
      suggested,
      description: description || '',
    });

    res.status(201).json({ id: doc._id.toString(), status: doc.status });
  } catch (err) {
    console.error('POST /api/reports error:', err);
    res.status(500).json({ error: err.message });
  }
}

/** GET /api/reports — list reports (optionally filter by status) */
export async function listReports(req, res) {
  try {
    await ensureDbConnection();
    if (!isDbConnected()) return res.status(200).json([]);

    const { status } = req.query;
    const filter = status ? { status } : {};
    const list = await QuestionReport.find(filter).sort({ createdAt: -1 }).lean();
    res.json(list.map(({ _id, ...rest }) => ({ id: _id.toString(), ...rest })));
  } catch (err) {
    console.error('GET /api/reports error:', err);
    res.status(500).json({ error: err.message });
  }
}

/** GET /api/reports/count — count pending reports */
export async function countPendingReports(req, res) {
  try {
    await ensureDbConnection();
    if (!isDbConnected()) return res.json({ pending: 0 });
    const pending = await QuestionReport.countDocuments({ status: 'pending' });
    res.json({ pending });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/** PUT /api/reports/:id/review — approve/reject/partial with optional edits */
export async function reviewReport(req, res) {
  try {
    await ensureDbConnection();
    if (!isDbConnected()) return res.status(503).json({ error: 'Database not connected' });

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid report id' });

    const { status, reviewer_id, reviewer_name, review_note, apply_changes } = req.body || {};
    if (!['approved', 'rejected', 'partial'].includes(status)) {
      return res.status(400).json({ error: 'status must be approved/rejected/partial' });
    }

    const report = await QuestionReport.findById(id);
    if (!report) return res.status(404).json({ error: 'Report not found' });

    // Apply changes to the actual question if approved or partial
    if ((status === 'approved' || status === 'partial') && report.question_id) {
      const changes = apply_changes || report.suggested;
      const safeFields = {};
      const ALLOWED = ['question_text', 'options', 'correct_answer', 'explanation', 'hint', 'hierarchy_id', 'question_type'];
      for (const key of ALLOWED) {
        if (changes[key] !== undefined) safeFields[key] = changes[key];
      }
      if (Object.keys(safeFields).length > 0) {
        await Question.findByIdAndUpdate(report.question_id, { $set: safeFields });
      }
    }

    report.status = status;
    report.reviewer_id = reviewer_id || null;
    report.reviewer_name = reviewer_name || null;
    report.review_note = review_note || '';
    report.reviewed_at = new Date();
    await report.save();

    const { _id, ...rest } = report.toObject();
    res.json({ id: _id.toString(), ...rest });
  } catch (err) {
    console.error('PUT /api/reports/:id/review error:', err);
    res.status(500).json({ error: err.message });
  }
}
