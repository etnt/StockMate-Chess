import express from 'express';
import cors from 'cors';
import { Engine } from 'node-uci';
import { Chess } from 'chess.js';
import axios from 'axios'; // Make sure to install axios: npm install axios

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
 * POST /api/set-depth
 */
app.post('/api/set-depth', async (req, res) => {
  const { depth } = req.body;
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
    // Get the move from ChessTune
    const response = await axios.get(`${CHESS_TUNE_URL}/get_move`);
    const chessTuneMove = response.data.move;

    // Convert the move to the format expected by the client
    const chess = new Chess(board);
    const moveObject = chess.move(chessTuneMove);

    if (!moveObject) {
      throw new Error('Invalid move suggested by ChessTune');
    }

    return { move: moveObject, evaluation: 0 }; // ChessTune doesn't provide evaluation
  } catch (error) {
    console.error('Error getting move from ChessTune:', error);
    throw error;
  }
}

async function getNextMove(board: string, opponent: string): Promise<{ move: any, evaluation: number }> {
  switch (opponent) {
    case 'stockfish':
      return getStockfishMove(board);
    case 'chesstune':
      return getChessTuneMove(board);
    case 'human':
      throw new Error('Human moves should be handled client-side');
    default:
      throw new Error('Invalid opponent type');
  }
}

/**
 * Get the next move from the selected opponent for a given board position.
 * POST /api/move
 */
app.post('/api/move', async (req, res) => {
  try {
    const { board, opponent } = req.body;
    console.log('Received board:', board);
    console.log('Selected opponent:', opponent);

    if (!board || !opponent) {
      return res.status(400).json({ error: 'Board position and opponent are required' });
    }

    const { move, evaluation } = await getNextMove(board, opponent);
    res.json({ move, evaluation });
  } catch (error) {
    console.error('Error in /api/move:', error);
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: "An unknown error occurred" });
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

    await engine.setoption('Depth', searchDepth.toString());
    await engine.position(board);
    const result = await engine.go({ depth: searchDepth });

    // Parse the evaluation from Stockfish output
    const lastItem = result.info[result.info.length - 1];
    const lastInfo = typeof lastItem === 'object' ? lastItem as InfoItem : null;

    if (lastInfo && lastInfo.score) {
      const evaluation = parseFloat(lastInfo.score.value) / 100;
      console.log('Evaluation:', evaluation);
      res.json({ evaluation });
    } else {
      console.error('Invalid or missing score information');
      res.status(500).json({ error: 'Unable to evaluate position' });
    }
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

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

async function applyMoveToChessTune(move: string) {
  try {
    await axios.post(`${CHESS_TUNE_URL}/move`, { move });
  } catch (error) {
    console.error('Error applying move to ChessTune:', error);
    throw error;
  }
}

app.post('/api/inform-chesstune', async (req, res) => {
  try {
    const { move } = req.body;
    if (!move) {
      return res.status(400).json({ error: 'Move is required' });
    }
    await applyMoveToChessTune(move);
    res.json({ message: 'Move applied to ChessTune successfully' });
  } catch (error) {
    console.error('Error informing ChessTune about move:', error);
    res.status(500).json({ error: 'Failed to inform ChessTune about the move' });
  }
});
