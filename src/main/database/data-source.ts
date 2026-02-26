import { DataSource } from 'typeorm';
import packageJson from '../../../package.json';
import { logger } from '../utils/logger';
import { Welcome } from './entities/welcome.entity';
import { Config } from './entities/config.entity';
import { seedDatabase } from './seed';
import { app } from 'electron';
import path from 'path';

// Use require to ensure we get the constructor, avoiding ESM interop issues
// eslint-disable-next-line @typescript-eslint/no-var-requires
const sqlite3 = require('better-sqlite3');

const getDatabasePath = () => {
  const isDev = process.env.NODE_ENV === 'development';
  if (isDev) {
    return 'dev.sqlite';
  }
  // In production, database must be in userData to be writable
  return path.join(app.getPath('userData'), `${packageJson.name}.sqlite`);
};

let db: DataSource;

let isInitialized = false;
export const getIsInitialized = () => isInitialized;

export const initDB = async (): Promise<void> => {
  const isDev = process.env.NODE_ENV === 'development';
  const dbPath = getDatabasePath();

  try {
    logger.info(`Initializing database connection at: ${dbPath}`);

    db = new DataSource({
      type: 'better-sqlite3',
      driver: sqlite3, // Explicitly inject the driver
      database: dbPath,
      entities: [Welcome, Config],
      subscribers: [],
      synchronize: true,
      logging: isDev,
    });

    await db.initialize();

    isInitialized = true;
    logger.info(`Database connection established to ${isDev ? 'dev.sqlite' : dbPath}`);

    await seedDatabase();
  } catch (error) {
    logger.error(`Database initialization error: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
};

export const getDataSource = () => {
  if (!db || !isInitialized) {
    throw new Error('Database not initialized. Call initialize() first.');
  }
  return db;
};
