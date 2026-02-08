import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, 'mafia.db');
const db = new sqlite3.Database(dbPath);

export const initDB = () => {
  db.serialize(() => {
    // Rooms table
    db.run(`CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY,
      status TEXT DEFAULT 'LOBBY',
      phase_end_time INTEGER,
      winner TEXT,
      last_night_result TEXT
    )`);

    // Players table
    db.run(`CREATE TABLE IF NOT EXISTS players (
      id TEXT PRIMARY KEY,
      room_id TEXT,
      name TEXT,
      role TEXT,
      is_alive INTEGER DEFAULT 1,
      is_host INTEGER DEFAULT 0,
      socket_id TEXT,
      action_target TEXT,
      FOREIGN KEY(room_id) REFERENCES rooms(id)
    )`);
  });
};

export const runQuery = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
};

export const getQuery = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

export const allQuery = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

export default db;
