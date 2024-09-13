import express from 'express';
import cors from 'cors';
import { Engine } from 'node-uci';
import { Chess } from 'chess.js';
import axios from 'axios';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { GetMoveRequest, GetMoveResponse } from '../../shared/types';
import { NewGameRequest, NewGameResponse } from '../../shared/types';
import { MoveResponse, MoveRequest } from '../../shared/types';
import { User, UserLoginRequest, UserRegistrationRequest, AuthResponse } from '../../shared/types';

// Initialize Express app and set port
const app = express();
const port = process.env.PORT || 3001;

// Configure CORS for the Express app
app.use(cors({
  origin: 'http://localhost:3000',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

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
async function getStockfishMove(board: string): Promise<{ move: any, evaluation: number }> {
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

async function getNextMove(board: string, opponent: string): Promise<{ move: any, evaluation: number }> {
  switch (opponent) {
    case 'stockfish':
      return getStockfishMove(board);
    case 'chess_tune':
      return getChessTuneMove(board);
    case 'human':
      throw new Error('Human moves should be handled client-side');
    default:
      throw new Error('Invalid opponent type');
  }
}

// Use the interfaces in your route handler
app.post<{}, GetMoveResponse, GetMoveRequest>('/api/get_move', async (req, res) => {
  const { board } = req.body;
  console.log('Received board:', board);
  console.log('Selected opponent:', currentOpponent);

  try {
    if (!currentOpponent) {
      throw new Error('No opponent selected. Please start a new game first.');
    }

    const { move, evaluation } = await getNextMove(board, currentOpponent);
    res.json({ move, evaluation });
  } catch (error) {
    console.error('Error in /api/get_move:', error);
    if (error instanceof Error && error.message.startsWith('Game over')) {
      res.json({ error: error.message.split(': ')[1] });
    } else {
      res.status(500).json({
        error: error instanceof Error ? error.message : "An unknown error occurred"
      });
    }
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
  const { username, password } = req.body;
  
  // Check if user already exists
  const existingUser = users.find(user => user.username === username);
  if (existingUser) {
    return res.status(400).json({ success: false, error: 'Username already exists' });
  }

  // Hash the password
  const hashedPassword = await bcrypt.hash(password, 10);

  // Create new user
  const newUser: User = { id: users.length + 1, username, password: hashedPassword };
  users.push(newUser);

  // Generate JWT token
  const token = jwt.sign({ userId: newUser.id }, 'your-secret-key', { expiresIn: '1h' });

  res.json({ success: true, token });
});

// User login route
app.post<{}, AuthResponse, UserLoginRequest>('/api/login', async (req, res) => {
  const { username, password } = req.body;
  
  // Find user
  const user = users.find(user => user.username === username);
  if (!user) {
    return res.status(400).json({ success: false, error: 'Invalid username or password' });
  }

  // Check password
  const validPassword = await bcrypt.compare(password, user.password);
  if (!validPassword) {
    return res.status(400).json({ success: false, error: 'Invalid username or password' });
  }

  // Generate JWT token
  const token = jwt.sign({ userId: user.id }, 'your-secret-key', { expiresIn: '1h' });

  res.json({ success: true, token });
});

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

// In-memory user storage (replace with a database in a real application)
const users: User[] = [];

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
