import mongoose from 'mongoose';

const ActionCommitmentSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    sessionId: { type: String, default: null, index: true },
    actionCommitment: { type: String, required: true },
    // Server-derived delta (see utils/trustScore.js). Never accepted from a client.
    trustScoreDelta: { type: Number, required: true },
    completed: { type: Boolean, default: false },
    committedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

ActionCommitmentSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model('ActionCommitment', ActionCommitmentSchema);
