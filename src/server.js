import app from './app.js';
import { env } from './config/env.js';
import { connectDatabase } from './config/database.js';
import { seedDatabase } from './config/seed.js';

let server;

const startServer = async () => {
  try {
    // 1. Connect to MongoDB
    await connectDatabase();

    // 2. Seed default roles and admin account
    await seedDatabase();

    // 3. Start HTTP Server
    server = app.listen(env.PORT, () => {
      console.log(`🚀 Server running in ${env.NODE_ENV} mode on port http://localhost:${env.PORT}`);
      console.log(`📡 Health check available at http://localhost:${env.PORT}/api/v1/health`);
    });
  } catch (error) {
    console.error(`❌ Failed to start server: ${error.message}`);
    process.exit(1);
  }
};

// Graceful Shutdown Handler
const shutdown = async (signal) => {
  console.log(`\n🛑 ${signal} received. Closing server gracefully...`);
  if (server) {
    server.close(async () => {
      console.log('🔒 HTTP server closed.');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (err) => {
  console.error(`💥 Unhandled Rejection: ${err.message}`);
  if (server) {
    server.close(() => process.exit(1));
  } else {
    process.exit(1);
  }
});

process.on('uncaughtException', (err) => {
  console.error(`💥 Uncaught Exception: ${err.message}`);
  process.exit(1);
});

startServer();
