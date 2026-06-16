/**
 * ScheduledPush model — admin-scheduled web-push broadcasts.
 * A lightweight cron loop in server/pushApi.js sends any due, unsent push.
 * Hebrew: התראות פוש מתוזמנות
 */
import mongoose from 'mongoose';

const scheduledPushSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    body: { type: String, required: true },
    /** Optional deep link opened when the notification is clicked */
    url: { type: String, default: '/' },
    /** When to send (UTC Date) */
    send_at: { type: Date, required: true, index: true },
    status: {
      type: String,
      enum: ['scheduled', 'sent', 'failed', 'cancelled'],
      default: 'scheduled',
      index: true,
    },
    /** Send results (audit) */
    sent_at: { type: Date, default: null },
    sent_count: { type: Number, default: 0 },
    failed_count: { type: Number, default: 0 },
    error: { type: String, default: '' },
    created_by: { type: String, default: null },
    created_by_name: { type: String, default: null },
  },
  { timestamps: true },
);

scheduledPushSchema.index({ status: 1, send_at: 1 });

export default mongoose.model('ScheduledPush', scheduledPushSchema);
