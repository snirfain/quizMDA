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
      enum: ['admin', 'manager', 'school_staff', 'instructor', 'trainee'],
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
    /** MDA course number — required on first login */
    course_number: { type: String, default: null },
    /** Additional course numbers the user is enrolled in */
    additional_courses: { type: [String], default: [] },
    /** For instructors: list of course numbers they teach */
    instructor_courses: { type: [String], default: [] },
    /** True after user has completed first-login setup (course number) */
    setup_complete: { type: Boolean, default: false },
    points: { type: Number, default: 0, min: 0 },
    current_streak: { type: Number, default: 0, min: 0 },
    longest_streak: { type: Number, default: 0, min: 0 },
    custom_permissions: { type: [String], default: [] },
    /** GDPR / TOS consent (Feature 5) */
    tos_accepted: { type: Boolean, default: false },
    cookies_accepted: { type: Boolean, default: false },
    consent_at: { type: Date, default: null },
    /** Whether the user opted in to browser push notifications */
    notifications_opt_in: { type: Boolean, default: false }
  },
  { timestamps: true }
);

userSchema.index({ user_id: 1 });
userSchema.index({ email: 1 });
userSchema.index({ google_id: 1 });
userSchema.index({ role: 1 });
userSchema.index({ course_number: 1 });
userSchema.index({ instructor_courses: 1 });

export default mongoose.model('User', userSchema);
