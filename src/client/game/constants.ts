// Constants for the Tetris game

export const BOARD_WIDTH = 10;
export const BOARD_HEIGHT = 20;

export const COLORS = {
  I: '#00FFFF',
  O: '#FFFF00',
  T: '#FF00FF',
  S: '#00FF00',
  Z: '#FF0000',
  J: '#0000FF',
  L: '#FF8000',
} as const;

// Tetromino shapes - standard 4 rotation states for each piece
export const TETROMINOES: Record<string, boolean[][][]> = {
  I: [
    [
      [false, false, false, false],
      [true, true, true, true],
      [false, false, false, false],
      [false, false, false, false],
    ],
    [
      [false, false, true, false],
      [false, false, true, false],
      [false, false, true, false],
      [false, false, true, false],
    ],
    [
      [false, false, false, false],
      [false, false, false, false],
      [true, true, true, true],
      [false, false, false, false],
    ],
    [
      [false, true, false, false],
      [false, true, false, false],
      [false, true, false, false],
      [false, true, false, false],
    ],
  ],
  O: [
    [
      [true, true],
      [true, true],
    ],
    [
      [true, true],
      [true, true],
    ],
    [
      [true, true],
      [true, true],
    ],
    [
      [true, true],
      [true, true],
    ],
  ],
  T: [
    [
      [false, true, false],
      [true, true, true],
      [false, false, false],
    ],
    [
      [false, true, false],
      [false, true, true],
      [false, true, false],
    ],
    [
      [false, false, false],
      [true, true, true],
      [false, true, false],
    ],
    [
      [false, true, false],
      [true, true, false],
      [false, true, false],
    ],
  ],
  S: [
    [
      [false, true, true],
      [true, true, false],
      [false, false, false],
    ],
    [
      [false, true, false],
      [false, true, true],
      [false, false, true],
    ],
    [
      [false, false, false],
      [false, true, true],
      [true, true, false],
    ],
    [
      [true, false, false],
      [true, true, false],
      [false, true, false],
    ],
  ],
  Z: [
    [
      [true, true, false],
      [false, true, true],
      [false, false, false],
    ],
    [
      [false, false, true],
      [false, true, true],
      [false, true, false],
    ],
    [
      [false, false, false],
      [true, true, false],
      [false, true, true],
    ],
    [
      [false, true, false],
      [true, true, false],
      [true, false, false],
    ],
  ],
  J: [
    [
      [true, false, false],
      [true, true, true],
      [false, false, false],
    ],
    [
      [false, true, true],
      [false, true, false],
      [false, true, false],
    ],
    [
      [false, false, false],
      [true, true, true],
      [false, false, true],
    ],
    [
      [false, true, false],
      [false, true, false],
      [true, true, false],
    ],
  ],
  L: [
    [
      [false, false, true],
      [true, true, true],
      [false, false, false],
    ],
    [
      [false, true, false],
      [false, true, false],
      [false, true, true],
    ],
    [
      [false, false, false],
      [true, true, true],
      [true, false, false],
    ],
    [
      [true, true, false],
      [false, true, false],
      [false, true, false],
    ],
  ],
};

export const PIECE_TYPES = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'] as const;

export type PieceType = typeof PIECE_TYPES[number];

export interface Position {
  x: number;
  y: number;
}

export interface Tetromino {
  type: PieceType;
  shape: boolean[][];
  position: Position;
  color: string;
}

export interface LineClearEvent {
  lines: number;
  clearedRows: number[];
}

// 7-bag randomizer for fair piece distribution
export function createBag(): PieceType[] {
  const shuffled = [...PIECE_TYPES].sort(() => Math.random() - 0.5);
  return shuffled as PieceType[];
}

export function getColor(type: PieceType): string {
  return COLORS[type];
}
