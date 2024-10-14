import React, { useState, useEffect, useCallback } from 'react';
import { Chessboard } from 'react-chessboard';
import EvaluationBar from './components/EvaluationBar';
import OpponentSelector from './components/OpponentSelector';
import LoginForm from './components/LoginForm';
import RegisterForm from './components/RegisterForm';
import { useChessGame } from './hooks/useChessGame';
import { useOpponent } from './hooks/useOpponent';
import { useAuth } from './hooks/useAuth';
import { useWebSocket } from './hooks/useWebSocket';
import { OnlineUser, WebSocketMessage } from '../../shared/types';
import './App.css';

const App: React.FC = () => {
  const { user, handleLogin, handleRegister, handleLogout } = useAuth();
  const {
    game,
    fen,
    selectedPiece,
    moveHistory,
    evaluation,
    suggestedMove,
    startNewGame,
    undoLastMove,
    setSuggestedMove,
    onPieceDrop,
    onSquareClick,
    gameStatus,
    resign,
    boardOrientation,
    isChallenger
  } = useChessGame();
  const { opponent, setOpponent, searchDepth, setSearchDepth, setStockfishDepth } = useOpponent();
  const { ws } = useWebSocket(user);

  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [incomingChallenges, setIncomingChallenges] = useState<string[]>([]);

  const boardSize = 600;

  const startNewGameWithOpponent = useCallback((opponentUsername: string, userIsChallenger: boolean) => {
    startNewGame(opponentUsername, userIsChallenger);
  }, [startNewGame]);

  useEffect(() => {
    if (!ws) return;

    ws.onmessage = (event: MessageEvent) => {
      const data: WebSocketMessage = JSON.parse(event.data);
      console.log('Received WebSocket message:', data);

      if (data.type === 'challenge_received') {
        setIncomingChallenges(prev => [...prev, data.from]);
      }

      if (data.type === 'challenge_response') {
        if (data.accepted) {
          alert(`${data.from} accepted your challenge! Starting new game.`);
          startNewGameWithOpponent(data.from, true);
        } else {
          alert(`${data.from} rejected your challenge.`);
        }
      }

      if (data.type === 'start_game') {
        alert(`Starting game with ${data.opponent}`);
        startNewGameWithOpponent(data.opponent, false);
      }

      if (data.type === 'onlineUsers') {
        setOnlineUsers(data.users);
      }
    };

    return () => {
      ws.onmessage = null;
    };
  }, [ws, setOnlineUsers, startNewGameWithOpponent]);

  const handleChallenge = (targetUsername: string) => {
    if (!ws) return;
    const challengeMessage: WebSocketMessage = {
      type: 'challenge',
      from: user?.username || '',
      to: targetUsername
    };
    ws.send(JSON.stringify(challengeMessage));
    alert(`Challenge sent to ${targetUsername}`);
  };

  const handleAcceptChallenge = (fromUsername: string) => {
    if (!ws) return;
    const responseMessage: WebSocketMessage = {
      type: 'challenge_response',
      from: user?.username || '',
      to: fromUsername,
      accepted: true
    };
    ws.send(JSON.stringify(responseMessage));
    setIncomingChallenges(prev => prev.filter(username => username !== fromUsername));
    startNewGameWithOpponent(fromUsername, false);
  };

  const handleRejectChallenge = (fromUsername: string) => {
    if (!ws) return;
    const responseMessage: WebSocketMessage = {
      type: 'challenge_response',
      from: user?.username || '',
      to: fromUsername,
      accepted: false
    };
    ws.send(JSON.stringify(responseMessage));
    setIncomingChallenges(prev => prev.filter(username => username !== fromUsername));
    alert(`Rejected challenge from ${fromUsername}`);
  };

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

  const handleResign = () => {
    if (gameStatus === 'active' && ((isChallenger && game.turn() === 'w') || (!isChallenger && game.turn() === 'b'))) {
      resign();
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
            <div className="game-status">
              {gameStatus === 'active' && <p></p>}
              {gameStatus === 'resigned' && <p>{isChallenger ? 'White' : 'Black'} resigned. {isChallenger ? 'Black' : 'White'} wins!</p>}
              {gameStatus === 'checkmate' && <p>Checkmate! {game.turn() === 'w' ? 'Black' : 'White'} wins!</p>}
              {gameStatus === 'draw' && <p>Game ended in a draw</p>}
            </div>
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
                startNewGame(opponent, true);
              }}>New Game</button>
              <button className="suggest-button" onClick={requestSuggestion}>Suggest</button>
              <button className="go-back-button" onClick={undoLastMove}>Go Back</button>
              <button className="resign-button" onClick={handleResign} disabled={gameStatus !== 'active' || (isChallenger ? game.turn() !== 'w' : game.turn() !== 'b')}>Resign</button>
            </div>
            <div className="board-evaluation-history">
              <div className="board-and-evaluation">
                <Chessboard
                  position={fen}
                  onPieceDrop={onPieceDrop}
                  onSquareClick={onSquareClick}
                  boardOrientation={boardOrientation}
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
            {opponent !== 'stockfish' && (
              <div className="online-players">
                <h3>Online Players</h3>
                {onlineUsers.length > 0 ? (
                  <ul>
                    {onlineUsers
                      .filter((onlineUser: OnlineUser) => onlineUser.username !== user.username)
                      .map((onlineUser: OnlineUser) => (
                        <li className="challenge-user" key={onlineUser.id}>
                          {onlineUser.username}
                          <button className="challenge-button" onClick={() => handleChallenge(onlineUser.username)}>Challenge</button>
                        </li>
                      ))}
                  </ul>
                ) : (
                  <p>No other players online</p>
                )}
              </div>
            )}
            {incomingChallenges.length > 0 && opponent !== 'stockfish' && (
              <div className="incoming-challenges">
                <h4>Incoming Challenges:</h4>
                {incomingChallenges.map((challenger, index) => (
                  <div key={index} className="challenge-item">
                    <span>{challenger} has challenged you to a game.</span>
                    <button className="accept-button" onClick={() => handleAcceptChallenge(challenger)}>Accept</button>
                    <button className="reject-button" onClick={() => handleRejectChallenge(challenger)}>Reject</button>
                  </div>
                ))}
              </div>
            )}
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
