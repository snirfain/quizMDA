/**
 * BookContent model — full emergency-medicine textbook stored as searchable chunks.
 * Hebrew: מאגר תוכן ספר רפואת החירום
 *
 * The book backs two capabilities:
 *   1. A knowledge base to verify whether a question's content appears in the book.
 *   2. A grounding source for cataloging/tagging questions by chapter (category)
 *      and sub-topic (sub_category), reusing the existing taxonomy.
 *
 * Text is split into overlapping chunks (~700–1200 est. tokens). Each chunk is
 * tagged with the chapter it belongs to (matching a Question_Bank `category`).
 */
import mongoose from 'mongoose';

const bookContentSchema = new mongoose.Schema(
  {
    /** Chapter — matches a Question_Bank `category` value (one of the 28 book chapters). */
    category: { type: String, required: true, default: '' },
    /** Optional sub-topic label the chunk belongs to (matches sub_category when known). */
    sub_topic: { type: String, default: '' },
    /** Free-form source label (e.g. file name or edition). */
    source_doc: { type: String, default: 'ספר רפואת חירום' },
    chunk_text: { type: String, required: true },
    chunk_tokens_est: { type: Number, default: 0 },
    char_count: { type: Number, default: 0 },
    chunk_index: { type: Number, default: 0 },
  },
  { timestamps: true }
);

bookContentSchema.index({ category: 1, chunk_index: 1 });
bookContentSchema.index({ sub_topic: 1 });
bookContentSchema.index({ chunk_text: 'text' });

export default mongoose.model('BookContent', bookContentSchema);
