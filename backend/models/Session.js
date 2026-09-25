import mongoose from 'mongoose';

const SessionSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    startedAt: { type: Date, default: Date.now },
    // Maintained with $inc so chat turns no longer need a countDocuments aggregation.
    // Sessions created before this field existed start from 0.
    messageCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

SessionSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model('Session', SessionSchema);
