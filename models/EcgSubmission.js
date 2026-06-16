/**
 * EcgSubmission model — trainee ECG interpretations submitted for instructor review.
 * Hebrew: הגשת אקג לבדיקת מדריך
 */
import mongoose from 'mongoose';

const ecgSubmissionSchema = new mongoose.Schema(
  {
    /** Submitting trainee's user_id */
    user_id: { type: String, required: true, index: true },
    /** Display name captured at submission time (audit-friendly) */
    user_name: { type: String, default: '' },
    /** Cloudinary (or other) URL of the uploaded ECG image */
    image_url: { type: String, required: true },
    /** The trainee's own interpretation text (required) */
    user_interpretation: { type: String, required: true },
    /** Free-form tags chosen/created by the trainee */
    tags: { type: [String], default: [] },
    /** Review lifecycle */
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true,
    },
    /** Instructor's medical feedback */
    reviewer_notes: { type: String, default: '' },
    /** Reviewer attribution */
    reviewer_id: { type: String, default: null },
    reviewer_name: { type: String, default: null },
    reviewed_at: { type: Date, default: null },
  },
  { timestamps: true },
);

ecgSubmissionSchema.index({ status: 1, createdAt: -1 });
ecgSubmissionSchema.index({ user_id: 1, createdAt: -1 });

export default mongoose.model('EcgSubmission', ecgSubmissionSchema);
