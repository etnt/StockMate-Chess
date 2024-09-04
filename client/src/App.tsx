import React, { useState, useEffect } from 'react';
import { Chess, Square } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import EvaluationBar from './components/EvaluationBar';
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
  const [game, setGame] = useState<Chess>(new Chess());
  const [fen, setFen] = useState(game.fen());
  const [selectedPiece, setSelectedPiece] = useState<Square | null>(null);
  const [moveHistory, setMoveHistory] = useState('');
  const [fullHistory, setFullHistory] = useState<string[]>([]);
  const [searchDepth, setSearchDepth] = useState<number>(10); // Default depth
  const [evaluation, setEvaluation] = useState(0);
  const [suggestedMove, setSuggestedMove] = useState(null);
  const boardSize = 600;

  // Update move history whenever the game state changes
  useEffect(() => {
    setFen(game.fen());
    updateMoveHistory();
    if (game.turn() === 'b') {
      requestMove();
    }
  }, [game, fullHistory]);

  /**
   * Makes a move on the chess board.
   * 
   * This function creates a copy of the current game state, attempts to make the specified move,
   * and updates the game state if the move is legal.
   * 
   * @param {Object} move - The move to be made, typically containing 'from' and 'to' properties.
   * @returns {Object|null} The move object if the move was legal, null if it was illegal.
   */
  const makeAMove = (from: Square, to: Square) => {
    const gameCopy = new Chess(game.fen());
    try {
      const result = gameCopy.move({ from, to, promotion: 'q' });
      if (result) {
        console.log('Move made:', result.san);
        setGame(gameCopy);
        setFen(gameCopy.fen());
        setFullHistory(prevHistory => [...prevHistory, result.san]);
        setSuggestedMove(null);
        setSelectedPiece(null);  // Clear the selected piece after a move
        return result;
      }
    } catch (error) {
      console.error('Invalid move:', error);
    }
    return null; // Return null for invalid moves
  };

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

      // Add a delay before making the move (e.g., 500ms)
      await new Promise(resolve => setTimeout(resolve, 500));

      // Make the move on the new chess instance
      const result = newGame.move({ from, to, promotion });

      if (result === null) {
        console.error(`Invalid move: ${JSON.stringify(data.move)}`);
        return;
      }

      // Update the game state
      setGame(newGame);
      setFen(newGame.fen());
      setFullHistory(prevHistory => [...prevHistory, result.san]);

      // Update evaluation
      if (data.evaluation !== undefined) {
        setEvaluation(data.evaluation);
      }

      console.log('Move applied, new FEN:', newGame.fen());

    } catch (error) {
      console.error('Error requesting move from server:', error);
    }
  }

  async function setStockfishDepth(depth: number) {
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
  };

  const startNewGame = () => {
    const newGame = new Chess();
    setGame(newGame);
    setFen(newGame.fen());
    setEvaluation(0); // Reset evaluation to 0
    setMoveHistory(''); // Clear the formatted move history
    setFullHistory([]); // Clear the full history array
    setSuggestedMove(null);
    setSelectedPiece(null); // Reset the selected piece
    // Reset any other relevant state variables
  };

  const highlightSuggestedMove = (move) => {
    setSuggestedMove(move);
  };

  const requestSuggestion = async () => {
    if (game.turn() === 'w') {
      try {
        setSelectedPiece(null); // Reset the selected piece
        const response = await fetch('http://localhost:3001/api/suggest', {
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

        // Highlight the suggested move on the board
        highlightSuggestedMove(data.move);

      } catch (error) {
        console.error('Error requesting move suggestion:', error);
      }
    } else {
      console.log("It's not White's turn to move");
    }
  };

  async function requestEvaluation(fen: string): Promise<number | null> {
    try {
      const response = await fetch('http://localhost:3001/api/evaluate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ board: fen }),
      });

      const data = await response.json();
      if (data.evaluation !== undefined) {
        return data.evaluation;
      } else if (data.error) {
        console.error('Evaluation error:', data.error);
      }
    } catch (error) {
      console.error('Error requesting evaluation:', error);
    }
    return null;
  }

  async function undoLastMove() {
    console.log('Undoing last move 1:', fullHistory);
    if (fullHistory.length > 0) {
      let newHistory;
      if (fullHistory.length % 2 === 0) {
        // If even number of moves, remove the last two
        newHistory = fullHistory.slice(0, -2);
      } else {
        // If odd number of moves, remove only the last one
        newHistory = fullHistory.slice(0, -1);
      }

      console.log('Undoing last move 2:', newHistory);

      const newGame = new Chess();
      newHistory.forEach(move => newGame.move(move));

      console.log('Undoing last move 3:', newGame.history());

      setGame(newGame);
      setFen(newGame.fen());
      setFullHistory(newHistory);
      setSuggestedMove(null);
      setSelectedPiece(null);
      updateMoveHistory();

      if (newHistory.length > 0) {
        // Request new evaluation
        const newEvaluation = await requestEvaluation(newGame.fen());
        if (newEvaluation !== null) {
          setEvaluation(-newEvaluation);
        }
      }
      else {
        setEvaluation(0);
      }
    } else {
      console.log('No moves to undo');
    }
  }

  return (
    <div className="App">
      <h1>StockMate Chess</h1>
      <div className="game-container">
        <div className="board-and-controls">
          <div className="side-controls">
            <div className="depth-selector">
              <label htmlFor="depth-select">Stockfish Depth:</label>
              <select
                id="depth-select"
                value={searchDepth}
                onChange={(e) => {
                  const newDepth = parseInt(e.target.value);
                  setSearchDepth(newDepth);
                  setStockfishDepth(newDepth);
                }}
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map(depth => (
                  <option key={depth} value={depth}>{depth}</option>
                ))}
              </select>
            </div>
            <button className="new-game-button" onClick={startNewGame}>New Game</button>
            <button className="suggest-button" onClick={requestSuggestion}>Suggest</button>
            <button className="go-back-button" onClick={undoLastMove}>Go Back</button>
          </div>
          <div className="main-game-area">
            <div className="board-and-evaluation">
              <Chessboard
                position={game.fen}
                onPieceDrop={onPieceDrop}
                onSquareClick={onSquareClick}
                customSquareStyles={{
                  ...(selectedPiece && { [selectedPiece]: { backgroundColor: 'rgba(255, 255, 0, 0.4)' } }),
                  ...(suggestedMove?.from && { [suggestedMove.from]: { backgroundColor: 'rgba(0, 255, 0, 0.4)' } }),
                  ...(suggestedMove?.to && { [suggestedMove.to]: { backgroundColor: 'rgba(0, 255, 0, 0.4)' } }),
                }}
              />
              <EvaluationBar evaluation={evaluation} boardHeight={boardSize} />
            </div>
            <div className="move-history-container">
              <textarea
                className="move-history"
                value={moveHistory}
                readOnly
                placeholder="Moves will appear here as they are made..."
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
