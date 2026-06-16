/**
 * PushSubscription model — a browser's Web Push subscription, stored ONLY when
 * the user has actively opted in to notifications in app settings.
 * Hebrew: מנוי התראות דפדפן (נשמר רק לאחר אישור אקטיבי)
 */
import mongoose from 'mongoose';

const pushSubscriptionSchema = new mongoose.Schema(
  {
    /** The subscription endpoint is globally unique per browser/device */
    endpoint: { type: String, required: true, unique: true },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true },
    },
    user_id: { type: String, default: null, index: true },
    user_email: { type: String, default: null },
    /** Explicit opt-in flag — never send without this being true */
    opted_in: { type: Boolean, default: true },
    user_agent: { type: String, default: '' },
  },
  { timestamps: true },
);

export default mongoose.model('PushSubscription', pushSubscriptionSchema);
