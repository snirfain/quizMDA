/**
 * REST API for users — central store in MongoDB so all devices see the same users.
 * GET /api/users — list all users
 * POST /api/users — create or update one user (upsert by user_id or email)
 * POST /api/users/setup — first-login: set course_number
 * PUT /api/users/:userId/role — change user role (manager+ only)
 * PUT /api/users/:userId/courses — instructor: set course numbers
 * GET /api/users/by-course/:courseNumber — get trainees for a course
 */
import mongoose from 'mongoose';
import User from '../models/User.js';
import { getActor } from './authMiddleware.js';
import { isDbConnected, ensureDbConnection } from './db.js';

/** Points granted for a single correct practice answer (must match client). */
const MAX_ABS_POINTS_DELTA = 50;

const VALID_ROLES = new Set(['admin', 'manager', 'school_staff', 'instructor', 'trainee']);
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
    course_number: u.course_number != null ? String(u.course_number).trim() : null,
    additional_courses: Array.isArray(u.additional_courses) ? u.additional_courses.map(c => String(c).trim()).filter(Boolean) : [],
    instructor_courses: Array.isArray(u.instructor_courses) ? u.instructor_courses.map(c => String(c).trim()).filter(Boolean) : [],
    setup_complete: Boolean(u.setup_complete),
    points: Math.max(0, Math.round((parseFloat(u.points) || 0) * 10) / 10),
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
      // Preserve fields that should not be overwritten by a client sync
      if (existing.course_number && !data.course_number) data.course_number = existing.course_number;
      if (existing.additional_courses?.length && !data.additional_courses?.length) data.additional_courses = existing.additional_courses;
      if (existing.instructor_courses?.length && !data.instructor_courses?.length) data.instructor_courses = existing.instructor_courses;
      if (existing.setup_complete && !data.setup_complete) data.setup_complete = existing.setup_complete;
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

/** POST /api/users/setup — first-login: set course_number + mark setup_complete */
export async function setupUser(req, res) {
  try {
    await ensureDbConnection();
    if (!isDbConnected()) return res.status(503).json({ error: 'Database not connected' });
    const { user_id, course_number } = req.body || {};
    if (!user_id) return res.status(400).json({ error: 'user_id required' });
    if (!course_number || !String(course_number).trim()) return res.status(400).json({ error: 'course_number required' });
    const doc = await User.findOneAndUpdate(
      { user_id },
      { $set: { course_number: String(course_number).trim(), setup_complete: true } },
      { new: true }
    ).lean();
    if (!doc) return res.status(404).json({ error: 'User not found' });
    const { _id, ...rest } = doc;
    res.json(rest);
  } catch (err) {
    console.error('POST /api/users/setup error:', err);
    res.status(500).json({ error: err.message });
  }
}

/** PUT /api/users/:userId/course-numbers — update course_number + additional_courses */
export async function updateCourseNumbers(req, res) {
  try {
    await ensureDbConnection();
    if (!isDbConnected()) return res.status(503).json({ error: 'Database not connected' });
    const { userId } = req.params;
    const { course_number, additional_courses } = req.body || {};
    const updates = {};
    if (course_number !== undefined) {
      const val = String(course_number).replace(/\D/g, '');
      if (val.length < 6 || val.length > 7) return res.status(400).json({ error: 'course_number must be 6-7 digits' });
      updates.course_number = val;
    }
    if (additional_courses !== undefined) {
      if (!Array.isArray(additional_courses)) return res.status(400).json({ error: 'additional_courses must be an array' });
      updates.additional_courses = additional_courses.map(c => String(c).replace(/\D/g, '')).filter(c => c.length >= 6 && c.length <= 7);
    }
    if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'Nothing to update' });
    const doc = await User.findOneAndUpdate({ user_id: userId }, { $set: updates }, { new: true }).lean();
    if (!doc) return res.status(404).json({ error: 'User not found' });
    const { _id, ...rest } = doc;
    res.json(rest);
  } catch (err) {
    console.error('PUT /api/users/:userId/course-numbers error:', err);
    res.status(500).json({ error: err.message });
  }
}

/** PUT /api/users/:userId/role — change user role */
export async function changeUserRole(req, res) {
  try {
    await ensureDbConnection();
    if (!isDbConnected()) return res.status(503).json({ error: 'Database not connected' });
    const { userId } = req.params;
    const { role } = req.body || {};
    if (!VALID_ROLES.has(role)) return res.status(400).json({ error: 'Invalid role' });
    const doc = await User.findOneAndUpdate({ user_id: userId }, { $set: { role } }, { new: true }).lean();
    if (!doc) return res.status(404).json({ error: 'User not found' });
    const { _id, ...rest } = doc;
    res.json(rest);
  } catch (err) {
    console.error('PUT /api/users/:userId/role error:', err);
    res.status(500).json({ error: err.message });
  }
}

/** PUT /api/users/:userId/courses — set instructor_courses */
export async function setInstructorCourses(req, res) {
  try {
    await ensureDbConnection();
    if (!isDbConnected()) return res.status(503).json({ error: 'Database not connected' });
    const { userId } = req.params;
    const { courses } = req.body || {};
    if (!Array.isArray(courses)) return res.status(400).json({ error: 'courses must be an array' });
    const cleaned = courses.map(c => String(c).trim()).filter(Boolean);
    const doc = await User.findOneAndUpdate({ user_id: userId }, { $set: { instructor_courses: cleaned } }, { new: true }).lean();
    if (!doc) return res.status(404).json({ error: 'User not found' });
    const { _id, ...rest } = doc;
    res.json(rest);
  } catch (err) {
    console.error('PUT /api/users/:userId/courses error:', err);
    res.status(500).json({ error: err.message });
  }
}

/**
 * POST /api/users/me/points
 * Atomically increment the signed-in user's points (leaderboard source of truth).
 * Body: { delta: number }
 */
export async function awardUserPoints(req, res) {
  try {
    await ensureDbConnection();
    if (!isDbConnected()) return res.status(503).json({ error: 'Database not connected' });

    const actor = getActor(req);
    if (!actor.user_id) return res.status(401).json({ error: 'לא מזוהה' });

    const delta = Number(req.body?.delta);
    if (!Number.isFinite(delta) || delta === 0 || Math.abs(delta) > MAX_ABS_POINTS_DELTA) {
      return res.status(400).json({ error: `delta חייב להיות בין -${MAX_ABS_POINTS_DELTA} ל-${MAX_ABS_POINTS_DELTA} (לא אפס)` });
    }

    const doc = await User.findOneAndUpdate(
      { user_id: actor.user_id },
      [{ $set: { points: { $max: [0, { $round: [{ $add: ['$points', delta] }, 1] }] } } }],
      { new: true },
    ).lean();

    if (!doc) return res.status(404).json({ error: 'User not found' });

    const { _id, ...rest } = doc;
    res.set('Cache-Control', 'no-store');
    res.json({ user_id: rest.user_id, points: rest.points || 0 });
  } catch (err) {
    console.error('POST /api/users/me/points error:', err);
    res.status(500).json({ error: err.message });
  }
}

/** GET /api/users/by-course/:courseNumber — get all trainees in a course */
export async function getUsersByCourse(req, res) {
  try {
    await ensureDbConnection();
    if (!isDbConnected()) return res.status(200).json([]);
    const { courseNumber } = req.params;
    const list = await User.find({ course_number: courseNumber }).sort({ full_name: 1 }).lean();
    res.json(list.map(({ _id, ...rest }) => rest));
  } catch (err) {
    console.error('GET /api/users/by-course error:', err);
    res.status(500).json({ error: err.message });
  }
}
