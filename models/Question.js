/**
 * Question model – aligns with entities/Question_Bank.js
 * Supports media via Cloudinary URL or { url } in media_attachment,
 * or random item from Media_Bank via media_bank_tag.
 * Hebrew: בנק שאלות
 */
import mongoose from 'mongoose';
import { computeQuestionHasMedia } from '../shared/questionBankMetadata.js';

const optionSchema = new mongoose.Schema(
  {
    value: { type: String, required: true },
    label: { type: String, required: true },
  },
  { _id: false }
);

const questionSchema = new mongoose.Schema(
  {
    question_type: {
      type: String,
      enum: ['single_choice', 'multi_choice', 'true_false', 'open_ended', 'rolling_case'],
      default: 'single_choice',
    },
    case_name: { type: String, default: '' },
    question_text: { type: String, required: true },
    options: { type: [optionSchema], default: [] },
    /** URL string or { url, type?, name? } from upload flow */
    media_attachment: { type: mongoose.Schema.Types.Mixed, default: null },
    /** תג מאגר מדיה — בשימוש עם pickRandomMedia; לא בשילוב עם media_attachment מלא */
    media_bank_tag: { type: String, default: null },
    /** JSON: { value: "0" } | { values: ["0","1"] } | { value: "true"|"false" } | string for open_ended */
    correct_answer: { type: mongoose.Schema.Types.Mixed, default: null },
    explanation: { type: String, default: null },
    hint: { type: String, default: null },
    category: { type: String, required: true },
    sub_category: { type: String, required: true },
    thinking_level: {
      type: String,
      enum: ['Knowledge', 'Understanding', 'Application', 'Synthesis'],
      required: true,
    },
    training_level: {
      type: String,
      enum: ['A', 'B', 'C', 'D', 'E'],
      required: true,
    },
    medical_levels: {
      type: [String],
      enum: ['ALS', 'BLS', 'CLS', 'DLS', 'ELS'],
      default: [],
    },
    rolling_case: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    suspended_due_to_branch: {
      type: String,
      default: '',
    },
    has_media: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ['active', 'under_review', 'draft'],
      default: 'draft',
    },
    total_attempts: { type: Number, default: 0 },
    total_success: { type: Number, default: 0 },
    success_rate: { type: Number, default: 0 },
  },
  { timestamps: true }
);

questionSchema.pre('save', function () {
  this.has_media = computeQuestionHasMedia({
    media_attachment: this.media_attachment,
    media_bank_tag: this.media_bank_tag,
  });
});

questionSchema.index({ category: 1 });
questionSchema.index({ sub_category: 1 });
questionSchema.index({ thinking_level: 1 });
questionSchema.index({ training_level: 1 });
questionSchema.index({ question_type: 1 });
questionSchema.index({ case_name: 1 });
questionSchema.index({ status: 1 });
questionSchema.index({ has_media: 1 });
questionSchema.index({ media_bank_tag: 1 });
questionSchema.index({ medical_levels: 1 });
questionSchema.index({ createdAt: -1 });
questionSchema.index({ question_text: 'text' });

const Question = mongoose.model('Question', questionSchema);

export default Question;
