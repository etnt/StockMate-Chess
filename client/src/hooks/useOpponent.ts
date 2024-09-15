import { useState } from 'react';

export function useOpponent() {
  const [opponent, setOpponent] = useState<string>('stockfish');
  const [searchDepth, setSearchDepth] = useState<number>(10);

  const setStockfishDepth = async (depth: number) => {
    try {
      const response = await fetch('http://localhost:3001/api/set-depth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ depth }),
      });
      const data = await response.json();
      if (data.success) {
        console.log(`Search depth set to ${depth}`);
      } else {
        console.error('Failed to set search depth:', data.error);
      }
    } catch (error) {
      console.error('Error setting search depth:', error);
    }
  };

  return {
    opponent,
    setOpponent,
    searchDepth,
    setSearchDepth,
    setStockfishDepth
  };
}
