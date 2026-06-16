/**
 * ChallengeQuestion model — a dedicated bank for daily challenges, authored by
 * the management team. These questions are SEPARATE from the regular Question
 * bank and never appear in normal practice/exams.
 * Hebrew: מאגר שאלות ייעודי לאתגרים היומיים
 */
import mongoose from 'mongoose';

const challengeQuestionSchema = new mongoose.Schema(
  {
    /** The calendar day this challenge is scheduled for — 'YYYY-MM-DD' (Asia/Jerusalem). */
    challenge_date: { type: String, required: true, unique: true, index: true },
    question_text: { type: String, required: true },
    /** [{ value: '0', label: '...' }, ...] */
    options: { type: Array, default: [] },
    /** The winning option value (string) */
    correct_answer: { type: String, required: true },
    explanation: { type: String, default: '' },
    category: { type: String, default: '' },
    /** Optional media URL for image-based challenges */
    media_url: { type: String, default: null },
    /** Who authored it (audit) */
    author_id: { type: String, default: null },
    author_name: { type: String, default: null },
    /** Allow temporarily disabling a challenge without deleting it */
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

challengeQuestionSchema.index({ challenge_date: -1 });

export default mongoose.model('ChallengeQuestion', challengeQuestionSchema);
