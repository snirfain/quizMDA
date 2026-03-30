import mongoose from 'mongoose';

const contactMessageSchema = new mongoose.Schema(
  {
    full_name: { type: String, required: true },
    email: { type: String, required: true },
    message: { type: String, required: true },
    user_id: { type: String, default: null },
    email_sent: { type: Boolean, default: false },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model('ContactMessage', contactMessageSchema);
