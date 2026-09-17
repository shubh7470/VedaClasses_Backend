import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { env } from './env.js';

const BACKUP_FILE = path.join(process.cwd(), '.data', 'db_backup.json');

/**
 * Restore collections from disk backup if present
 */
export const restoreBackup = async () => {
  try {
    if (!fs.existsSync(BACKUP_FILE)) return;
    const raw = fs.readFileSync(BACKUP_FILE, 'utf-8');
    if (!raw.trim()) return;
    const backupData = JSON.parse(raw);

    const db = mongoose.connection.db;
    if (!db) return;

    for (const [collName, docs] of Object.entries(backupData)) {
      if (Array.isArray(docs) && docs.length > 0) {
        const collection = db.collection(collName);
        const count = await collection.countDocuments();
        if (count === 0) {
          // Convert string _id and ObjectId refs back to mongoose ObjectId
          const formattedDocs = docs.map((doc) => {
            const copy = { ...doc };
            if (copy._id && typeof copy._id === 'string' && copy._id.length === 24) {
              copy._id = new mongoose.Types.ObjectId(copy._id);
            }
            if (copy.userId && typeof copy.userId === 'string' && copy.userId.length === 24) {
              copy.userId = new mongoose.Types.ObjectId(copy.userId);
            }
            if (copy.studentId && typeof copy.studentId === 'string' && copy.studentId.length === 24) {
              copy.studentId = new mongoose.Types.ObjectId(copy.studentId);
            }
            if (copy.courseId && typeof copy.courseId === 'string' && copy.courseId.length === 24) {
              copy.courseId = new mongoose.Types.ObjectId(copy.courseId);
            }
            if (copy.batchId && typeof copy.batchId === 'string' && copy.batchId.length === 24) {
              copy.batchId = new mongoose.Types.ObjectId(copy.batchId);
            }
            return copy;
          });
          await collection.insertMany(formattedDocs);
          console.log(`📦 Restored ${formattedDocs.length} records into collection '${collName}'`);
        }
      }
    }
  } catch (err) {
    console.warn(`⚠️ Error restoring DB backup: ${err.message}`);
  }
};

/**
 * Save all active DB collections to disk backup
 */
export const saveBackup = async () => {
  try {
    const db = mongoose.connection.db;
    if (!db) return;

    const collections = await db.listCollections().toArray();
    const backupData = {};

    for (const collInfo of collections) {
      const collName = collInfo.name;
      const docs = await db.collection(collName).find({}).toArray();
      if (docs.length > 0) {
        backupData[collName] = docs;
      }
    }

    const dir = path.dirname(BACKUP_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(BACKUP_FILE, JSON.stringify(backupData, null, 2), 'utf-8');
  } catch (err) {
    // Silent catch
  }
};

export const connectDatabase = async () => {
  try {
    const conn = await mongoose.connect(env.MONGO_URI, {
      dbName: 'coaching_management',
      serverSelectionTimeoutMS: 4000,
    });
    console.log(`✅ MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`);
    await restoreBackup();
  } catch (error) {
    console.warn(`⚠️ Primary MongoDB Atlas Connection Error: ${error.message}`);
    try {
      console.log(`🔄 Launching In-Memory Development MongoDB...`);
      const { MongoMemoryServer } = await import('mongodb-memory-server');
      const mongoServer = await MongoMemoryServer.create();
      const mongoUri = mongoServer.getUri();
      const conn = await mongoose.connect(mongoUri, {
        dbName: 'coaching_management',
      });
      console.log(`✅ Development MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`);
      
      // Restore persistent data from disk
      await restoreBackup();

      // Auto-save backup every 4 seconds & process exit hooks
      setInterval(saveBackup, 4000);
      process.on('SIGINT', async () => {
        await saveBackup();
        process.exit(0);
      });
      process.on('SIGTERM', async () => {
        await saveBackup();
        process.exit(0);
      });
    } catch (memErr) {
      console.error(`❌ Database Connection Failed: ${memErr.message}`);
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
