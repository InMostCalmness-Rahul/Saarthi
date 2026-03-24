import mongoose from 'mongoose';

const TrustHistorySchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    sessionId: { type: String, default: null, index: true },
    previousScore: { type: Number, required: true },
    delta: { type: Number, required: true },
    newScore: { type: Number, required: true },
    reason: { type: String, required: true },
    recordedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

TrustHistorySchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model('TrustHistory', TrustHistorySchema);
