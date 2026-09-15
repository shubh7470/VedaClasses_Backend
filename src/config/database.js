import mongoose from 'mongoose';
import { env } from './env.js';

export const connectDatabase = async () => {
  try {
    const conn = await mongoose.connect(env.MONGO_URI, {
      dbName: 'coaching_management',
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`✅ MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`);
  } catch (error) {
    console.warn(`⚠️ Primary MongoDB Atlas Connection Error: ${error.message}`);
    try {
      console.log(`🔄 Launching In-Memory Local MongoDB for seamless development...`);
      const { MongoMemoryServer } = await import('mongodb-memory-server');
      const mongoServer = await MongoMemoryServer.create();
      const mongoUri = mongoServer.getUri();
      const conn = await mongoose.connect(mongoUri, {
        dbName: 'coaching_management',
      });
      console.log(`✅ In-Memory Local MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`);
    } catch (memErr) {
      console.error(`❌ Database Connection Failed. Please add your IP (0.0.0.0/0) to MongoDB Atlas IP Whitelist.`);
      process.exit(1);
    }
  }
};

mongoose.connection.on('disconnected', () => {
  console.warn('⚠️ MongoDB disconnected.');
});

mongoose.connection.on('error', (err) => {
  console.error(`❌ MongoDB connection error: ${err.message}`);
});
