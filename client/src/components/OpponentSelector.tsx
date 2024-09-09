import React from 'react';
import './OpponentSelector.css'; // Make sure to create this CSS file

interface OpponentSelectorProps {
    opponent: string;
    setOpponent: (opponent: string) => void;
}

const OpponentSelector: React.FC<OpponentSelectorProps> = ({ opponent, setOpponent }) => {
    return (
        <div className="opponent-selector">
            <label htmlFor="opponent-select">Opponent:</label>
            <select
                id="opponent-select"
                value={opponent}
                onChange={(e) => setOpponent(e.target.value)}
            >
                <option value="stockfish">Stockfish</option>
                <option value="chess_tune">ChessTune</option>
                <option value="human">Human Player</option>
            </select>
        </div>
    );
};

export default OpponentSelector;
