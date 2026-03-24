import mongoose from 'mongoose';

const ActionCommitmentSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    sessionId: { type: String, default: null, index: true },
    actionCommitment: { type: String, required: true },
    trustScoreDelta: { type: Number, required: true },
    committedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

ActionCommitmentSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model('ActionCommitment', ActionCommitmentSchema);
