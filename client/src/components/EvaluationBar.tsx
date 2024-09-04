import React from 'react';
import './EvaluationBar.css';

interface EvaluationBarProps {
    evaluation: number;
    boardHeight: number; // Add this prop to receive the chessboard height
}

const EvaluationBar: React.FC<EvaluationBarProps> = ({ evaluation, boardHeight }) => {
    const flippedEvaluation = -evaluation;
    const percentage = Math.min(Math.max((flippedEvaluation + 5) / 10 * 100, 0), 100);

    return (
        <div className="evaluation-bar-container" style={{ height: `${boardHeight}px` }}>
            <div className="evaluation-value">{flippedEvaluation.toFixed(2)}</div>
            <div className="evaluation-bar">
                <div
                    className="evaluation-fill"
                    style={{ height: `${100 - percentage}%` }}
                />
            </div>
        </div>
    );
};

export default EvaluationBar;
