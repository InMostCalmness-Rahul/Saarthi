import mongoose from 'mongoose';

const MessageSchema = new mongoose.Schema(
  {
    messageId: { type: String, required: true, unique: true, index: true },
    sessionId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    sender: { type: String, enum: ['user', 'bot'], required: true },
    content: { type: String, required: true },
    emotional_validation: { type: String, default: null },
    reconnection_nudge: { type: String, default: null },
    tiny_action: { type: String, default: null },
    followup_question: { type: String, default: null },
    risk_flags: { type: [String], default: [] },
    sentAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

MessageSchema.index({ userId: 1, createdAt: -1 });
MessageSchema.index({ sessionId: 1, createdAt: 1 });

export default mongoose.model('Message', MessageSchema);
