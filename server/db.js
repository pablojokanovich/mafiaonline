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
      is_online INTEGER DEFAULT 1,
      socket_id TEXT,
      action_target TEXT,
      has_acted_this_round INTEGER DEFAULT 0,
      FOREIGN KEY(room_id) REFERENCES rooms(id)
    )`);
    
    // Migration: Add is_online column if it doesn't exist
    db.run(`ALTER TABLE players ADD COLUMN is_online INTEGER DEFAULT 1`, (err) => {
       // Ignore error if column exists
    });

    // Migration: Add has_acted_this_round column if it doesn't exist
    db.run(`ALTER TABLE players ADD COLUMN has_acted_this_round INTEGER DEFAULT 0`, (err) => {
       // Ignore error if column exists
    });
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
