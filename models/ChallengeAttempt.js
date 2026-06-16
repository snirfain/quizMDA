/**
 * ChallengeAttempt model — records each user's solve of a daily challenge to
 * prevent double-scoring and to power the archive "already solved" state.
 * Hebrew: מעקב פתרונות אתגרים (מניעת פתרון כפול)
 */
import mongoose from 'mongoose';

const challengeAttemptSchema = new mongoose.Schema(
  {
    user_id: { type: String, required: true, index: true },
    /** 'YYYY-MM-DD' of the challenge that was solved */
    challenge_date: { type: String, required: true, index: true },
    challenge_id: { type: String, default: null },
    is_correct: { type: Boolean, default: false },
    /** Points actually awarded (2 for today, 1.5 for archive) */
    points_awarded: { type: Number, default: 0 },
    /** Whether the challenge was solved on its own day or from the archive */
    solved_from: { type: String, enum: ['today', 'archive'], default: 'today' },
  },
  { timestamps: true },
);

// One attempt per user per challenge day.
challengeAttemptSchema.index({ user_id: 1, challenge_date: 1 }, { unique: true });

export default mongoose.model('ChallengeAttempt', challengeAttemptSchema);
