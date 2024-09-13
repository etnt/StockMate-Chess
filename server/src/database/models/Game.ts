import { db } from '../index';

export async function addGame(whitePlayerId: number, blackPlayerId: number, result: string): Promise<number> {
  const result = await db.run(
    'INSERT INTO games (white_player_id, black_player_id, result) VALUES (?, ?, ?)',
    [whitePlayerId, blackPlayerId, result]
  );
  return result.lastID;
}

export async function getGames(userId: number): Promise<any[]> {
  return db.all(
    'SELECT * FROM games WHERE white_player_id = ? OR black_player_id = ? ORDER BY date DESC',
    [userId, userId]
  );
}
