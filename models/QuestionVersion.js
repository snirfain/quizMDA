/**
 * Question version history — an immutable snapshot of a question taken BEFORE
 * each update, so changes are fully auditable and reversible.
 * Aligns with the client entity entities/Question_Versions.js field names.
 * Hebrew: היסטוריית גרסאות שאלה
 */
import mongoose from 'mongoose';

const questionVersionSchema = new mongoose.Schema(
  {
    /** The original question's _id (as string) this snapshot belongs to. */
    question_id: { type: String, required: true, index: true },
    /** Monotonically increasing version number per question. */
    version_number: { type: Number, required: true },
    /** Full snapshot of the question's data BEFORE the change. */
    question_data: { type: mongoose.Schema.Types.Mixed, required: true },
    /** Which fields changed in this update (best-effort). */
    changed_fields: { type: [String], default: [] },
    /** Who performed the change. */
    changed_by: {
      user_id: { type: String, default: null },
      email: { type: String, default: null },
      name: { type: String, default: null },
      role: { type: String, default: null },
    },
    /** When the change happened. */
    changed_at: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

questionVersionSchema.index({ question_id: 1, version_number: -1 });

export default mongoose.model('QuestionVersion', questionVersionSchema);
