import React from 'react';
import { Chessboard } from 'react-chessboard';
import EvaluationBar from './components/EvaluationBar';
import OpponentSelector from './components/OpponentSelector';
import LoginForm from './components/LoginForm';
import RegisterForm from './components/RegisterForm';
import { useChessGame } from './hooks/useChessGame';
import { useOpponent } from './hooks/useOpponent';
// Remove the Human option from the OpponentSelector component
import { useAuth } from './hooks/useAuth';
import { useWebSocket } from './hooks/useWebSocket';
import './App.css';

const App: React.FC = () => {
  const { user, handleLogin, handleRegister, handleLogout } = useAuth();
  const { game, fen, selectedPiece, moveHistory, evaluation, suggestedMove, makeAMove, onSquareClick, onPieceDrop, startNewGame, undoLastMove, setSuggestedMove } = useChessGame();
  const { opponent, setOpponent, searchDepth, setSearchDepth, setStockfishDepth } = useOpponent();
  const { ws, onlineUsers } = useWebSocket(user);

  const boardSize = 600;

  const requestSuggestion = async () => {
    if (game.turn() === 'w') {
      try {
        const response = await fetch('http://localhost:3001/api/suggest', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ board: fen }),
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

        setSuggestedMove(data.move);

      } catch (error) {
        console.error('Error requesting move suggestion:', error);
      }
    } else {
      console.log("It's not White's turn to move");
    }
  };

  return (
    <div className="App">
      <h1>StockMate Chess</h1>
      {user ? (
        <>
          <div className="welcome-container">
            <h2 className="welcome-message">Welcome {user.username}!</h2>
            <button className="logout-button" onClick={handleLogout}>Logout</button>
          </div>
          <div className="game-container">
            <div className="side-controls">
              <OpponentSelector
                opponent={opponent}
                setOpponent={setOpponent}
              />
              {opponent === 'stockfish' && (
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
              )}
              <button className="new-game-button" onClick={() => {
                console.log("Starting new game with opponent:", opponent);
                startNewGame(opponent);
              }}>New Game</button>
              <button className="suggest-button" onClick={requestSuggestion}>Suggest</button>
              <button className="go-back-button" onClick={undoLastMove}>Go Back</button>
            </div>
            <div className="board-evaluation-history">
              <div className="board-and-evaluation">
                <Chessboard
                  position={fen}
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
            <div className="online-players">
              <h3>Online Players</h3>
              {onlineUsers.length > 0 ? (
                <ul>
                  {onlineUsers.map((onlineUser) => (
                    <li key={onlineUser.id}>{onlineUser.username}</li>
                  ))}
                </ul>
              ) : (
                <p>No other players online</p>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="auth-container">
          <LoginForm onLogin={handleLogin} />
          <RegisterForm onRegister={handleRegister} />
        </div>
      )}
    </div>
  );
};

export default App;
