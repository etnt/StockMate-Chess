import express from 'express';
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());  // Enable CORS for all routes
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Hello from Chess Site Backend!');
});

app.get('/api/game', (req, res) => {
  res.json({
    message: "This is a test response from the /api/game route",
    gameState: {
      board: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR",
      turn: "white",
      moveCount: 0
    }
  });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
