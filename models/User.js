/**
 * User model – aligns with entities/Users.js
 * Hebrew: משתמשים
 */
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    user_id: { type: String, required: true, unique: true },
    full_name: { type: String, required: true },
    email: { type: String, default: null },
    role: {
      type: String,
      enum: ['trainee', 'instructor', 'admin'],
      default: 'trainee'
    },
    auth_provider: {
      type: String,
      enum: ['local', 'google'],
      default: 'local'
    },
    google_id: { type: String, default: null, sparse: true },
    profile_picture: { type: String, default: null },
    email_verified: { type: Boolean, default: false },
    points: { type: Number, default: 0, min: 0 },
    current_streak: { type: Number, default: 0, min: 0 },
    longest_streak: { type: Number, default: 0, min: 0 },
    custom_permissions: { type: [String], default: [] }
  },
  { timestamps: true }
);

userSchema.index({ user_id: 1 });
userSchema.index({ email: 1 });
userSchema.index({ google_id: 1 });
userSchema.index({ role: 1 });

export default mongoose.model('User', userSchema);
