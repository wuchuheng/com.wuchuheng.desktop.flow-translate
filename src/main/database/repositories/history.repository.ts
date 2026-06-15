import path from 'path';
import fs from 'fs';
import { getDataSource } from '../data-source';
import { History } from '../entities/history.entity';
import { getPaths } from '../../utils/path.util';

interface HistoryContent {
  input: string;
  transaction: string | null;
  createdAt: string;
  updatedAt: string;
}

const getHistoryDir = () => getPaths().history;

const getJsonPath = (id: number) => path.join(getHistoryDir(), `${id}.json`);

const now = () => new Date().toISOString().replace('T', ' ').slice(0, 19);

/**
 * Create a new translation history record.
 *
 * Saves a DB row first to obtain an auto-increment ID, then writes the
 * corresponding JSON file.  If the JSON write fails the DB row is rolled
 * back so no orphaned record is left behind.
 *
 * @param input - The source text to translate (must be non-empty and not
 *  whitespace-only).
 * @returns The auto-generated history record ID.
 * @throws {Error} If `input` is empty or whitespace-only, or if writing the
 *  JSON file fails.
 */
export const createHistory = async (input: string): Promise<number> => {
  if (!input || !input.trim()) {
    throw new Error('Input must be a non-empty string');
  }

  const repo = getDataSource().getRepository(History);
  const record = new History();
  await repo.save(record);

  const timestamp = now();
  const content: HistoryContent = {
    input,
    transaction: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const jsonPath = getJsonPath(record.id);
  try {
    fs.writeFileSync(jsonPath, JSON.stringify(content, null, 2), 'utf-8');
  } catch (error) {
    // Rollback the DB row so no orphaned record lingers.
    await repo.delete(record.id);
    throw new Error(`Failed to write history JSON file: ${error instanceof Error ? error.message : String(error)}`);
  }

  return record.id;
};

/**
 * Persist a translated transaction string to an existing history record.
 *
 * The DB row's `updatedAt` column is refreshed first (via the empty update
 * that triggers TypeORM's `@UpdateDateColumn`).  Only after that succeeds is
 * the on-disk JSON file modified, preventing the JSON from drifting ahead of
 * the DB on failure.
 *
 * @param id - The history record ID (must be > 0).
 * @param transaction - The translated transaction string to store.
 * @throws {Error} If `id` is not positive, the history JSON file is missing,
 *  or any DB / filesystem operation fails.
 */
export const updateTransaction = async (id: number, transaction: string): Promise<void> => {
  if (!(id > 0)) {
    throw new Error('History ID must be a positive number');
  }

  const repo = getDataSource().getRepository(History);

  // `repo.update(id, {})` passes an empty partial entity so that TypeORM
  // still executes an UPDATE statement, which triggers the @UpdateDateColumn
  // decorator to refresh the `updatedAt` timestamp on the row.
  try {
    await repo.update(id, {});
  } catch (error) {
    throw new Error(
      `Failed to update history DB record ${id}: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  const jsonPath = getJsonPath(id);
  if (!fs.existsSync(jsonPath)) {
    throw new Error(`History file not found: ${id}`);
  }

  const raw = fs.readFileSync(jsonPath, 'utf-8');
  let content: HistoryContent;
  try {
    content = JSON.parse(raw);
  } catch (error) {
    throw new Error(
      `Corrupt history JSON file for record ${id}: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  content.transaction = transaction;
  content.updatedAt = now();
  fs.writeFileSync(jsonPath, JSON.stringify(content, null, 2), 'utf-8');
};

/**
 * Return a list of all history records ordered newest-first.
 *
 * @returns An array of objects each containing the record `id` and a
 *  formatted `createdAt` timestamp.
 */
export const getAllHistory = async (): Promise<{ id: number; createdAt: string }[]> => {
  const repo = getDataSource().getRepository(History);
  const records = await repo.find({ order: { id: 'DESC' } });
  return records.map(r => ({
    id: r.id,
    createdAt: r.createdAt.toISOString().replace('T', ' ').slice(0, 19),
  }));
};

/**
 * Retrieve the full content of a history record by its ID.
 *
 * Reads and parses the on-disk JSON file.  Returns `null` when the file does
 * not exist or contains invalid JSON.
 *
 * @param id - The history record ID.
 * @returns The parsed history content, or `null` if unavailable / corrupt.
 */
export const getHistoryById = async (id: number): Promise<HistoryContent | null> => {
  const jsonPath = getJsonPath(id);
  if (!fs.existsSync(jsonPath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  } catch {
    return null;
  }
};
