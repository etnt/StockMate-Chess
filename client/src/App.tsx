import React, { useState, useEffect } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import { Square } from 'chess.js';
import './App.css';
/**
 * Chess Game Application
 * 
 * This React component implements a chess game using the react-chessboard library
 * and the chess.js library for game logic.
 * 
 * Key features:
 * - Uses useState to manage the game state
 * - Implements makeAMove function to update the game state
 * - Implements onDrop function to handle piece movements
 * - Renders a chessboard using the Chessboard component from react-chessboard
 * 
 * The game allows players to make moves by dragging and dropping pieces.
 * It automatically promotes pawns to queens for simplicity.
 * 
 * @component
 */

const App: React.FC = () => {
  /**
   * The current state of the chess game.
   * 
   * This state is managed using the useState hook and contains an instance of the Chess class
   * from the chess.js library. The Chess instance represents the current state of the game,
   * including piece positions, whose turn it is, and game history.
   * 
   * @type {Chess}
   */
  const [game, setGame] = useState(new Chess());
  const [selectedPiece, setSelectedPiece] = useState<Square | null>(null);
  const [moveHistory, setMoveHistory] = useState('');
  const [fullHistory, setFullHistory] = useState<string[]>([]);

  // Update move history whenever the game state changes
  useEffect(() => {
    updateMoveHistory();
    if (game.turn() === 'b') {
      requestMove();
    }
  }, [game]);

  /**
   * Makes a move on the chess board.
   * 
   * This function creates a copy of the current game state, attempts to make the specified move,
   * and updates the game state if the move is legal.
   * 
   * @param {Object} move - The move to be made, typically containing 'from' and 'to' properties.
   * @returns {Object|null} The move object if the move was legal, null if it was illegal.
   */
  function makeAMove(from: Square, to: Square) {
    const gameCopy = new Chess(game.fen());
    try {
      const result = gameCopy.move({ from, to, promotion: 'q' });
      if (result) {
        setGame(gameCopy);
        setFullHistory(prevHistory => [...prevHistory, result.san]);
        return result;
      }
    } catch (error) {
      console.error('Invalid move:', error);
    }
    return null; // Return null for invalid moves
  }

  /**
   * Handles the clicking of a square on the chess board.
   * 
   * This function is called when a player clicks on a square. It attempts to select the piece
   * on that square if no piece is currently selected, or it attempts to move the currently
   * selected piece to that square if a piece is selected.
   * 
   * @param {string} square - The square that was clicked.
   */
  function onSquareClick(square: Square) {
    if (selectedPiece === null) {
      // If no piece is selected, select the clicked piece if it exists
      const piece = game.get(square);
      if (piece && piece.color === game.turn()) {
        setSelectedPiece(square);
      }
    } else {
      // If a piece is already selected, try to move it to the clicked square
      const result = makeAMove(selectedPiece as Square, square);
      if (result) {
        setSelectedPiece(null);
      } else {
        // If the move was invalid, select the new square if it has a piece of the current player's color
        const piece = game.get(square);
        if (piece && piece.color === game.turn()) {
          setSelectedPiece(square);
        } else {
          setSelectedPiece(null);
        }
      }
    }
  }

  /**
   * Handles the dropping of a piece on the chess board.
   * 
   * This function is called when a player drops a piece after dragging it. It attempts to make
   * the move and returns true if the move was legal, false otherwise.
   * 
   * @param {string} sourceSquare - The square from which the piece is moved (e.g., "e2").
   * @param {string} targetSquare - The square to which the piece is moved (e.g., "e4").
   * @returns {boolean} True if the move was legal and made, false otherwise.
   */
  function onPieceDrop(sourceSquare: string, targetSquare: string) {
    if (isValidSquare(sourceSquare) && isValidSquare(targetSquare)) {
      const result = makeAMove(sourceSquare as Square, targetSquare as Square);
      return result !== null;
    }
    return false;
  }

  function isValidSquare(square: string): square is Square {
    // Add logic to validate if the string is a valid chess square
    return /^[a-h][1-8]$/.test(square);
  }

  async function requestMove() {
    try {
      console.log('Requesting move from server:', game.fen());
      const response = await fetch('http://localhost:3001/api/move', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ board: game.fen() }),
      });
      const data = await response.json();

      if (data.error) {
        console.error('Server error:', data.error);
        return;
      }

      if (!data.move || typeof data.move !== 'object') {
        console.error('Invalid move data received from server:', data);
        return;
      }
      console.log('Received move:', data.move);
      
      const { from, to, promotion } = data.move;
      
      if (!from || !to) {
        console.error('Move data is missing "from" or "to" properties');
        return;
      }

      // Create a new Chess instance
      const newGame = new Chess(game.fen());

      // Make the move on the new chess instance
      const result = newGame.move({ from, to, promotion });

      if (result === null) {
        console.error(`Invalid move: ${JSON.stringify(data.move)}`);
        return;
      }

      // Update the game state
      setGame(newGame);
      setFullHistory(prevHistory => [...prevHistory, result.san]);

      console.log('Move applied, new FEN:', newGame.fen());

    } catch (error) {
      console.error('Error requesting move from server:', error);
    }
  }

  function updateMoveHistory() {
    let formattedHistory = '';
    for (let i = 0; i < fullHistory.length; i += 2) {
      const moveNumber = Math.floor(i / 2) + 1;
      const whiteMove = fullHistory[i];
      const blackMove = fullHistory[i + 1] || '';
      formattedHistory += `${moveNumber}. ${whiteMove} ${blackMove}\n`;
    }
    setMoveHistory(formattedHistory.trim());
  }

  return (
    <div className="App">
      <h1>Chess Board</h1>
      <div style={{ width: '600px', margin: 'auto' }}>
        <Chessboard
          position={game.fen()}
          onPieceDrop={onPieceDrop}
          onSquareClick={onSquareClick}
        />
      </div>
      <div style={{ width: '600px', margin: '20px auto' }}>
        <textarea
          value={moveHistory}
          readOnly
          style={{ width: '100%', height: '100px', resize: 'vertical' }}
          placeholder="Moves will appear here as they are made..."
        />
      </div>
      <button onClick={() => {
        setGame(new Chess());
        setFullHistory([]);
      }}>
        New Game
      </button>
    </div>
  );
};

export default App;
