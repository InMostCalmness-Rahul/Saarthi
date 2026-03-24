import mongoose from 'mongoose';

const SessionSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    startedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

SessionSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model('Session', SessionSchema);
