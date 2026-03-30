/**
 * QuestionReport model — user-submitted corrections/suggestions for questions.
 * Hebrew: דיווחי שאלות
 */
import mongoose from 'mongoose';

const questionReportSchema = new mongoose.Schema(
  {
    question_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Question', required: true },
    question_serial: { type: Number, default: null },
    reporter_id: { type: String, required: true },
    reporter_name: { type: String, default: '' },
    /** Snapshot of original question at time of report */
    original: { type: mongoose.Schema.Types.Mixed, required: true },
    /** User's suggested changes (only the changed fields) */
    suggested: { type: mongoose.Schema.Types.Mixed, required: true },
    /** Free-text description of the problem */
    description: { type: String, default: '' },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'partial'],
      default: 'pending',
    },
    /** Admin who reviewed */
    reviewer_id: { type: String, default: null },
    reviewer_name: { type: String, default: null },
    review_note: { type: String, default: '' },
    reviewed_at: { type: Date, default: null },
  },
  { timestamps: true }
);

questionReportSchema.index({ status: 1 });
questionReportSchema.index({ question_id: 1 });
questionReportSchema.index({ reporter_id: 1 });

export default mongoose.model('QuestionReport', questionReportSchema);
