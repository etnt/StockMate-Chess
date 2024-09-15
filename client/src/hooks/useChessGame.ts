import { useState, useEffect } from 'react';
import { Chess, Square } from 'chess.js';
import { GetMoveRequest, GetMoveResponse, MoveRequest, MoveResponse } from '../../../shared/types';

/**
 * Custom React hook for managing a chess game.
 * 
 * This hook encapsulates the logic for:
 * - Managing the game state
 * - Handling user moves
 * - Interacting with an AI opponent
 * - Updating the game history
 * - Managing the game's evaluation
 * 
 * @returns An object containing the game state and functions to interact with the game.
 */
export function useChessGame() {
  // The current state of the chess game
  const [game, setGame] = useState(new Chess());

  // The current board position in Forsyth-Edwards Notation (FEN)
  const [fen, setFen] = useState(game.fen());

  // The currently selected piece on the board (if any)
  const [selectedPiece, setSelectedPiece] = useState<Square | null>(null);

  // A formatted string representation of the move history
  const [moveHistory, setMoveHistory] = useState('');

  // An array of all moves made in the game in Standard Algebraic Notation (SAN)
  const [fullHistory, setFullHistory] = useState<string[]>([]);

  // The current evaluation of the board position (positive favors white, negative favors black)
  const [evaluation, setEvaluation] = useState(0);

  // A suggested move for the current player (if any)
  const [suggestedMove, setSuggestedMove] = useState(null);

  // The type of opponent (e.g., 'stockfish' for AI, 'human' for human player)
  const [opponent, setOpponent] = useState<string>('stockfish');

  /**
   * Effect hook to update the game state and request moves from the AI opponent.
   * 
   * This effect runs whenever the game state or move history changes.
   * It updates the FEN representation of the board and the move history.
   * If it's black's turn and the opponent is not human, it requests a move from the AI.
   */
  useEffect(() => {
    setFen(game.fen());
    updateMoveHistory();
    if (game.turn() === 'b' && opponent !== 'human') {
      requestMove();
    }
  }, [game, fullHistory, opponent]);

  /**
   * Attempts to make a move on the chess board.
   * 
   * @param from - The starting square of the move
   * @param to - The ending square of the move
   * @returns The move in Standard Algebraic Notation (SAN) if successful, null otherwise
   */
  const makeAMove = async (from: Square, to: Square) => {
    const gameCopy = new Chess(game.fen());
    try {
      const result = gameCopy.move({ from, to, promotion: 'q' });
      if (result) {
        console.log('Move made:', result.san);
        setGame(gameCopy);
        setFen(gameCopy.fen());
        setFullHistory(prevHistory => [...prevHistory, result.san]);
        setSuggestedMove(null);
        setSelectedPiece(null);
        return result.san;
      }
    } catch (error) {
      console.error('Invalid move:', error);
    }
    return null;
  };

  /**
   * Handles the click event on a chess square.
   * 
   * This function manages the piece selection and move execution process:
   * - If no piece is selected, it selects a piece of the current player's color.
   * - If a piece is already selected, it attempts to make a move to the clicked square.
   * - If the move is invalid, it either selects a new piece or deselects the current piece.
   * 
   * @param square - The clicked square on the chess board
   */
  const onSquareClick = (square: Square) => {
    if (selectedPiece === null) {
      const piece = game.get(square);
      if (piece && piece.color === game.turn()) {
        setSelectedPiece(square);
      }
    } else {
      const result = makeAMove(selectedPiece as Square, square);
      if (result) {
        setSelectedPiece(null);
      } else {
        const piece = game.get(square);
        if (piece && piece.color === game.turn()) {
          setSelectedPiece(square);
        } else {
          setSelectedPiece(null);
        }
      }
    }
  };

  const onPieceDrop = (sourceSquare: string, targetSquare: string) => {
    if (selectedPiece !== null) {
      return false;
    }

    if (isValidSquare(sourceSquare) && isValidSquare(targetSquare)) {
      const result = makeAMove(sourceSquare as Square, targetSquare as Square);
      return result !== null;
    }
    return false;
  };

  const isValidSquare = (square: string): square is Square => {
    return /^[a-h][1-8]$/.test(square);
  };

  const requestMove = async () => {
    try {
      console.log('Requesting move from server:', game.fen(), 'Opponent:', opponent);
      const response: GetMoveResponse = await getMoveFromServer({ 
        board: game.fen(), 
        opponent: opponent 
      });

      if ('error' in response) {
        console.error('Server error:', response.error);
        return;
      }

      const { move, evaluation } = response;
      console.log('Received move:', move);

      const { from, to, promotion } = move;

      const newGame = new Chess(game.fen());

      await new Promise(resolve => setTimeout(resolve, 500));

      const result = newGame.move({ from, to, promotion });

      if (result === null) {
        console.error(`Invalid move: ${JSON.stringify(move)}`);
        return;
      }

      setGame(newGame);
      setFen(newGame.fen());
      setFullHistory(prevHistory => [...prevHistory, result.san]);
      setEvaluation(evaluation);

      console.log('Move applied, new FEN:', newGame.fen());

    } catch (error) {
      console.error('Error requesting move from server:', error);
    }
  };

  const updateMoveHistory = () => {
    let formattedHistory = '';
    for (let i = 0; i < fullHistory.length; i += 2) {
      const moveNumber = Math.floor(i / 2) + 1;
      const whiteMove = fullHistory[i];
      const blackMove = fullHistory[i + 1] || '';
      formattedHistory += `${moveNumber}. ${whiteMove} ${blackMove}\n`;
    }
    setMoveHistory(formattedHistory.trim());
  };

  const startNewGame = (selectedOpponent: string) => {
    console.log("Starting new game with opponent:", selectedOpponent);
    const newGame = new Chess();
    setGame(newGame);
    setFen(newGame.fen());
    setEvaluation(0);
    setMoveHistory('');
    setFullHistory([]);
    setSuggestedMove(null);
    setSelectedPiece(null);
    setOpponent(selectedOpponent);

    // If the opponent is not 'human', request a move for black
    if (selectedOpponent !== 'human' && newGame.turn() === 'b') {
      setTimeout(() => requestMove(), 500);
    }
  };

  const undoLastMove = async () => {
    console.log('Undoing last move 1:', fullHistory);
    if (fullHistory.length > 0) {
      let newHistory = fullHistory.length % 2 === 0 ? fullHistory.slice(0, -2) : fullHistory.slice(0, -1);

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
        const newEvaluation = await requestEvaluation(newGame.fen());
        if (newEvaluation !== null) {
          setEvaluation(-newEvaluation);
        }
      } else {
        setEvaluation(0);
      }
    } else {
      console.log('No moves to undo');
    }
  };

  return {
    game,
    fen,
    selectedPiece,
    moveHistory,
    fullHistory,
    evaluation,
    suggestedMove,
    opponent,
    makeAMove,
    onSquareClick,
    onPieceDrop,
    requestMove,
    startNewGame,
    undoLastMove,
    setSuggestedMove,
    setOpponent
  };
}

async function getMoveFromServer(request: GetMoveRequest): Promise<GetMoveResponse> {
  const response = await fetch('http://localhost:3001/api/get_move', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  return response.json();
}

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
