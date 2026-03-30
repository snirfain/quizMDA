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

const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});
const Counter = mongoose.models.Counter || mongoose.model('Counter', counterSchema);

const questionSchema = new mongoose.Schema(
  {
    serial_number: { type: Number, unique: true, sparse: true },
    /** String (e.g. from mock) or ObjectId */
    hierarchy_id: { type: mongoose.Schema.Types.Mixed, required: true },
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
      enum: ['active', 'draft', 'suspended', 'pending_review', 'rejected', 'needs_revision'],
      default: 'active'
    },
    total_attempts: { type: Number, default: 0 },
    total_success: { type: Number, default: 0 },
    success_rate: { type: Number, default: 0 }
  },
  { timestamps: true }
);

questionSchema.pre('save', async function (next) {
  if (this.serial_number == null) {
    const counter = await Counter.findByIdAndUpdate(
      'question_serial',
      { $inc: { seq: 1 } },
      { upsert: true, new: true }
    );
    this.serial_number = counter.seq;
  }
  next();
});

questionSchema.index({ serial_number: 1 });
questionSchema.index({ hierarchy_id: 1 });
questionSchema.index({ question_type: 1 });
questionSchema.index({ status: 1 });
questionSchema.index({ difficulty_level: 1 });
questionSchema.index({ tags: 1 });
questionSchema.index({ createdAt: -1 });
questionSchema.index({ question_text: 'text' });

const Question = mongoose.model('Question', questionSchema);

/**
 * Allocate `count` sequential serial numbers atomically.
 * Returns the first serial in the range (inclusive). The range is [first, first+count-1].
 */
export async function allocateSerials(count) {
  const counter = await Counter.findByIdAndUpdate(
    'question_serial',
    { $inc: { seq: count } },
    { upsert: true, new: true }
  );
  return counter.seq - count + 1;
}

export default Question;
