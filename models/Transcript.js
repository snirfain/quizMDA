/**
 * Transcript model – lesson transcripts (e.g. from SRT files)
 * Used to match questions to source material and tag them
 * Hebrew: תמליל שיעור
 */

import mongoose from 'mongoose';

const transcriptSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    fullText: { type: String, required: true, default: '' },
    originalFilename: { type: String, default: null },
  },
  { timestamps: true }
);

transcriptSchema.index({ name: 1 });

export default mongoose.model('Transcript', transcriptSchema);
