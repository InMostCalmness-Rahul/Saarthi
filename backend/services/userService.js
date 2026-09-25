import User from '../models/User.js';
import { TRUST_SCORE_DEFAULT } from '../config/constants.js';

export function defaultUserFields(userId) {
  return {
    userId,
    trustScore: TRUST_SCORE_DEFAULT,
    proactiveNudgesConsent: false,
    consentUpdatedAt: new Date(),
  };
}

export async function findUser(userId) {
  return User.findOne({ userId });
}

export async function getOrCreateUser(userId) {
  const existing = await User.findOne({ userId });
  if (existing) {
    return existing;
  }

  try {
    return await User.create(defaultUserFields(userId));
  } catch (error) {
    // Concurrent first request for the same user: the unique index wins and we
    // simply read the record the other request created.
    if (error?.code === 11000) {
      return User.findOne({ userId });
    }
    throw error;
  }
}

export async function setProactiveNudgesConsent(userId, proactiveNudgesConsent) {
  return User.findOneAndUpdate(
    { userId },
    { $set: { proactiveNudgesConsent, consentUpdatedAt: new Date() } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}
