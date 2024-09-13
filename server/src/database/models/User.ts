import { db } from '../index';
import bcrypt from 'bcrypt';

export async function createUser(username: string, password: string): Promise<number> {
  const hashedPassword = await bcrypt.hash(password, 10);
  const result = await db.run(
    'INSERT INTO users (username, password) VALUES (?, ?)',
    [username, hashedPassword]
  );
  return result.lastID;
}

export async function getUser(username: string): Promise<any> {
  return db.get('SELECT * FROM users WHERE username = ?', [username]);
}

export async function updateElo(userId: number, newElo: number): Promise<void> {
  await db.run('UPDATE users SET elo_rating = ? WHERE id = ?', [newElo, userId]);
}
