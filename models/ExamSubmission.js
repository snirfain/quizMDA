/**
 * Exam submission record — persists a student's submitted mock-exam attempt.
 * This is the sensitive write guarded client-side by secureSubmit().
 * Hebrew: הגשת מבחן
 */
import mongoose from 'mongoose';

const examSubmissionSchema = new mongoose.Schema(
  {
    user_id: { type: String, default: null, index: true },
    user_email: { type: String, default: null },
    score: { type: Number, default: 0 },
    total_questions: { type: Number, default: 0 },
    score_units: {
      scored: { type: Number, default: 0 },
      total: { type: Number, default: 0 },
    },
    question_ids: { type: [String], default: [] },
    /** Raw answers map keyed by question id. */
    answers: { type: mongoose.Schema.Types.Mixed, default: {} },
    time_spent_seconds: { type: Number, default: 0 },
    submitted_at: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

examSubmissionSchema.index({ createdAt: -1 });

export default mongoose.model('ExamSubmission', examSubmissionSchema);
