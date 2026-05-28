import mongoose from 'mongoose';

const protocolChunkSchema = new mongoose.Schema(
  {
    source_doc: { type: String, required: true },
    chapter: { type: String, default: '' },
    protocol_name: { type: String, default: '' },
    drug_name: { type: String, default: '' },
    aliases: { type: [String], default: [] },
    chunk_text: { type: String, required: true },
    chunk_tokens_est: { type: Number, default: 0 },
    version: { type: String, required: true, default: 'ALS-2024-04' },
    effective_date: { type: Date, default: null },
    priority: { type: Number, default: 1 },
    is_active_version: { type: Boolean, default: false },
    chunk_index: { type: Number, default: 0 },
    source_page_start: { type: Number, default: null },
    source_page_end: { type: Number, default: null },
  },
  { timestamps: true }
);

protocolChunkSchema.index({ version: 1, chunk_index: 1 }, { unique: true });
protocolChunkSchema.index({ version: 1, is_active_version: 1 });
protocolChunkSchema.index({ drug_name: 1 });
protocolChunkSchema.index({ protocol_name: 1 });
protocolChunkSchema.index({ chapter: 1 });
protocolChunkSchema.index({ aliases: 1 });
protocolChunkSchema.index({ chunk_text: 'text' });

export default mongoose.model('ProtocolChunk', protocolChunkSchema);
