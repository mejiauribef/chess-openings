import { useEffect, useState } from 'react';
import { Chessboard } from 'react-chessboard';
import { applyUciLine } from '@/lib/chess/openingGraph';

interface BoardPanelProps {
  title: string;
  uciMoves: string[];
}

export function BoardPanel({ title, uciMoves }: BoardPanelProps) {
  const [currentPly, setCurrentPly] = useState(uciMoves.length);

  useEffect(() => {
    setCurrentPly(uciMoves.length);
  }, [uciMoves]);

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTypingTarget = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || !!target?.isContentEditable;
      if (isTypingTarget) {
        return;
      }

      if (event.key === 'ArrowLeft') {
        setCurrentPly((value) => Math.max(0, value - 1));
      }

      if (event.key === 'ArrowRight') {
        setCurrentPly((value) => Math.min(uciMoves.length, value + 1));
      }
    };

    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [uciMoves.length]);

  const position = applyUciLine(uciMoves.slice(0, currentPly));

  return (
    <div className="board-panel">
      <div className="board-panel__heading">
        <h3>{title}</h3>
        <div className="board-panel__controls">
          <button type="button" onClick={() => setCurrentPly(0)}>
            Inicio
          </button>
          <button type="button" onClick={() => setCurrentPly((value) => Math.max(0, value - 1))}>
            Atras
          </button>
          <button
            type="button"
            onClick={() => setCurrentPly((value) => Math.min(uciMoves.length, value + 1))}
          >
            Adelante
          </button>
          <button type="button" onClick={() => setCurrentPly(uciMoves.length)}>
            Final
          </button>
        </div>
      </div>
      <div className="board-panel__board">
        <Chessboard arePiecesDraggable={false} position={position.fen} boardWidth={320} />
      </div>
      <ol className="board-panel__moves">
        {position.sanMoves.map((move, index) => (
          <li key={`${move}-${index}`}>{move}</li>
        ))}
      </ol>
    </div>
  );
}

