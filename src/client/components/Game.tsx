import { useState, useEffect, useCallback, useRef } from 'react';
import { TetrisGame } from '../game/TetrisGame';
import Board from './Board';
import { io, Socket } from 'socket.io-client';
import { BOARD_HEIGHT, BOARD_WIDTH } from '../game/constants';

interface Player {
  id: string;
  name: string;
}

interface GameProps {
  playerId: string;
  roomId: string;
  onLeaveRoom?: () => void;
}

interface OpponentState {
  board: (string | null)[][];
  score: number;
  lines: number;
}

export function Game({ playerId, roomId, onLeaveRoom }: GameProps) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [game, setGame] = useState<TetrisGame | null>(null);
  const [opponentState, setOpponentState] = useState<OpponentState>({
    board: Array.from({ length: BOARD_HEIGHT }, () => Array(BOARD_WIDTH).fill(null)),
    score: 0,
    lines: 0,
  });
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);
  const [attackAnimation, setAttackAnimation] = useState(0);
  const [opponentName, setOpponentName] = useState<string>('');
  const [opponentAttackAnimation, setOpponentAttackAnimation] = useState(0);
  const gameRef = useRef<TetrisGame | null>(null);
  const animationRef = useRef<number>(0);

  const handleGameEvent = useCallback((event: { type: string; data: unknown }) => {
    if (event.type === 'line_clear') {
      const data = event.data as { lines: number; score: number };
      socket?.emit('attack', { lines: data.lines, fromPlayerId: playerId });
      
      if (gameRef.current) {
        const state = gameRef.current.getState();
        socket?.emit('board_update', {
          board: state.board,
          score: state.score,
          lines: state.lines,
          fromPlayerId: playerId,
        });
      }
    }
    
    if (event.type === 'attack_received') {
      const data = event.data as { lines: number };
      setAttackAnimation(data.lines);
      setTimeout(() => setAttackAnimation(0), 500);
      
      if (gameRef.current) {
        const state = gameRef.current.getState();
        socket?.emit('board_update', {
          board: state.board,
          score: state.score,
          lines: state.lines,
          fromPlayerId: playerId,
        });
      }
    }
  }, [socket, playerId]);

  useEffect(() => {
    const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || '';
    const newSocket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
    });

    newSocket.on('connect', () => {
      console.log('게임 서버 연결됨');
      newSocket.emit('join', { roomId, playerName: '플레이어' });
    });

    newSocket.on('attacked', (data: { lines: number }) => {
      if (gameRef.current) {
        gameRef.current.addAttackLines(data.lines);
        const state = gameRef.current.getState();
        setGame({ ...gameRef.current } as TetrisGame);
        newSocket.emit('board_update', {
          board: state.board,
          score: state.score,
          lines: state.lines,
          fromPlayerId: playerId,
        });
      }
      setOpponentAttackAnimation(data.lines);
      setTimeout(() => setOpponentAttackAnimation(0), 500);
    });

    newSocket.on('board_update', (data: { board: (string | null)[][]; score: number; lines: number; fromPlayerId: string }) => {
      if (data.fromPlayerId !== playerId) {
        setOpponentState({
          board: data.board,
          score: data.score,
          lines: data.lines,
        });
      }
    });

    newSocket.on('game_start', (data: { players: Player[] }) => {
      const opponent = data.players.find((p: Player) => p.id !== playerId);
      if (opponent) {
        setOpponentName(opponent.name);
      }
    });

    newSocket.on('opponent_left', () => {
      setWinner(playerId);
      setGameOver(true);
    });

    newSocket.on('game_end', (data: { winnerId: string; loserId: string }) => {
      setWinner(data.winnerId);
      setGameOver(true);
    });

    newSocket.on('rematch_requested', () => {
      if (confirm('상대방이 재경기를 요청했습니다. 수락하시겠습니까?')) {
        newSocket.emit('rematch_accept');
      }
    });

    newSocket.on('rematch_start', () => {
      if (gameRef.current) {
        gameRef.current.reset();
        setGame({ ...gameRef.current } as TetrisGame);
        setGameOver(false);
        setWinner(null);
        setOpponentState({
          board: Array.from({ length: BOARD_HEIGHT }, () => Array(BOARD_WIDTH).fill(null)),
          score: 0,
          lines: 0,
        });
      }
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [roomId, playerId]);

  useEffect(() => {
    if (!socket) return;

    const newGame = new TetrisGame();
    gameRef.current = newGame;
    newGame.onEvent(handleGameEvent);
    newGame.init();
    setGame(newGame);

    let lastTime = 0;
    const gameLoop = (timestamp: number) => {
      if (lastTime === 0) lastTime = timestamp;
      
      if (gameRef.current && !gameRef.current.isGameOver() && !gameRef.current.isPaused()) {
        gameRef.current.update(timestamp);
        setGame({ ...gameRef.current } as TetrisGame);
      }
      
      animationRef.current = requestAnimationFrame(gameLoop);
    };

    animationRef.current = requestAnimationFrame(gameLoop);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [socket, handleGameEvent]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const g = gameRef.current;
      if (!g || g.isGameOver()) return;

      switch (e.key) {
        case 'ArrowLeft':
          g.moveLeft();
          break;
        case 'ArrowRight':
          g.moveRight();
          break;
        case 'ArrowDown':
          g.moveDown();
          break;
        case 'ArrowUp':
          g.rotate();
          break;
        case ' ':
          e.preventDefault();
          g.hardDrop();
          break;
        case 'p':
        case 'P':
          g.togglePause();
          break;
      }
      
      setGame({ ...g } as TetrisGame);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [game]);

  const handleRematch = () => {
    socket?.emit('rematch_request');
  };

  /** 방을 나가고 로비로 돌아가기 */
  const handleQuit = () => {
    socket?.emit('leave_room');
    socket?.disconnect();
    if (onLeaveRoom) {
      onLeaveRoom();
    }
  };

  if (!game) {
    return (
      <div style={styles.loading}>
        <div style={styles.spinner} />
        <p>게임을 불러오는 중...</p>
      </div>
    );
  }

  const state = game.getState();

  return (
    <div style={styles.container}>
      {/* 상단 정보 */}
      <div style={styles.header}>
        <div style={styles.playerInfo}>
          <span style={styles.label}>나</span>
          <span style={styles.stat}>점수: {state.score}</span>
          <span style={styles.stat}>줄: {state.lines}</span>
          <span style={styles.stat}>레벨: {state.level}</span>
        </div>
        <div style={styles.versusContainer}>
          <span style={styles.vsText}>VS</span>
        </div>
        <div style={styles.playerInfo}>
          <span style={styles.labelOpponent}>{opponentName || '상대방'}</span>
          <span style={styles.stat}>점수: {opponentState.score}</span>
          <span style={styles.stat}>줄: {opponentState.lines}</span>
        </div>
      </div>

      {/* 게임 영역 */}
      <div style={styles.gameArea}>
        {/* 내 보드 */}
        <div style={styles.boardContainer}>
          <h3 style={styles.boardTitle}>내 보드</h3>
          <Board 
            board={state.board} 
            currentPiece={state.currentPiece}
            attackAnimation={attackAnimation}
          />
          {state.paused && (
            <div style={styles.pauseOverlay}>
              <span>일시 정지 (P키로 해제)</span>
            </div>
          )}
        </div>

        {/* 사이드 패널 */}
        <div style={styles.sidePanel}>
          <div style={styles.nextPieceContainer}>
            <h4 style={styles.nextTitle}>다음 블록</h4>
            <div style={styles.nextPiece}>
              {state.nextPiece && (
                <div style={styles.nextPiecePreview}>
                  {state.nextPiece.shape.map((row, y) => (
                    <div key={y} style={styles.nextPieceRow}>
                      {row.map((cell, x) => (
                        <div
                          key={x}
                          style={{
                            width: '25px',
                            height: '25px',
                            backgroundColor: cell ? state.nextPiece!.color : 'transparent',
                            border: cell ? '1px solid rgba(255,255,255,0.3)' : 'none',
                            borderRadius: '2px',
                          }}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 공격 정보 */}
          <div style={styles.attackInfo}>
            <h4 style={styles.attackTitle}>공격 시스템</h4>
            <div style={styles.attackList}>
              <span>1줄 삭제 → 1줄 공격</span>
              <span>2줄 삭제 → 2줄 공격</span>
              <span>3줄 삭제 → 3줄 공격</span>
              <span style={styles.tetrisBonus}>4줄 (테트리스!) → 4줄 공격</span>
            </div>
          </div>
        </div>

        {/* 상대방 보드 */}
        <div style={styles.boardContainer}>
          <h3 style={styles.boardTitle}>{opponentName || '상대방'}</h3>
          <Board 
            board={opponentState.board} 
            isOpponent={true}
            attackAnimation={opponentAttackAnimation}
          />
        </div>
      </div>

      {/* 조작법 */}
      <div style={styles.controls}>
        <span>← → 이동</span>
        <span>↑ 회전</span>
        <span>↓ 아래로 이동</span>
        <span>Space 한 번에 내리기</span>
        <span>P 일시 정지</span>
      </div>

      {/* 게임 오버 오버레이 */}
      {gameOver && (
        <div style={styles.gameOverOverlay}>
          <div style={styles.gameOverContent}>
            <h2 style={styles.gameOverTitle}>
              {winner === playerId ? '승리!' : '패배'}
            </h2>
            <p style={styles.finalScore}>최종 점수: {state.score}</p>
            <div style={styles.buttonGroup}>
              <button style={styles.rematchButton} onClick={handleRematch}>
                재경기
              </button>
              <button style={styles.quitButton} onClick={handleQuit}>
                로비로 돌아가기
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
      `}</style>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '20px',
    minHeight: '100vh',
    backgroundColor: '#0a0a1a',
    color: '#fff',
    fontFamily: 'Arial, sans-serif',
  },
  loading: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    color: '#00ffff',
  },
  spinner: {
    width: '50px',
    height: '50px',
    border: '5px solid #1a1a2e',
    borderTop: '5px solid #00ffff',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    maxWidth: '1000px',
    marginBottom: '30px',
    padding: '15px 30px',
    backgroundColor: '#1a1a2e',
    borderRadius: '10px',
    border: '2px solid #333',
  },
  playerInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '5px',
    minWidth: '150px',
  },
  label: {
    fontSize: '20px',
    fontWeight: 'bold',
    color: '#00ffff',
  },
  labelOpponent: {
    fontSize: '20px',
    fontWeight: 'bold',
    color: '#ff4444',
    textAlign: 'right',
  },
  versusContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vsText: {
    fontSize: '32px',
    fontWeight: 'bold',
    color: '#ffff00',
    textShadow: '0 0 20px rgba(255, 255, 0, 0.5)',
  },
  stat: {
    fontSize: '14px',
    color: '#aaa',
  },
  gameArea: {
    display: 'flex',
    gap: '30px',
    alignItems: 'flex-start',
  },
  boardContainer: {
    position: 'relative',
  },
  boardTitle: {
    textAlign: 'center',
    color: '#00ffff',
    marginBottom: '10px',
    fontSize: '16px',
    textTransform: 'uppercase',
    letterSpacing: '2px',
  },
  sidePanel: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    minWidth: '150px',
  },
  nextPieceContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  nextTitle: {
    color: '#00ffff',
    marginBottom: '10px',
    fontSize: '14px',
    textTransform: 'uppercase',
    letterSpacing: '1px',
  },
  nextPiece: {
    padding: '10px',
    backgroundColor: '#1a1a2e',
    borderRadius: '4px',
    border: '2px solid #333',
  },
  nextPiecePreview: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '2px',
  },
  nextPieceRow: {
    display: 'flex',
    gap: '2px',
  },
  attackInfo: {
    padding: '15px',
    backgroundColor: '#1a1a2e',
    borderRadius: '8px',
    border: '2px solid #ff4444',
  },
  attackTitle: {
    color: '#ff4444',
    marginBottom: '10px',
    fontSize: '12px',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  attackList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '5px',
    fontSize: '11px',
    color: '#888',
  },
  tetrisBonus: {
    color: '#ffff00',
    fontWeight: 'bold',
  },
  pauseOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: '20px 40px',
    borderRadius: '8px',
    border: '2px solid #00ffff',
    color: '#00ffff',
    fontSize: '18px',
    zIndex: 10,
  },
  controls: {
    display: 'flex',
    gap: '20px',
    marginTop: '30px',
    padding: '10px 20px',
    backgroundColor: '#1a1a2e',
    borderRadius: '4px',
    fontSize: '12px',
    color: '#888',
  },
  gameOverOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  gameOverContent: {
    textAlign: 'center',
    padding: '50px',
    backgroundColor: '#1a1a2e',
    borderRadius: '16px',
    border: '3px solid #00ffff',
    boxShadow: '0 0 50px rgba(0, 255, 255, 0.3)',
  },
  gameOverTitle: {
    fontSize: '56px',
    marginBottom: '20px',
    color: '#00ffff',
    textShadow: '0 0 30px rgba(0, 255, 255, 0.5)',
  },
  finalScore: {
    fontSize: '28px',
    marginBottom: '40px',
    color: '#fff',
  },
  buttonGroup: {
    display: 'flex',
    gap: '20px',
    justifyContent: 'center',
  },
  rematchButton: {
    padding: '15px 40px',
    fontSize: '20px',
    backgroundColor: '#00ffff',
    color: '#0a0a1a',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: 'bold',
    transition: 'all 0.3s',
  },
  quitButton: {
    padding: '15px 40px',
    fontSize: '20px',
    backgroundColor: 'transparent',
    color: '#fff',
    border: '2px solid #fff',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: 'bold',
    transition: 'all 0.3s',
  },
};

export default Game;
