import React from 'react';
import { Chessboard } from 'react-chessboard';
import './App.css';

const App: React.FC = () => {
  return (
    <div className="App">
      <h1>Chess Board</h1>
      <div style={{ width: '800px', margin: 'auto' }}>
        <Chessboard />
      </div>
    </div>
  );
};

export default App;
