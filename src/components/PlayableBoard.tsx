import { useCallback, useEffect, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import type { Square } from 'react-chessboard/dist/chessboard/types';
import type { TrainingMode } from '@/domain/training';
import type { TheoryNote } from '@/domain/opening';
import { uciToMove } from '@/lib/chess/openingGraph';

interface PlayableBoardProps {
  lineMoves: string[];
  playerColor: 'white' | 'black';
  mode: TrainingMode;
  opponentDelay: number;
  autoRetryDelay: number;
  hintsEnabled: boolean;
  theoryNote?: TheoryNote;
  onLineComplete: (result: { mistakes: number; completed: boolean }) => void;
}

type FeedbackState = 'idle' | 'correct' | 'wrong' | 'complete';

function squareStyle(color: string): React.CSSProperties {
  return { background: color, borderRadius: '50%' };
}

export function PlayableBoard({
  lineMoves,
  playerColor,
  mode,
  opponentDelay,
  autoRetryDelay,
  hintsEnabled,
  theoryNote,
  onLineComplete,
}: PlayableBoardProps) {
  const chessRef = useRef(new Chess());
  const [currentPly, setCurrentPly] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [feedbackState, setFeedbackState] = useState<FeedbackState>('idle');
  const [customSquareStyles, setCustomSquareStyles] = useState<Record<string, React.CSSProperties>>({});
  const [customArrows, setCustomArrows] = useState<[Square, Square, string?][]>([]);
  const [boardWidth, setBoardWidth] = useState(400);
  const containerRef = useRef<HTMLDivElement>(null);
  const lineCompleteCalledRef = useRef(false);
  const [fen, setFen] = useState(chessRef.current.fen());

  // Reset state when lineMoves change
  useEffect(() => {
    const chess = new Chess();
    chessRef.current = chess;
    setCurrentPly(0);
    setMistakes(0);
    setSelectedSquare(null);
    setFeedbackState('idle');
    setCustomSquareStyles({});
    setCustomArrows([]);
    setFen(chess.fen());
    lineCompleteCalledRef.current = false;
  }, [lineMoves]);

  // Responsive board sizing
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = Math.min(480, Math.floor(entry.contentRect.width));
        setBoardWidth(width);
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const isPlayerTurn = useCallback(() => {
    const sideToMove = chessRef.current.turn();
    return (playerColor === 'white' && sideToMove === 'w') ||
      (playerColor === 'black' && sideToMove === 'b');
  }, [playerColor]);

  const advancePly = useCallback(() => {
    setCurrentPly((prev) => prev + 1);
  }, []);

  // Show learn mode hint
  useEffect(() => {
    if (mode !== 'learn' || !hintsEnabled || feedbackState !== 'idle') {
      setCustomSquareStyles({});
      return;
    }

    if (!isPlayerTurn()) return;

    const expectedUci = lineMoves[currentPly];
    if (!expectedUci) return;

    const { from } = uciToMove(expectedUci);
    setCustomSquareStyles({
      [from]: { background: 'rgba(245, 158, 11, 0.4)', borderRadius: '4px' },
    });
  }, [mode, hintsEnabled, currentPly, lineMoves, isPlayerTurn, feedbackState]);

  // Show legal move dots when a piece is selected (click-to-move)
  useEffect(() => {
    if (!selectedSquare) return;

    const chess = chessRef.current;
    const moves = chess.moves({ square: selectedSquare, verbose: true });
    const styles: Record<string, React.CSSProperties> = {
      [selectedSquare]: { background: 'rgba(245, 158, 11, 0.5)' },
    };

    for (const move of moves) {
      styles[move.to] = squareStyle('rgba(34, 197, 94, 0.4)');
    }

    setCustomSquareStyles(styles);
  }, [selectedSquare]);

  // Opponent auto-play
  useEffect(() => {
    if (currentPly >= lineMoves.length) return;
    if (isPlayerTurn()) return;
    if (feedbackState !== 'idle') return;

    const timer = setTimeout(() => {
      const chess = chessRef.current;
      const expectedUci = lineMoves[currentPly];
      if (!expectedUci) return;

      const moveObj = uciToMove(expectedUci);
      const result = chess.move(moveObj);
      if (!result) return;

      setFen(chess.fen());
      advancePly();
    }, opponentDelay);

    return () => clearTimeout(timer);
  }, [currentPly, lineMoves, isPlayerTurn, opponentDelay, feedbackState, advancePly]);

  // Line complete detection
  useEffect(() => {
    if (currentPly >= lineMoves.length && lineMoves.length > 0 && !lineCompleteCalledRef.current) {
      lineCompleteCalledRef.current = true;
      setFeedbackState('complete');
      onLineComplete({ mistakes, completed: true });
    }
  }, [currentPly, lineMoves.length, mistakes, onLineComplete]);

  function attemptMove(from: string, to: string, promotion?: string): boolean {
    if (!isPlayerTurn()) return false;
    if (feedbackState !== 'idle') return false;

    const expectedUci = lineMoves[currentPly];
    if (!expectedUci) return false;

    const chess = chessRef.current;
    const moveResult = chess.move({
      from,
      to,
      promotion: (promotion as 'n' | 'b' | 'r' | 'q') ?? undefined,
    });

    if (!moveResult) return false;

    const playedUci = `${from}${to}${moveResult.promotion ?? ''}`;

    if (playedUci === expectedUci) {
      // Correct move
      setFeedbackState('correct');
      setFen(chess.fen());
      setSelectedSquare(null);
      setCustomArrows([]);
      setCustomSquareStyles({});

      setTimeout(() => {
        setFeedbackState('idle');
        advancePly();
      }, 300);

      return true;
    }

    // Wrong move
    setMistakes((prev) => prev + 1);

    if (mode === 'drill') {
      // Drill mode: wrong ends the line
      chess.undo();
      setFen(chess.fen());
      setFeedbackState('wrong');
      setSelectedSquare(null);

      const expected = uciToMove(expectedUci);
      setCustomArrows([[expected.from as Square, expected.to as Square, 'rgba(34, 197, 94, 0.7)']]);

      setTimeout(() => {
        setFeedbackState('idle');
        setCustomArrows([]);
        lineCompleteCalledRef.current = true;
        onLineComplete({ mistakes: mistakes + 1, completed: false });
      }, autoRetryDelay);

      return false;
    }

    // Learn/Practice: undo and let retry
    chess.undo();
    setFen(chess.fen());
    setFeedbackState('wrong');
    setSelectedSquare(null);

    const expected = uciToMove(expectedUci);
    setCustomArrows([[expected.from as Square, expected.to as Square, 'rgba(34, 197, 94, 0.7)']]);

    setTimeout(() => {
      setFeedbackState('idle');
      setCustomArrows([]);
      setCustomSquareStyles({});
    }, autoRetryDelay);

    return false;
  }

  function onPieceDrop(sourceSquare: Square, targetSquare: Square, piece: string): boolean {
    const promotion = piece[1]?.toLowerCase();
    return attemptMove(sourceSquare, targetSquare, promotion === 'p' ? undefined : undefined);
  }

  function onSquareClick(square: Square) {
    if (!isPlayerTurn() || feedbackState !== 'idle') return;

    if (selectedSquare) {
      if (selectedSquare === square) {
        setSelectedSquare(null);
        setCustomSquareStyles({});
        return;
      }

      const success = attemptMove(selectedSquare, square);
      if (!success) {
        // Try selecting the clicked square instead
        const chess = chessRef.current;
        const piece = chess.get(square);
        const playerSide = playerColor === 'white' ? 'w' : 'b';
        if (piece && piece.color === playerSide) {
          setSelectedSquare(square);
        } else {
          setSelectedSquare(null);
          setCustomSquareStyles({});
        }
      }
      return;
    }

    // Select the piece if it belongs to the player
    const chess = chessRef.current;
    const piece = chess.get(square);
    const playerSide = playerColor === 'white' ? 'w' : 'b';
    if (piece && piece.color === playerSide) {
      setSelectedSquare(square);
    }
  }

  function onPromotionPieceSelect(
    piece?: string,
    promoteFromSquare?: Square,
    promoteToSquare?: Square,
  ): boolean {
    if (!piece || !promoteFromSquare || !promoteToSquare) return false;
    const promotion = piece[1]?.toLowerCase();
    return attemptMove(promoteFromSquare, promoteToSquare, promotion);
  }

  const feedbackClass =
    feedbackState === 'correct'
      ? 'playable-board__feedback playable-board__feedback--correct'
      : feedbackState === 'wrong'
        ? 'playable-board__feedback playable-board__feedback--wrong'
        : feedbackState === 'complete'
          ? 'playable-board__feedback playable-board__feedback--complete'
          : 'playable-board__feedback';

  const feedbackText =
    feedbackState === 'correct'
      ? 'Correcto!'
      : feedbackState === 'wrong'
        ? mode === 'drill'
          ? 'Incorrecto - linea terminada'
          : 'Incorrecto - intenta de nuevo'
        : feedbackState === 'complete'
          ? mistakes === 0
            ? 'Linea completada sin errores!'
            : `Linea completada con ${mistakes} error(es)`
          : '';

  return (
    <div className="playable-board" ref={containerRef}>
      <div className={feedbackClass}>
        {feedbackText && <p>{feedbackText}</p>}
      </div>

      <Chessboard
        position={fen}
        boardOrientation={playerColor}
        arePiecesDraggable={isPlayerTurn() && feedbackState === 'idle'}
        isDraggablePiece={({ piece }) => {
          const side = playerColor === 'white' ? 'w' : 'b';
          return piece[0] === side;
        }}
        onPieceDrop={onPieceDrop}
        onSquareClick={onSquareClick}
        onPromotionPieceSelect={onPromotionPieceSelect}
        customArrowColor="rgba(34, 197, 94, 0.7)"
        customArrows={customArrows}
        customSquareStyles={customSquareStyles}
        animationDuration={200}
        boardWidth={boardWidth}
      />

      {mode === 'learn' && hintsEnabled && theoryNote?.summary ? (
        <p className="playable-board__theory">{theoryNote.summary}</p>
      ) : null}
    </div>
  );
}
