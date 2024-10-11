import { useState, useEffect } from 'react';
import { Chess, Square } from 'chess.js';
import { GetMoveRequest, GetMoveResponse, MoveRequest, MoveResponse } from '../../../shared/types';

export function useChessGame() {
  const [game, setGame] = useState(new Chess());
  const [fen, setFen] = useState(game.fen());
  const [selectedPiece, setSelectedPiece] = useState<Square | null>(null);
  const [moveHistory, setMoveHistory] = useState('');
  const [fullHistory, setFullHistory] = useState<string[]>([]);
  const [evaluation, setEvaluation] = useState(0);
  const [suggestedMove, setSuggestedMove] = useState(null);
  const [opponent, setOpponent] = useState<string>('stockfish');
  const [gameStatus, setGameStatus] = useState<'active' | 'resigned' | 'checkmate' | 'draw'>('active');

  useEffect(() => {
    setFen(game.fen());
    updateMoveHistory();
    if (game.turn() === 'b' && opponent !== 'human') {
      requestMove();
    }
  }, [game, fullHistory, opponent]);

  const makeAMove = (from: Square, to: Square) => {
    console.log('makeAMove called with:', from, to);
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
        updateGameStatus(gameCopy);
        return result.san;
      }
    } catch (error) {
      console.error('Invalid move:', error);
    }
    return null;
  };

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
    console.log('onPieceDrop called with:', sourceSquare, targetSquare);
    if (selectedPiece !== null) {
      console.log('Piece already selected, returning false');
      return false;
    }

    if (isValidSquare(sourceSquare) && isValidSquare(targetSquare)) {
      console.log('Valid squares, attempting to make move');
      const result = makeAMove(sourceSquare as Square, targetSquare as Square);
      console.log('Move result:', result);
      return result !== null;
    }
    console.log('Invalid squares, returning false');
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
      updateGameStatus(newGame);

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
    setGameStatus('active');

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
      updateGameStatus(newGame);

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

  const resign = () => {
    if (game.turn() === 'w') {
      setGameStatus('resigned');
      console.log('White resigned');
    } else {
      console.log('Only White can resign');
    }
  };

  const updateGameStatus = (currentGame: Chess) => {
    if (currentGame.isCheckmate()) {
      setGameStatus('checkmate');
    } else if (currentGame.isDraw()) {
      setGameStatus('draw');
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
    gameStatus,
    makeAMove,
    onSquareClick,
    onPieceDrop,
    requestMove,
    startNewGame,
    undoLastMove,
    setSuggestedMove,
    setOpponent,
    resign
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
