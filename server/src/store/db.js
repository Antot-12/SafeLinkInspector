import { mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';

const dbFile = join(process.cwd(), 'data', 'history.json');
await mkdir(dirname(dbFile), { recursive: true });

const adapter = new JSONFile(dbFile);
export const db = new Low(adapter, { history: [] });
await db.read();
if (!db.data) db.data = { history: [] };

export const addRecord = async (rec) => {
  db.data.history.unshift(rec);
  if (db.data.history.length > 300) db.data.history.length = 300;
  await db.write();
};

export const getAll = () => db.data.history;
export const getById = (id) => db.data.history.find(r => r.id === id);

export const removeById = async (id) => {
  const i = db.data.history.findIndex(r => r.id === id);
  if (i >= 0) {
    db.data.history.splice(i, 1);
    await db.write();
    return true;
  }
  return false;
};

export const clearAll = async () => {
  db.data.history = [];
  await db.write();
};
