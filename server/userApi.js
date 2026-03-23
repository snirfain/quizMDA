/**
 * REST API for users — central store in MongoDB so all devices see the same users.
 * GET /api/users — list all users
 * POST /api/users — create or update one user (upsert by user_id or email)
 */
import mongoose from 'mongoose';
import User from '../models/User.js';
import { isDbConnected, ensureDbConnection } from './db.js';

const VALID_ROLES = new Set(['trainee', 'instructor', 'admin']);
const VALID_AUTH = new Set(['local', 'google']);

function normalizeUserForDb(u) {
  return {
    user_id: String(u.user_id ?? '').trim() || null,
    full_name: String(u.full_name ?? '').trim() || null,
    email: u.email != null ? String(u.email).trim() : null,
    role: VALID_ROLES.has(u.role) ? u.role : 'trainee',
    auth_provider: VALID_AUTH.has(u.auth_provider) ? u.auth_provider : 'local',
    google_id: u.google_id != null ? String(u.google_id) : null,
    profile_picture: u.profile_picture != null ? String(u.profile_picture) : null,
    email_verified: Boolean(u.email_verified),
    points: Math.max(0, parseInt(u.points, 10) || 0),
    current_streak: Math.max(0, parseInt(u.current_streak, 10) || 0),
    longest_streak: Math.max(0, parseInt(u.longest_streak, 10) || 0),
    custom_permissions: Array.isArray(u.custom_permissions) ? u.custom_permissions : [],
  };
}

export async function getUsers(req, res) {
  try {
    await ensureDbConnection();
    if (!isDbConnected()) {
      return res.status(200).json([]);
    }
    const list = await User.find({}).sort({ createdAt: -1 }).lean();
    const withId = list.map((doc) => {
      const { _id, ...rest } = doc;
      return rest;
    });
    res.set('Cache-Control', 'no-store');
    res.json(withId);
  } catch (err) {
    console.error('GET /api/users error:', err);
    res.status(500).json({ error: err.message });
  }
}

/** POST /api/users — body: single user object. Upsert by user_id or email. */
export async function postUser(req, res) {
  try {
    await ensureDbConnection();
    if (!isDbConnected()) {
      return res.status(503).json({ error: 'Database not connected' });
    }
    const u = req.body;
    if (!u || (typeof u !== 'object')) {
      return res.status(400).json({ error: 'Body must be a user object' });
    }
    const data = normalizeUserForDb(u);
    if (!data.user_id && !data.email) {
      return res.status(400).json({ error: 'user_id or email required' });
    }
    if (!data.user_id) {
      data.user_id = (data.email || '').split('@')[0] || `user_${Date.now()}`;
    }
    const existing = data.email
      ? await User.findOne({ $or: [{ user_id: data.user_id }, { email: data.email }] }).lean()
      : await User.findOne({ user_id: data.user_id }).lean();
    let doc;
    if (existing) {
      doc = await User.findOneAndUpdate(
        { user_id: existing.user_id },
        { $set: data },
        { new: true, runValidators: true }
      ).lean();
    } else {
      doc = await User.create(data);
      doc = doc.toObject ? doc.toObject() : doc;
    }
    const { _id, ...rest } = doc;
    res.status(existing ? 200 : 201).json(rest);
  } catch (err) {
    console.error('POST /api/users error:', err);
    res.status(500).json({ error: err.message });
  }
}
