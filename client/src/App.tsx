import React, { useState } from 'react';
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
  const [selectedPiece, setSelectedPiece] = useState<string | null>(null);

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
    const result = gameCopy.move({ from, to, promotion: 'q' });
    if (result) {
      setGame(gameCopy);
    }
    return result; // null if the move was illegal, the move object if the move was legal
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
      const result = makeAMove(sourceSquare, targetSquare);
      return result !== null;
    }
    return false;
  }

  function isValidSquare(square: string): square is Square {
    // Add logic to validate if the string is a valid chess square
    return /^[a-h][1-8]$/.test(square);
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
    </div>
  );
};

export default App;
