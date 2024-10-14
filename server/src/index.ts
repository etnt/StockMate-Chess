import express from 'express';
import cors from 'cors';
import { Engine } from 'node-uci';
import { Chess } from 'chess.js';
import axios from 'axios';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { GetMoveRequest, GetMoveResponse, SuccessfulGetMoveResponse, ErrorResponse } from '../../shared/types';
import { NewGameRequest, NewGameResponse } from '../../shared/types';
import { MoveResponse, MoveRequest, WebSocketMessage } from '../../shared/types';
import { User, UserLoginRequest, UserRegistrationRequest, AuthResponse, RefreshTokenRequest } from '../../shared/types';
import { initializeDatabase } from './database';
import { createUser, getUser, updateElo } from './database/models/User';
import { addGame, getGames } from './database/models/Game';
import http from 'http';
import WebSocket from 'ws';
import { Move } from 'chess.js';  // Make sure to import the Move type from chess.js

// Initialize Express app and set port
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const port = process.env.PORT || 3001;

// Configure CORS for the Express app
app.use(cors({
  origin: 'http://localhost:3000',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// This is a built-in middleware function provided by Express.js.
// Its purpose is to parse incoming requests with JSON payloads and
// make the parsed data available in req.body.
app.use(express.json());

// Secret keys for JWT
const ACCESS_TOKEN_SECRET = crypto.randomBytes(64).toString('hex');
const REFRESH_TOKEN_SECRET = crypto.randomBytes(64).toString('hex');

// In-memory storage for refresh tokens and online users (replace with a database in production)
let refreshTokens: string[] = [];
const onlineUsers: { [key: string]: { id: string, username: string } } = {};
const wsClients: { [username: string]: WebSocket } = {};

// Add a middleware to log all incoming requests
app.use((req, res, next) => {
  console.log(`Received ${req.method} request to ${req.url}`);
  console.log('Request body:', req.body);
  next();
});

// Initialize Stockfish engine
let engine: Engine;
let searchDepth = 10; // Default search depth

const CHESS_TUNE_URL = 'http://127.0.0.1:5000'; // Update this if the URL is different

// Add this near the top of your file, after other initializations
let currentOpponent: string | null = null;

/**
 * Initialize the Stockfish chess engine.
 */
async function initializeEngine() {
  engine = new Engine('/opt/homebrew/bin/stockfish');
  await engine.init();
  await engine.isready();
  console.log('Stockfish engine initialized');
}

initializeEngine();

/**
 * Set the search depth for the Stockfish engine.
 * 
 * This endpoint allows the client to adjust the search depth of the Stockfish chess engine.
 * A deeper search generally results in stronger moves but takes more time to compute.
 * 
 * @route POST /api/set-depth
 * @param {Object} req.body - The request body
 * @param {number} req.body.depth - The desired search depth (must be a positive number)
 * @returns {Object} JSON response indicating success or failure
 * @returns {boolean} response.success - Indicates whether the depth was successfully set
 * @returns {string} [response.error] - Error message if the depth setting failed
 */
app.post('/api/set-depth', async (req, res) => {
  const { depth } = req.body as { depth: number };
  if (typeof depth === 'number' && depth > 0) {
    searchDepth = depth;
    await engine.setoption('Depth', depth.toString());
    res.json({ success: true });
  } else {
    res.status(400).json({ success: false, error: 'Invalid depth value' });
  }
});

/**
 * Get the next best move from Stockfish for a given board position.
 * @param board - FEN string representing the current board state
 * @returns JSON string of the best move
 */
async function getStockfishMove(board: string): Promise<SuccessfulGetMoveResponse> {
  try {
    await engine.position(board);
    const result = await engine.go({ depth: searchDepth });

    const chess = new Chess(board);
    const moveResult = chess.move(result.bestmove);

    if (!moveResult) {
      throw new Error('Invalid move suggested by Stockfish');
    }

    // Parse the evaluation from Stockfish output
    const lastItem = result.info[result.info.length - 1];
    const lastInfo = typeof lastItem === 'object' ? lastItem as InfoItem : null;

    if (lastInfo && lastInfo.score) {
      const evaluation = parseFloat(lastInfo.score.value) / 100;
      console.log('Suggested move:', moveResult, 'Evaluation:', evaluation);
      return { move: moveResult, evaluation };
    } else {
      console.error('Invalid or missing score information');
      return { move: moveResult, evaluation: 0 };
    }
  } catch (error) {
    console.error('Error getting move from Stockfish:', error);
    throw error;
  }
}

interface InfoItem {
  score: {
    value: string;
  };
}

async function getChessTuneMove(board: string): Promise<{ move: any, evaluation: number }> {
  try {
    // Make a GET request to the ChessTune '/get_move' endpoint
    const response = await axios.get(`${CHESS_TUNE_URL}/get_move`, {
      params: { fen: board }
    });
    const data = response.data;

    switch (data.status) {
      case 'game_over':
        console.log('Game over. Result:', data.result);
        throw new Error(`Game over: ${data.result}`);

      case 'ok':
        console.log('Move received:', data.move);
        // Convert SAN move to the format expected by the client
        const chess = new Chess(board);
        const moveObject = chess.move(data.move);
        console.log('Move object:', moveObject);
        if (!moveObject) {
          throw new Error('Invalid move received from ChessTune');
        }

        // Get evaluation from Stockfish for the new board position
        const evaluation = await getStockfishEvaluation(data.new_fen);
        console.log('Evaluation:', evaluation);

        return {
          move: {
            from: moveObject.from,
            to: moveObject.to,
            promotion: moveObject.promotion
          },
          evaluation
        };

      case 'error':
        throw new Error(data.message || 'Unknown error from ChessTune');

      default:
        throw new Error('Unexpected response from ChessTune');
    }
  } catch (error) {
    console.error('Error getting move from ChessTune:', error);
    throw error;
  }
}

async function getStockfishEvaluation(board: string): Promise<number> {
  try {
    await engine.position(board);
    const result = await engine.go({ depth: searchDepth });

    // Parse the evaluation from Stockfish output
    const lastItem = result.info[result.info.length - 1];
    const lastInfo = typeof lastItem === 'object' ? lastItem as InfoItem : null;

    if (lastInfo && lastInfo.score) {
      return parseFloat(lastInfo.score.value) / 100;
    } else {
      console.error('Invalid or missing score information');
      return 0;
    }
  } catch (error) {
    console.error('Error getting evaluation from Stockfish:', error);
    return 0;
  }
}

async function getNextMove(board: string, opponent: string): Promise<SuccessfulGetMoveResponse> {
  switch (opponent) {
    case 'stockfish':
      return getStockfishMove(board);
    case 'chess_tune':
      return getChessTuneMove(board);
    default:
      throw new Error('Invalid opponent type');
  }
}

app.post('/api/get_move', async (req, res) => {
  const { board, opponent } = req.body;
  console.log(`Received move request. Board: ${board}, Opponent: ${opponent}`);

  if (!opponent) {
    const errorResponse: ErrorResponse = { error: 'No opponent specified' };
    return res.status(400).json(errorResponse);
  }

  try {
    let response: SuccessfulGetMoveResponse;

    if (opponent === 'stockfish') {
      response = await getStockfishMove(board);
    } else {
      const errorResponse: ErrorResponse = { error: 'Invalid opponent' };
      return res.status(400).json(errorResponse);
    }

    res.json(response);
  } catch (error) {
    console.error('Error getting move:', error);
    const errorResponse: ErrorResponse = { error: 'Error getting move' };
    res.status(500).json(errorResponse);
  }
});

/**
 * Suggest the best move for the current board position.
 * POST /api/suggest
 */
app.post('/api/suggest', async (req, res) => {
  try {
    const { board } = req.body;
    console.log('Received board for suggestion:', board);

    if (!board) {
      return res.status(400).json({ error: 'Board position is required' });
    }

    await engine.setoption('Depth', searchDepth.toString());
    const { move, evaluation } = await getNextMove(board, 'stockfish');

    // Convert the move to the format expected by the client
    const suggestedMove = {
      from: move.from,
      to: move.to,
      promotion: move.promotion
    };

    res.json({ move: suggestedMove, evaluation });
  } catch (error) {
    console.error('Error in /api/suggest:', error);
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: "An unknown error occurred" });
    }
  }
});

/**
 * Evaluate the current board position.
 * POST /api/evaluate
 */
app.post('/api/evaluate', async (req, res) => {
  try {
    const { board } = req.body;
    console.log('Received board for evaluation:', board);

    if (!board) {
      return res.status(400).json({ error: 'Board position is required' });
    }

    const evaluation = await getStockfishEvaluation(board);
    console.log('Evaluation:', evaluation);
    res.json({ evaluation });
  } catch (error) {
    console.error('Error in /api/evaluate:', error);
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: "An unknown error occurred" });
    }
  }
});

// Root endpoint
app.get('/', (req, res) => {
  res.send('Hello from Chess Site Backend!');
});

// User registration route
app.post<{}, AuthResponse, UserRegistrationRequest>('/api/register', async (req, res) => {
  console.log('Received registration request');
  const { username, password } = req.body;

  console.log('Registration attempt for username:', username);

  // Check if user already exists
  const existingUser = await getUser(username);
  if (existingUser) {
    console.log('Registration failed: Username already exists');
    return res.status(400).json({ success: false, error: 'Username already exists' });
  }

  try {
    const userId = await createUser(username, password);
    const accessToken = jwt.sign({ userId, username }, ACCESS_TOKEN_SECRET, { expiresIn: '15m' });
    const refreshToken = jwt.sign({ userId, username }, REFRESH_TOKEN_SECRET);
    // Adds the generated refresh token to an array, a more robust solutions
    // (like a database) should be used in production.
    refreshTokens.push(refreshToken);

    console.log('Registration successful, tokens generated');
    res.json({ success: true, accessToken, refreshToken });
  } catch (error) {
    console.error('Error during registration:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// User login route
app.post<{}, AuthResponse, UserLoginRequest>('/api/login', async (req, res) => {
  console.log('Login attempt for username:', req.body.username);
  try {
    const { username, password } = req.body;
    const user = await getUser(username);
    console.log('User found:', user ? 'Yes' : 'No');
    if (user && await bcrypt.compare(password, user.password)) {
      console.log('Password match for user:', username);
      const accessToken = jwt.sign({ userId: user.id, username }, ACCESS_TOKEN_SECRET, { expiresIn: '15m' });
      const refreshToken = jwt.sign({ userId: user.id, username }, REFRESH_TOKEN_SECRET);
      console.log('Tokens generated for user:', username);
      res.json({ success: true, accessToken, refreshToken, username: user.username, elo: user.elo_rating });
      // Broadcast updated online users list
      onlineUsers[user.id] = { id: user.id, username: user.username };
      wsClients[user.username] = (req as any).ws; // Assume WebSocket is attached to request
      broadcastOnlineUsers();
    } else {
      console.log('Login failed for user:', username);
      res.status(401).json({ success: false, error: 'Invalid credentials' });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, error: 'Error logging in' });
  }
});

// Token refresh route
app.post<{}, AuthResponse, RefreshTokenRequest>('/api/token', (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.sendStatus(401);
  if (!refreshTokens.includes(refreshToken)) return res.sendStatus(403);

  jwt.verify(refreshToken, REFRESH_TOKEN_SECRET, (err: any, user: any) => {
    if (err) return res.sendStatus(403);
    const accessToken = generateAccessToken({ id: user.userId, username: user.username });
    res.json({ success: true, accessToken });
  });
});

// Logout route
app.post('/api/logout', authenticateToken, (req: any, res) => {
  const username = req.user.username;
  console.log(`Logout request for user: ${username}`);

  const userIdToRemove = Object.keys(onlineUsers).find(key => onlineUsers[key].username === username);
  if (userIdToRemove) {
    console.log(`Removing user from online users: ${username}`);
    delete onlineUsers[userIdToRemove];
    delete wsClients[username];
    broadcastOnlineUsers();
  } else {
    console.log(`User not found in online users: ${username}`);
  }

  res.json({ success: true, message: 'Logged out successfully' });
});

// Get online users
app.get('/api/online-users', authenticateToken, (req, res) => {
  const users = Object.values(onlineUsers);
  res.json(users);
});

// Start the server
server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

// Helper function to generate access token
function generateAccessToken(user: Pick<User, 'id' | 'username'>) {
  return jwt.sign({ userId: user.id, username: user.username }, ACCESS_TOKEN_SECRET, { expiresIn: '15m' });
}

// Middleware to authenticate token
function authenticateToken(req: any, res: any, next: any) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (token == null) {
    console.log('No token provided');
    return res.sendStatus(401);
  }

  jwt.verify(token, ACCESS_TOKEN_SECRET, (err: any, user: any) => {
    if (err) {
      console.log('Token verification failed:', err.message);
      return res.sendStatus(403);
    }
    console.log('Token verified for user:', user.username);
    req.user = user;
    next();
  });
}

async function applyMoveToChessTune(move: string) {
  try {
    await axios.post(`${CHESS_TUNE_URL}/move`, { move });
  } catch (error) {
    console.error('Error applying move to ChessTune:', error);
    throw error;
  }
}

app.post<{}, MoveResponse, MoveRequest>('/api/move', async (req, res) => {
  try {
    const { from, to, promotion, san } = req.body;
    console.log('Received move from:', from, 'to:', to, 'for opponent:', currentOpponent);

    if (currentOpponent === 'chess_tune') {
      await applyMoveToChessTune(san);
      res.json({ success: true, message: 'Move applied to ChessTune successfully' } as MoveResponse);
    } else {
      res.json({ success: true, message: 'Move received successfully' } as MoveResponse);
    }
  } catch (error) {
    console.error('Error processing move:', error);
    res.status(500).json({ success: false, error: 'Failed to process the move' } as MoveResponse);
  }
});

// Update the new game route
app.post<{}, NewGameResponse, NewGameRequest>('/api/new_game', async (req, res) => {
  const { opponent } = req.body;
  console.log('New game started with opponent:', opponent);

  try {
    // Store the opponent
    currentOpponent = opponent;

    // Reset the game state for the specified opponent
    if (opponent === 'chess_tune') {
      await axios.post(`${CHESS_TUNE_URL}/init`);
    }
    // Add any other opponent-specific reset logic here

    // Reset the Stockfish engine
    await engine.ucinewgame();

    res.json({ success: true, message: `New game started with ${opponent}` });
  } catch (error) {
    console.error('Error starting new game:', error);
    res.status(500).json({ success: false, error: 'Failed to start new game' });
  }
});

// Add a route to end the game and reset the opponent
app.post('/api/end_game', (req, res) => {
  currentOpponent = null;
  res.json({ success: true, message: 'Game ended and opponent reset' });
});

app.get('/api/user', authenticateToken, async (req: any, res) => {
  console.log('Authenticated user requesting data:', req.user);
  try {
    const user = await getUser(req.user.username);
    if (user) {
      console.log('User data found for:', user.username);
      res.json({
        success: true,
        username: user.username,
        elo: user.elo_rating
      });
    } else {
      console.log('No user data found for:', req.user.username);
      res.status(404).json({ success: false, error: 'User not found' });
    }
  } catch (error) {
    console.error('Error fetching user data:', error);
    res.status(500).json({ success: false, error: 'Error fetching user data' });
  }
});

wss.on('connection', (ws: WebSocket) => {
  const userId = uuidv4();
  let username: string | null = null;

  console.log(`New WebSocket connection established. UserId: ${userId}`);

  ws.on('message', (message: string) => {
    console.log(`Received message: ${message}`);
    const data: WebSocketMessage = JSON.parse(message);
    if (data.type === 'login' && typeof data.username === 'string') {
      console.log(`User logging in: ${data.username}`);
      // Remove any existing entries for this user
      Object.keys(onlineUsers).forEach(key => {
        if (onlineUsers[key].username === data.username) {
          console.log(`Removing existing user: ${data.username}`);
          delete onlineUsers[key];
          delete wsClients[data.username];
        }
      });
      username = data.username;
      onlineUsers[userId] = { id: userId, username: data.username };
      wsClients[username] = ws;
      console.log(`Added user to online users: ${JSON.stringify(onlineUsers[userId])}`);
      broadcastOnlineUsers();
    } else if (data.type === 'challenge' && data.from && data.to) {
      console.log(`Challenge from ${data.from} to ${data.to}`);
      const targetWs = wsClients[data.to];
      if (targetWs && targetWs.readyState === WebSocket.OPEN) {
        const challengeReceived: WebSocketMessage = {
          type: 'challenge_received',
          from: data.from
        };
        targetWs.send(JSON.stringify(challengeReceived));
        console.log(`Sent challenge_received to ${data.to}`);
      } else {
        console.log(`User ${data.to} is not online`);
      }
    } else if (data.type === 'challenge_response' && data.from && data.to !== undefined) {
      console.log(`Challenge response from ${data.from} to ${data.to}: ${data.accepted}`);
      const challengerWs = wsClients[data.to];
      if (challengerWs && challengerWs.readyState === WebSocket.OPEN) {
        const challengeResponse: WebSocketMessage = {
          type: 'challenge_response',
          from: data.from,
          to: data.to,
          accepted: data.accepted
        };
        challengerWs.send(JSON.stringify(challengeResponse));
        console.log(`Sent challenge_response to ${data.to}`);

        if (data.accepted) {
          const startGame: WebSocketMessage = {
            type: 'start_game',
            opponent: data.from
          };
          challengerWs.send(JSON.stringify(startGame));
          ws.send(JSON.stringify(startGame));
          console.log(`Started game between ${data.from} and ${data.to}`);
        }
      } else {
        console.log(`Challenger ${data.to} is not online`);
      }
    }
  });

  ws.on('close', () => {
    console.log(`WebSocket connection closed. UserId: ${userId}`);
    if (username) {
      console.log(`Removing user from online users: ${username}`);
      delete onlineUsers[username];
      delete wsClients[username];
      broadcastOnlineUsers();
    }
  });

  // Send the initial list of online users to the newly connected client
  ws.send(JSON.stringify({ type: 'onlineUsers', users: Object.values(onlineUsers) }));
});

function broadcastOnlineUsers() {
  // Use a Set to ensure unique usernames
  const uniqueUsers = new Set(Object.values(onlineUsers).map(user => JSON.stringify(user)));
  const users = Array.from(uniqueUsers).map(user => JSON.parse(user));
  console.log(`Broadcasting online users: ${JSON.stringify(users)}`);
  const message = JSON.stringify({ type: 'onlineUsers', users });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

initializeDatabase().then(() => {
  console.log('Database initialized');
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
