/**
 * REST API for questions — sync to MongoDB so all devices see the same data.
 * GET /api/questions — list all questions
 * POST /api/questions — create one or more questions (body: object or array)
 */
import mongoose from 'mongoose';
import Question from '../models/Question.js';

function isDbConnected() {
  return mongoose.connection.readyState === 1;
}

export async function getQuestions(req, res) {
  try {
    if (!isDbConnected()) {
      return res.status(200).json([]);
    }
    const list = await Question.find({}).sort({ createdAt: -1 }).lean();
    const withId = list.map((doc) => {
      const { _id, ...rest } = doc;
      return { id: _id.toString(), ...rest };
    });
    res.json(withId);
  } catch (err) {
    console.error('GET /api/questions error:', err);
    res.status(500).json({ error: err.message });
  }
}

export async function postQuestions(req, res) {
  try {
    if (!isDbConnected()) {
      return res.status(503).json({ error: 'Database not connected' });
    }
    const body = req.body;
    const items = Array.isArray(body) ? body : [body];
    const created = [];
    for (const q of items) {
      const { id: _skip, ...data } = q;
      const doc = await Question.create({
        ...data,
        hierarchy_id: data.hierarchy_id ?? null,
        status: data.status || 'active',
        total_attempts: data.total_attempts ?? 0,
        total_success: data.total_success ?? 0,
        success_rate: data.success_rate ?? 0,
      });
      created.push({ id: doc._id.toString(), ...doc.toObject() });
    }
    res.status(201).json(Array.isArray(body) ? created : created[0]);
  } catch (err) {
    console.error('POST /api/questions error:', err);
    res.status(500).json({ error: err.message });
  }
}
