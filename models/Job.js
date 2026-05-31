/**
 * Async job model — persists the lifecycle of long-running background tasks
 * (transcript spelling correction, AI question generation) so that status
 * survives server restarts and is never silently lost.
 *
 * Canonical statuses: pending → processing → completed | failed
 * Hebrew: ג'ובים אסינכרוניים
 */
import mongoose from 'mongoose';

const jobSchema = new mongoose.Schema(
  {
    /** Client-facing identifier (UUID). */
    job_id: { type: String, required: true, unique: true, index: true },
    /** Job category. */
    type: {
      type: String,
      enum: ['fix-spelling', 'generate-questions'],
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
      index: true,
    },
    /** Arbitrary input parameters for the worker. */
    params: { type: mongoose.Schema.Types.Mixed, default: {} },
    /** Progress counters for UIs that show a bar. */
    progress: {
      done: { type: Number, default: 0 },
      total: { type: Number, default: 0 },
    },
    /** Result payload on success. */
    result: { type: mongoose.Schema.Types.Mixed, default: null },
    /** Hebrew error message on failure. */
    error: { type: String, default: null },
    /** When the worker actually started/finished. */
    startedAt: { type: Date, default: null },
    finishedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

jobSchema.index({ type: 1, status: 1 });
jobSchema.index({ createdAt: -1 });

export default mongoose.model('Job', jobSchema);
