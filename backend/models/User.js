import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true, index: true },
    trustScore: { type: Number, default: 50, min: 0, max: 100 },
    proactiveNudgesConsent: { type: Boolean, default: false },
    consentUpdatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.model('User', UserSchema);
