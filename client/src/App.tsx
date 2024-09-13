import React, { useState, useEffect } from 'react';
import { Chess, Square } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import EvaluationBar from './components/EvaluationBar';
import OpponentSelector from './components/OpponentSelector';
import { GetMoveRequest, GetMoveResponse, SuccessfulGetMoveResponse } from '../../shared/types';
import { MoveRequest, MoveResponse } from '../../shared/types';
import { UserRegistrationRequest, UserLoginRequest, AuthResponse } from '../../shared/types';
import LoginForm from './components/LoginForm';
import RegisterForm from './components/RegisterForm';
import './App.css';

const App: React.FC = () => {
  const [game, setGame] = useState<Chess>(new Chess());
  const [fen, setFen] = useState(game.fen());
  const [selectedPiece, setSelectedPiece] = useState<Square | null>(null);
  const [moveHistory, setMoveHistory] = useState('');
  const [fullHistory, setFullHistory] = useState<string[]>([]);
  const [searchDepth, setSearchDepth] = useState<number>(10);
  const [evaluation, setEvaluation] = useState(0);
  const [suggestedMove, setSuggestedMove] = useState(null);
  const [opponent, setOpponent] = useState<string>('stockfish');
  const [user, setUser] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<{id: string, username: string}[]>([]);
  const boardSize = 600;

  useEffect(() => {
    const fetchOnlineUsers = async () => {
      if (accessToken) {
        try {
          const response = await fetch('http://localhost:3001/api/online-users', {
            headers: {
              'Authorization': `Bearer ${accessToken}`
            }
          });
          if (response.ok) {
            const users = await response.json();
            setOnlineUsers(users);
          } else {
            console.error('Failed to fetch online users');
          }
        } catch (error) {
          console.error('Error fetching online users:', error);
        }
      }
    };

    fetchOnlineUsers();
    const interval = setInterval(fetchOnlineUsers, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [accessToken]);

  const handleRegister = async (username: string, password: string) => {
    console.log('Attempting to register user:', username);
    try {
      const response = await fetch('http://localhost:3001/api/register', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ username, password }),
      });
      console.log('Registration response status:', response.status);
      const data: AuthResponse = await response.json();
      console.log('Registration response data:', data);
      if (data.success && data.accessToken && data.refreshToken) {
        setUser(username);
        setAccessToken(data.accessToken);
        setRefreshToken(data.refreshToken);
        console.log('Registration successful');
      } else {
        console.error('Registration failed:', data.error);
        alert(`Registration failed: ${data.error}`);
      }
    } catch (error) {
      console.error('Registration error:', error);
      alert(`Registration error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleLogin = async (username: string, password: string) => {
    try {
      const response = await fetch('http://localhost:3001/api/login', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ username, password }),
      });
      const data: AuthResponse = await response.json();
      if (data.success && data.accessToken && data.refreshToken) {
        setUser(username);
        setAccessToken(data.accessToken);
        setRefreshToken(data.refreshToken);
      } else {
        console.error('Login failed:', data.error);
      }
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('http://localhost:3001/api/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      });
      setUser(null);
      setAccessToken(null);
      setRefreshToken(null);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const refreshAccessToken = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      });
      const data: AuthResponse = await response.json();
      if (data.success && data.accessToken) {
        setAccessToken(data.accessToken);
        return data.accessToken;
      } else {
        throw new Error('Failed to refresh token');
      }
    } catch (error) {
      console.error('Error refreshing token:', error);
      setUser(null);
      setAccessToken(null);
      setRefreshToken(null);
      throw error;
    }
  };

  const authenticatedFetch = async (url: string, options: RequestInit = {}) => {
    if (!accessToken) {
      throw new Error('No access token available');
    }

    const authOptions = {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${accessToken}`,
      },
    };

    let response = await fetch(url, authOptions);

    if (response.status === 403) {
      // Token might be expired, try to refresh it
      const newToken = await refreshAccessToken();
      authOptions.headers['Authorization'] = `Bearer ${newToken}`;
      response = await fetch(url, authOptions);
    }

    if (!response.ok) {
      throw new Error('Request failed');
    }

    return response;
  };

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
        setSelectedPiece(null);  // Reset selectedPiece after a successful move

        // Inform server about the move
        if (opponent === 'chess_tune') {
          const moveRequest: MoveRequest = { from, to, promotion: 'q', san: result.san };
          const serverResponse = await sendMoveToServer(moveRequest);
          if (!serverResponse.success) {
            console.warn('Server reported an issue:', serverResponse.error);
          }
        }

        return result.san; // Return the move in SAN format
      }
    } catch (error) {
      console.error('Invalid move:', error);
    }
    return null; // Return null for invalid moves
  };

  const sendMoveToServer = async (request: MoveRequest): Promise<MoveResponse> => {
    try {
      const response = await fetch('http://localhost:3001/api/move', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      const data: MoveResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.success === false ? data.error : 'Failed to inform server about the move');
      }

      return data;
    } catch (error) {
      console.error('Error informing server about move:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error occurred' };
    }
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
    if (selectedPiece !== null) {
      // If a piece is already selected, it means onSquareClick will handle the move
      return false;
    }

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

  async function getMoveFromServer(request: GetMoveRequest): Promise<GetMoveResponse> {
    const response = await fetch('http://localhost:3001/api/get_move', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    return response.json();
  }


  async function requestMove() {
    try {
      console.log('Requesting move from server:', game.fen());
      const response: GetMoveResponse = await getMoveFromServer({ board: game.fen(), opponent });

      if ('error' in response) {
        console.error('Server error:', response.error);
        return;
      }

      // At this point, TypeScript knows response is SuccessfulGetMoveResponse
      const { move, evaluation } = response;
      console.log('Received move:', move);

      const { from, to, promotion } = move;

      // Create a new Chess instance
      const newGame = new Chess(game.fen());

      // Add a delay before making the move (e.g., 500ms)
      await new Promise(resolve => setTimeout(resolve, 500));

      // Make the move on the new chess instance
      const result = newGame.move({ from, to, promotion });

      if (result === null) {
        console.error(`Invalid move: ${JSON.stringify(move)}`);
        return;
      }

      // Update the game state
      setGame(newGame);
      setFen(newGame.fen());
      setFullHistory(prevHistory => [...prevHistory, result.san]);

      // Update evaluation
      setEvaluation(evaluation);

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

  const requestNewGame = async (opponent: string): Promise<NewGameResponse> => {
    const request: NewGameRequest = { opponent };
    const response = await fetch('http://localhost:3001/api/new_game', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error('Network response was not ok');
    }

    return await response.json();
  };

  const startNewGame = async () => {
    const newGame = new Chess();
    setGame(newGame);
    setFen(newGame.fen());
    setEvaluation(0); // Reset evaluation to 0
    setMoveHistory(''); // Clear the formatted move history
    setFullHistory([]); // Clear the full history array
    setSuggestedMove(null);
    setSelectedPiece(null); // Reset the selected piece

    try {
      const data = await requestNewGame(opponent);
      if (data.success) {
        console.log('Server informed about new game:', data.message);
      } else {
        console.warn('Server reported an error:', data.error);
      }
    } catch (error) {
      console.error('Error informing server about new game:', error);
    }
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
      {user ? (
        <>
          <div className="welcome-container">
            <h2 className="welcome-message">Welcome {user}!</h2>
            <button className="logout-button" onClick={handleLogout}>Logout</button>
          </div>
          <div className="game-container">
            <div className="foyer">
              <h3>Online Players</h3>
              <ul>
                {onlineUsers.map(user => (
                  <li key={user.id}>{user.username}</li>
                ))}
              </ul>
            </div>
            <div className="board-and-controls">
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
                <button className="new-game-button" onClick={startNewGame}>New Game</button>
                <button className="suggest-button" onClick={requestSuggestion}>Suggest</button>
                <button className="go-back-button" onClick={undoLastMove}>Go Back</button>
              </div>
              <div className="main-game-area">
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
            </div>
          </div>
        </>
      ) : (
        <div className="auth-container">
          <LoginForm onLogin={handleLogin} />
          <RegisterForm onRegister={(username, password) => {
            console.log('Register attempt from App component');
            handleRegister(username, password);
          }} />
        </div>
      )}
    </div>
  );
};

export default App;
