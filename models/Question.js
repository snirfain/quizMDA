/**
 * Question model – aligns with entities/Question_Bank.js
 * Supports media via Cloudinary URL in media_attachment.
 * Hebrew: בנק שאלות
 */
import mongoose from 'mongoose';

const optionSchema = new mongoose.Schema(
  {
    value: { type: String, required: true },
    label: { type: String, required: true }
  },
  { _id: false }
);

const questionSchema = new mongoose.Schema(
  {
    hierarchy_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Content_Hierarchy', required: true },
    question_type: {
      type: String,
      enum: ['single_choice', 'multi_choice', 'true_false', 'open_ended', 'ordering'],
      default: 'single_choice'
    },
    question_text: { type: String, required: true },
    /** Answer options: [{ value, label }] for single/multi choice, true_false, ordering */
    options: { type: [optionSchema], default: [] },
    /** Cloudinary (or other) media URL – image / video / audio */
    media_attachment: { type: String, default: null },
    media_bank_tag: { type: String, default: null },
    difficulty_level: { type: Number, required: false, min: 1, max: 10, default: null },
    /** JSON: { value: "0" } | { values: ["0","1"] } | { value: "true"|"false" } */
    correct_answer: { type: mongoose.Schema.Types.Mixed, default: null },
    explanation: { type: String, default: null },
    hint: { type: String, default: null },
    tags: [{ type: String }],
    adaptive_difficulty: { type: Number, min: 1, max: 10, default: null },
    status: {
      type: String,
      enum: ['active', 'draft', 'suspended'],
      default: 'active'
    },
    total_attempts: { type: Number, default: 0 },
    total_success: { type: Number, default: 0 },
    success_rate: { type: Number, default: 0 }
  },
  { timestamps: true }
);

questionSchema.index({ hierarchy_id: 1 });
questionSchema.index({ question_type: 1 });
questionSchema.index({ status: 1 });
questionSchema.index({ difficulty_level: 1 });
questionSchema.index({ tags: 1 });

export default mongoose.model('Question', questionSchema);
