/**
 * REST API for the national, per-user leaderboard.
 * Hebrew: טבלת מובילים ארצית — תחרות אישית מוחלטת לפי נקודות.
 */
import User from '../models/User.js';
import { isDbConnected, ensureDbConnection } from './db.js';

/**
 * GET /api/leaderboard
 * Top 50 users platform-wide, ranked by personal `points` (descending).
 * Returns only display fields: name, points, current_streak.
 */
export async function getLeaderboard(_req, res) {
  try {
    await ensureDbConnection();
    if (!isDbConnected()) return res.status(200).json([]);

    const top = await User.find({}, { full_name: 1, points: 1, current_streak: 1, user_id: 1 })
      .sort({ points: -1, current_streak: -1 })
      .limit(50)
      .lean();

    const ranked = top.map((u, i) => ({
      rank: i + 1,
      user_id: u.user_id,
      full_name: u.full_name || 'משתמש',
      points: u.points || 0,
      current_streak: u.current_streak || 0,
    }));

    res.set('Cache-Control', 'no-store');
    res.json(ranked);
  } catch (err) {
    console.error('GET /api/leaderboard error:', err);
    res.status(500).json({ error: 'טעינת טבלת המובילים נכשלה' });
  }
}
