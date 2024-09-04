import express from 'express';
import cors from 'cors';
import { Engine } from 'node-uci';
import { Chess } from 'chess.js';

const app = express();
const port = process.env.PORT || 3001;

app.use(cors({
  origin: 'http://localhost:3000',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Initialize the Stockfish engine
let engine: Engine;
let searchDepth = 10; // Default depth

async function initializeEngine() {
  engine = new Engine('/opt/homebrew/bin/stockfish');
  await engine.init();
  await engine.isready();
  console.log('Stockfish engine initialized');
}

initializeEngine();

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

async function getNextMove(board: string): Promise<string> {
  try {
    await engine.position(board);
    const result = await engine.go({ depth: searchDepth });

    const chess = new Chess(board);
    const moveResult = chess.move(result.bestmove);

    if (!moveResult) {
      throw new Error('Invalid move suggested by Stockfish');
    }

    console.log('Valid move:', moveResult);
    return JSON.stringify(moveResult);
  } catch (error) {
    console.error('Error getting move from Stockfish:', error);
    throw error;
  }
}

app.post('/api/move', async (req, res) => {
  try {
    const { board } = req.body;
    console.log('Received board:', board);
    await engine.setoption('Depth', searchDepth.toString());
    const moveString = await getNextMove(board);
    const move = JSON.parse(moveString);
    res.json({ move });
  } catch (error) {
    console.error('Error in /api/move:', error);
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: "An unknown error occurred" });
    }
  }
});

app.get('/', (req, res) => {
  res.send('Hello from Chess Site Backend!');
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
