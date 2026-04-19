import {
  BOARD_WIDTH,
  BOARD_HEIGHT,
  TETROMINOES,
  PieceType,
  Tetromino,
  Position,
  createBag,
  getColor,
} from './constants';

export interface GameState {
  board: (string | null)[][];
  currentPiece: Tetromino | null;
  nextPiece: Tetromino | null;
  score: number;
  level: number;
  lines: number;
  gameOver: boolean;
  paused: boolean;
}

export interface AttackResult {
  linesAdded: number;
  attackerScore: number;
}

export type GameEventType = 'line_clear' | 'attack_sent' | 'attack_received' | 'game_over';

export interface GameEvent {
  type: GameEventType;
  data: unknown;
}

export type GameEventCallback = (event: GameEvent) => void;

export class TetrisGame {
  private board: (string | null)[][];
  private currentPiece: Tetromino | null = null;
  private nextPiece: Tetromino | null = null;
  private bag: PieceType[] = [];
  private score: number = 0;
  private level: number = 1;
  private lines: number = 0;
  private gameOver: boolean = false;
  private paused: boolean = false;
  private dropInterval: number = 1000;
  private lastDropTime: number = 0;
  private eventCallbacks: GameEventCallback[] = [];

  constructor() {
    this.board = this.createEmptyBoard();
  }

  private createEmptyBoard(): (string | null)[][] {
    return Array.from({ length: BOARD_HEIGHT }, () =>
      Array(BOARD_WIDTH).fill(null)
    );
  }

  private refillBag(): void {
    if (this.bag.length < 2) {
      this.bag = [...this.bag, ...createBag()];
    }
  }

  private getNextPieceType(): PieceType {
    this.refillBag();
    return this.bag.shift()!;
  }

  private createTetromino(type: PieceType): Tetromino {
    const shape = TETROMINOES[type][0];
    return {
      type,
      shape,
      position: { x: Math.floor((BOARD_WIDTH - shape[0].length) / 2), y: 0 },
      color: getColor(type),
    };
  }

  private spawnPiece(): boolean {
    this.refillBag();
    
    if (this.nextPiece) {
      this.currentPiece = this.nextPiece;
    } else {
      this.currentPiece = this.createTetromino(this.getNextPieceType());
    }
    
    this.nextPiece = this.createTetromino(this.getNextPieceType());

    if (this.checkCollision(this.currentPiece.shape, this.currentPiece.position)) {
      this.gameOver = true;
      this.emitEvent({ type: 'game_over', data: { winner: false } });
      return false;
    }

    return true;
  }

  private checkCollision(shape: boolean[][], position: Position): boolean {
    for (let y = 0; y < shape.length; y++) {
      for (let x = 0; x < shape[y].length; x++) {
        if (shape[y][x]) {
          const boardX = position.x + x;
          const boardY = position.y + y;

          if (boardX < 0 || boardX >= BOARD_WIDTH || boardY >= BOARD_HEIGHT) {
            return true;
          }

          if (boardY >= 0 && this.board[boardY][boardX] !== null) {
            return true;
          }
        }
      }
    }
    return false;
  }

  private lockPiece(): void {
    if (!this.currentPiece) return;

    const { shape, position, color } = this.currentPiece;

    for (let y = 0; y < shape.length; y++) {
      for (let x = 0; x < shape[y].length; x++) {
        if (shape[y][x]) {
          const boardY = position.y + y;
          const boardX = position.x + x;

          if (boardY >= 0 && boardY < BOARD_HEIGHT && boardX >= 0 && boardX < BOARD_WIDTH) {
            this.board[boardY][boardX] = color;
          }
        }
      }
    }

    this.clearLines();
    this.spawnPiece();
  }

  private clearLines(): number {
    const clearedRows: number[] = [];

    for (let y = BOARD_HEIGHT - 1; y >= 0; y--) {
      if (this.board[y].every(cell => cell !== null)) {
        clearedRows.push(y);
      }
    }

    if (clearedRows.length > 0) {
      // Remove cleared rows
      for (const row of clearedRows) {
        this.board.splice(row, 1);
        this.board.unshift(Array(BOARD_WIDTH).fill(null));
      }

      // Update score based on lines cleared
      const lineScores = [0, 100, 300, 500, 800];
      this.score += lineScores[clearedRows.length] * this.level;
      this.lines += clearedRows.length;

      // Level up every 10 lines
      this.level = Math.floor(this.lines / 10) + 1;
      this.dropInterval = Math.max(100, 1000 - (this.level - 1) * 100);

      // Emit line clear event
      this.emitEvent({
        type: 'line_clear',
        data: { lines: clearedRows.length, rows: clearedRows, score: this.score },
      });

      // Send attack to opponent
      if (clearedRows.length > 0) {
        this.emitEvent({
          type: 'attack_sent',
          data: { lines: clearedRows.length },
        });
      }
    }

    return clearedRows.length;
  }

  moveLeft(): boolean {
    if (!this.currentPiece || this.gameOver || this.paused) return false;

    const newPos = { ...this.currentPiece.position, x: this.currentPiece.position.x - 1 };
    
    if (!this.checkCollision(this.currentPiece.shape, newPos)) {
      this.currentPiece.position = newPos;
      return true;
    }
    return false;
  }

  moveRight(): boolean {
    if (!this.currentPiece || this.gameOver || this.paused) return false;

    const newPos = { ...this.currentPiece.position, x: this.currentPiece.position.x + 1 };
    
    if (!this.checkCollision(this.currentPiece.shape, newPos)) {
      this.currentPiece.position = newPos;
      return true;
    }
    return false;
  }

  moveDown(): boolean {
    if (!this.currentPiece || this.gameOver || this.paused) return false;

    const newPos = { ...this.currentPiece.position, y: this.currentPiece.position.y + 1 };
    
    if (!this.checkCollision(this.currentPiece.shape, newPos)) {
      this.currentPiece.position = newPos;
      return true;
    }
    
    this.lockPiece();
    return false;
  }

  rotate(): boolean {
    if (!this.currentPiece || this.gameOver || this.paused) return false;

    const type = this.currentPiece.type;
    const currentRotation = TETROMINOES[type].indexOf(this.currentPiece.shape);
    const nextRotation = (currentRotation + 1) % 4;
    const newShape = TETROMINOES[type][nextRotation];

    // Try normal rotation
    if (!this.checkCollision(newShape, this.currentPiece.position)) {
      this.currentPiece.shape = newShape;
      return true;
    }

    // Wall kick - try moving left
    const leftKick = { ...this.currentPiece.position, x: this.currentPiece.position.x - 1 };
    if (!this.checkCollision(newShape, leftKick)) {
      this.currentPiece.position = leftKick;
      this.currentPiece.shape = newShape;
      return true;
    }

    // Wall kick - try moving right
    const rightKick = { ...this.currentPiece.position, x: this.currentPiece.position.x + 1 };
    if (!this.checkCollision(newShape, rightKick)) {
      this.currentPiece.position = rightKick;
      this.currentPiece.shape = newShape;
      return true;
    }

    // Wall kick - try moving up (for I piece)
    const upKick = { ...this.currentPiece.position, y: this.currentPiece.position.y - 1 };
    if (!this.checkCollision(newShape, upKick)) {
      this.currentPiece.position = upKick;
      this.currentPiece.shape = newShape;
      return true;
    }

    return false;
  }

  hardDrop(): void {
    if (!this.currentPiece || this.gameOver || this.paused) return;

    while (this.moveDown()) {
      this.score += 2;
    }
    this.lockPiece();
  }

  addAttackLines(count: number): void {
    if (count <= 0) return;

    // Remove top rows and add attack lines at bottom
    for (let i = 0; i < count; i++) {
      // Shift all rows up by 1
      this.board.shift();
      
      // Add new line at bottom with random gaps
      const newLine: (string | null)[] = [];
      for (let x = 0; x < BOARD_WIDTH; x++) {
        // Leave 1-2 random gaps to make it more playable
        newLine.push(Math.random() > 0.2 ? '#FF4444' : null);
      }
      this.board.push(newLine);
    }

    this.emitEvent({ type: 'attack_received', data: { lines: count } });

    // Check if game over after attack
    if (this.currentPiece && this.checkCollision(this.currentPiece.shape, this.currentPiece.position)) {
      this.gameOver = true;
      this.emitEvent({ type: 'game_over', data: { winner: false } });
    }
  }

  update(timestamp: number): void {
    if (this.gameOver || this.paused) return;

    if (timestamp - this.lastDropTime >= this.dropInterval) {
      this.moveDown();
      this.lastDropTime = timestamp;
    }
  }

  getState(): GameState {
    return {
      board: this.board,
      currentPiece: this.currentPiece,
      nextPiece: this.nextPiece,
      score: this.score,
      level: this.level,
      lines: this.lines,
      gameOver: this.gameOver,
      paused: this.paused,
    };
  }

  getBoard(): (string | null)[][] {
    return this.board;
  }

  getCurrentPiece(): Tetromino | null {
    return this.currentPiece;
  }

  getNextPiece(): Tetromino | null {
    return this.nextPiece;
  }

  isGameOver(): boolean {
    return this.gameOver;
  }

  getScore(): number {
    return this.score;
  }

  getLevel(): number {
    return this.level;
  }

  getLines(): number {
    return this.lines;
  }

  isPaused(): boolean {
    return this.paused;
  }

  togglePause(): void {
    this.paused = !this.paused;
  }

  onEvent(callback: GameEventCallback): void {
    this.eventCallbacks.push(callback);
  }

  private emitEvent(event: GameEvent): void {
    this.eventCallbacks.forEach(cb => cb(event));
  }

  reset(): void {
    this.board = this.createEmptyBoard();
    this.currentPiece = null;
    this.nextPiece = null;
    this.bag = [];
    this.score = 0;
    this.level = 1;
    this.lines = 0;
    this.gameOver = false;
    this.paused = false;
    this.dropInterval = 1000;
    this.lastDropTime = 0;
    this.spawnPiece();
  }

  init(): void {
    this.reset();
  }
}