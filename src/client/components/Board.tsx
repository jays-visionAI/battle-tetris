import { BOARD_WIDTH, BOARD_HEIGHT } from '../game/constants';

interface BoardProps {
  board: (string | null)[][];
  currentPiece?: { shape: boolean[][]; color: string; position: { x: number; y: number } } | null;
  isOpponent?: boolean;
  showNextPiece?: boolean;
  nextPieceColor?: string;
  attackAnimation?: number;
}

export function Board({ 
  board, 
  currentPiece, 
  isOpponent = false,
  nextPieceColor,
  attackAnimation
}: BoardProps) {
  const scale = isOpponent ? 0.6 : 1;
  const cellSize = 30 * scale;

  // 현재 조각을 포함한 표시용 보드 생성
  const displayBoard = board.map(row => [...row]);

  if (currentPiece) {
    const { shape, color, position } = currentPiece;
    for (let y = 0; y < shape.length; y++) {
      for (let x = 0; x < shape[y].length; x++) {
        if (shape[y][x]) {
          const boardY = position.y + y;
          const boardX = position.x + x;
          if (boardY >= 0 && boardY < BOARD_HEIGHT && boardX >= 0 && boardX < BOARD_WIDTH) {
            displayBoard[boardY][boardX] = color;
          }
        }
      }
    }
  }

  return (
    <div 
      className={`board ${isOpponent ? 'opponent-board' : 'player-board'} ${attackAnimation ? 'attacked' : ''}`}
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${BOARD_WIDTH}, ${cellSize}px)`,
        gridTemplateRows: `repeat(${BOARD_HEIGHT}, ${cellSize}px)`,
        gap: '1px',
        backgroundColor: '#1a1a2e',
        padding: '4px',
        borderRadius: '4px',
        border: isOpponent ? '2px solid #333' : '3px solid #00FFFF',
        boxShadow: isOpponent ? 'none' : '0 0 20px rgba(0, 255, 255, 0.3)',
      }}
    >
      {displayBoard.map((row, y) =>
        row.map((cell, x) => (
          <div
            key={`${x}-${y}`}
            style={{
              width: `${cellSize}px`,
              height: `${cellSize}px`,
              backgroundColor: cell || '#0a0a1a',
              border: cell ? '1px solid rgba(255,255,255,0.3)' : '1px solid #2a2a4e',
              borderRadius: '2px',
              boxShadow: cell ? `inset 0 0 10px rgba(255,255,255,0.2), 0 0 5px ${cell}` : 'none',
              transition: attackAnimation ? 'background-color 0.1s' : 'none',
            }}
          />
        ))
      )}
    </div>
  );
}

export default Board;
