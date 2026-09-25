import 'dotenv/config';
import mongoose from 'mongoose';
import { createApp } from './app.js';
import { connectDB } from './config/db.js';
import { assertServerEnv } from './config/env.js';
import { logger } from './utils/logger.js';

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    // Fail fast on missing/insecure configuration instead of serving traffic.
    assertServerEnv();
  } catch (error) {
    logger.error('Invalid server configuration', error);
    process.exit(1);
  }

  try {
    await connectDB();
  } catch (error) {
    logger.error('Failed to connect to MongoDB', error);
    process.exit(1);
  }

  const app = createApp();
  const server = app.listen(PORT, () => {
    logger.info(`Server running at http://localhost:${PORT}`);
  });

  async function shutdown(signal) {
    logger.info(`Received ${signal}, shutting down gracefully`);
    server.close(async () => {
      await mongoose.disconnect().catch(() => {});
      process.exit(0);
    });
  }

  ['SIGINT', 'SIGTERM'].forEach((signal) => {
    process.on(signal, () => {
      shutdown(signal);
    });
  });
}

startServer();
