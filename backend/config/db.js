import mongoose from 'mongoose';
import { getMongoUri } from './env.js';
import { logger } from '../utils/logger.js';

export async function connectDB() {
  const mongoUri = getMongoUri();

  if (!mongoUri) {
    throw new Error('MONGODB_URI is not set in environment variables');
  }

  try {
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
    });
    logger.info('MongoDB connected successfully');
  } catch (error) {
    // Logged through the redacting logger so connection strings cannot leak.
    logger.error('MongoDB connection failed', error);
    throw error;
  }
}

