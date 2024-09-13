import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

let db: any;

async function initializeDatabase() {
  db = await open({
    filename: './chess_users.db',
    driver: sqlite3.Database
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password TEXT,
      elo_rating INTEGER DEFAULT 1500
    );

    CREATE TABLE IF NOT EXISTS games (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      white_player_id INTEGER,
      black_player_id INTEGER,
      result TEXT,
      date DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (white_player_id) REFERENCES users(id),
      FOREIGN KEY (black_player_id) REFERENCES users(id)
    );
  `);

  return db;
}

export { initializeDatabase, db };
