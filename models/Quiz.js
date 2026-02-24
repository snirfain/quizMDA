/**
 * Quiz / Test model – saved sets of questions with metadata.
 * Hebrew: מבחן / חידון
 */
import mongoose from 'mongoose';

const quizSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, default: '' },
    /** Ordered list of question IDs */
    question_ids: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Question' }],
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    time_limit_minutes: { type: Number, default: null },
    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'draft'
    }
  },
  { timestamps: true }
);

quizSchema.index({ created_by: 1 });
quizSchema.index({ status: 1 });

export default mongoose.model('Quiz', quizSchema);
