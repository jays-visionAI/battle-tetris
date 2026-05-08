import { useState, useEffect, useCallback, useRef } from 'react';
import { TetrisGame } from '../game/TetrisGame';
import Board from './Board';
import { Socket } from 'socket.io-client';
import { BOARD_HEIGHT, BOARD_WIDTH } from '../game/constants';
import { soundManager } from '../utils/SoundManager';
import { statsManager } from '../utils/StatsManager';

interface Player {
  id: string;
  name: string;
}

interface GameProps {
  socket: Socket | null;
  roomId: string;
  players?: Player[];
  onLeaveRoom?: () => void;
}

interface OpponentState {
  board: (string | null)[][];
  currentPiece?: any;
  nextPiece?: any;
  score: number;
  lines: number;
  level?: number;
  lastAction?: string;
}

export function Game({ socket, roomId, players, onLeaveRoom }: GameProps) {
  const [renderTick, setRenderTick] = useState(0);
  const [opponentState, setOpponentState] = useState<OpponentState>({
    board: Array.from({ length: BOARD_HEIGHT }, () => Array(BOARD_WIDTH).fill(null)),
    currentPiece: null,
    nextPiece: null,
    score: 0,
    lines: 0,
    level: 1,
    lastAction: '',
  });
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);
  const [attackAnimation, setAttackAnimation] = useState(0);
  const [opponentName, setOpponentName] = useState<string>('');
  const [opponentAttackAnimation, setOpponentAttackAnimation] = useState(0);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [gameStarted, setGameStarted] = useState(false);
  const gameRef = useRef<TetrisGame | null>(null);
  const animationRef = useRef<number>(0);
  const gameInitializedRef = useRef(false);
  const bgmStartedRef = useRef(false);

  const playerId = socket?.id || '';

  // 모바일 감지
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 게임 시작 시 스크롤 방지
  useEffect(() => {
    const handleGameStart = () => {
      setGameStarted(true);
      // 스크롤 방지
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    };

    const handleGameEnd = () => {
      setGameStarted(false);
      // 스크롤 허용
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };

    socket?.on('game_start', handleGameStart);
    socket?.on('game_end', handleGameEnd);
    socket?.on('rematch_start', handleGameStart);

    return () => {
      socket?.off('game_start', handleGameStart);
      socket?.off('game_end', handleGameEnd);
      socket?.off('rematch_start', handleGameStart);
      // 컴포넌트 언마운트 시 스크롤 허용
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, [socket]);

  useEffect(() => {
    if (players && players.length > 0) {
      const opponent = players.find(p => p.id !== playerId);
      if (opponent) {
        setOpponentName(opponent.name);
      }
    }
  }, [players, playerId]);

  // BGM 시스템 초기화 (첫 사용자 상호작용 후)
  useEffect(() => {
    // 키보드/마우스 첫 상호작용 시 BGM 시작
    const startBGMOnInteraction = () => {
      if (bgmStartedRef.current) return;
      bgmStartedRef.current = true;
      
      soundManager.startBGM().catch(console.warn);
      
      // 리스너 제거
      window.removeEventListener('keydown', startBGMOnInteraction);
      window.removeEventListener('click', startBGMOnInteraction);
      window.removeEventListener('touchstart', startBGMOnInteraction);
    };

    window.addEventListener('keydown', startBGMOnInteraction);
    window.addEventListener('click', startBGMOnInteraction);
    window.addEventListener('touchstart', startBGMOnInteraction);

    return () => {
      soundManager.stopBGM();
      window.removeEventListener('keydown', startBGMOnInteraction);
      window.removeEventListener('click', startBGMOnInteraction);
      window.removeEventListener('touchstart', startBGMOnInteraction);
    };
  }, []);

  const getGame = useCallback(() => gameRef.current, []);

  const lastBoardUpdateRef = useRef(0);

  // 실시간 게임 상태 전송 (모든 조작을 즉시 전송)
  const sendGameplayAction = useCallback((action: string, data: unknown = null) => {
    if (!socket) return;
    
    const g = getGame();
    if (g) {
      const state = g.getState();
      socket.emit('gameplay_action', {
        action,
        data,
        board: state.board,
        currentPiece: state.currentPiece,
        nextPiece: state.nextPiece,
        score: state.score,
        lines: state.lines,
        level: state.level,
        fromPlayerId: playerId,
        timestamp: Date.now(),
      });
    }
  }, [socket, playerId, getGame]);

  const sendBoardUpdate = useCallback(() => {
    if (!socket) return;
    const now = Date.now();
    if (now - lastBoardUpdateRef.current < 50) return;
    lastBoardUpdateRef.current = now;

    const g = getGame();
    if (g) {
      const state = g.getState();
      socket.emit('board_update', {
        board: state.board,
        score: state.score,
        lines: state.lines,
        fromPlayerId: playerId,
      });
    }
  }, [socket, playerId, getGame]);

  const handleGameEvent = useCallback((event: { type: string; data: unknown }) => {
    if (event.type === 'line_clear') {
      const data = event.data as { lines: number; score: number };
      socket?.emit('attack', { lines: data.lines, fromPlayerId: playerId });
      sendGameplayAction('line_clear', data);
      
      // 공격 보낼 때 효과음 (라인 수에 따라 다르게)
      soundManager.playAttackSend(data.lines);
    }

    if (event.type === 'attack_received') {
      const data = event.data as { lines: number };
      setAttackAnimation(data.lines);
      setTimeout(() => setAttackAnimation(0), 500);
      sendGameplayAction('attack_received', data);
      
      // 공격 받을 때 효과음
      soundManager.playAttackReceive(data.lines);
    }

    if (event.type === 'board_changed') {
      sendGameplayAction('board_changed');
    }

    if (event.type === 'game_over') {
      setGameOver(true);
      soundManager.stopBGM();
      
      // 게임 오버 정보를 서버에 전송
      const data = event.data as { winnerId: string; loserId: string };
      const winnerPlayer = players?.find(p => p.id === data.winnerId);
      const loserPlayer = players?.find(p => p.id === data.loserId);
      
      // 전적 기록 (localStorage)
      if (winnerPlayer?.name && loserPlayer?.name) {
        statsManager.recordGame(winnerPlayer.name, loserPlayer.name);
      }
      
      socket?.emit('game_over', {
        winnerId: data.winnerId,
        loserId: data.loserId,
        winnerName: winnerPlayer?.name || '승자',
        loserName: loserPlayer?.name || '패자',
      });
      
      sendGameplayAction('game_over', data);
    }
  }, [socket, playerId, sendGameplayAction]);

  // Socket 이벤트 리스너 설정
  useEffect(() => {
    if (!socket) return;

    const onAttacked = (data: { lines: number }) => {
      console.log('[Game] attacked 이벤트 수신:', data);
      const g = getGame();
      if (g) {
        g.addAttackLines(data.lines);
        setRenderTick(t => t + 1);
        sendBoardUpdate();
      }
      setOpponentAttackAnimation(data.lines);
      setTimeout(() => setOpponentAttackAnimation(0), 500);
      
      // 공격받을 때 강렬한 효과음
      try {
        const attackAudio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj');
        attackAudio.volume = 0.3;
        attackAudio.play().catch(() => {});
      } catch (e) {
        // 효과음 재생 실패 시 무시
      }
    };

    const onBoardUpdate = (data: { board: (string | null)[][]; score: number; lines: number; fromPlayerId: string }) => {
      if (data.fromPlayerId !== playerId) {
        setOpponentState(prev => ({
          ...prev,
          board: data.board,
          score: data.score,
          lines: data.lines,
        }));
      }
    };

    // 100% 실시간 게임플레이 공유 리스너
    const onGameplayAction = (data: {
      action: string;
      data: unknown;
      board: (string | null)[][];
      currentPiece: any;
      nextPiece: any;
      score: number;
      lines: number;
      level: number;
      fromPlayerId: string;
      timestamp: number;
    }) => {
      if (data.fromPlayerId !== playerId) {
        // 상대방의 실시간 게임 상태를 완전히 동기화
        setOpponentState(prev => ({
          ...prev,
          board: data.board,
          currentPiece: data.currentPiece,
          nextPiece: data.nextPiece,
          score: data.score,
          lines: data.lines,
          level: data.level,
          lastAction: data.action,
        }));
      }
    };

    const onGameStart = (data: { players: Player[] }) => {
      console.log('[Game] game_start 이벤트 수신:', data);
      const opponent = data.players.find((p: Player) => p.id !== playerId);
      if (opponent) {
        setOpponentName(opponent.name);
      }
    };

    const onOpponentLeft = () => {
      console.log('[Game] 상대방 퇴장');
      setWinner(playerId);
      setGameOver(true);
    };

    const onGameEnd = (data: { winnerId: string; loserId: string }) => {
      console.log('[Game] 게임 종료:', data);
      setWinner(data.winnerId);
      setGameOver(true);
    };

    const onRematchRequested = () => {
      console.log('[Game] 재경기 요청 수신');
      if (confirm('상대방이 재경기를 요청했습니다. 수락하시겠습니까?')) {
        socket.emit('rematch_accept');
      }
    };

    const onRematchStart = () => {
      console.log('[Game] 재경기 시작');
      const g = getGame();
      if (g) {
        g.reset();
        setRenderTick(t => t + 1);
        setGameOver(false);
        setWinner(null);
        setOpponentState({
          board: Array.from({ length: BOARD_HEIGHT }, () => Array(BOARD_WIDTH).fill(null)),
          score: 0,
          lines: 0,
        });
      }
    };

    socket.on('gameplay_action', onGameplayAction);
    socket.on('attacked', onAttacked);
    socket.on('board_update', onBoardUpdate);
    socket.on('game_start', onGameStart);
    socket.on('opponent_left', onOpponentLeft);
    socket.on('game_end', onGameEnd);
    socket.on('rematch_requested', onRematchRequested);
    socket.on('rematch_start', onRematchStart);

    return () => {
      socket.off('gameplay_action', onGameplayAction);
      socket.off('attacked', onAttacked);
      socket.off('board_update', onBoardUpdate);
      socket.off('game_start', onGameStart);
      socket.off('opponent_left', onOpponentLeft);
      socket.off('game_end', onGameEnd);
      socket.off('rematch_requested', onRematchRequested);
      socket.off('rematch_start', onRematchStart);
    };
  }, [socket, playerId, getGame]);

  // 게임 엔진 초기화 (한 번만 실행)
  useEffect(() => {
    if (gameInitializedRef.current) return;
    gameInitializedRef.current = true;

    console.log('[Game] 게임 엔진 초기화');
    const newGame = new TetrisGame();
    gameRef.current = newGame;
    newGame.onEvent(handleGameEvent);
    newGame.init();
    setRenderTick(t => t + 1);

    let lastTime = 0;
    const gameLoop = (timestamp: number) => {
      if (lastTime === 0) lastTime = timestamp;
      
      const g = getGame();
      if (g && !g.isGameOver() && !g.isPaused()) {
        g.update(timestamp);
        setRenderTick(t => t + 1);
      }
      
      animationRef.current = requestAnimationFrame(gameLoop);
    };

    animationRef.current = requestAnimationFrame(gameLoop);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      gameInitializedRef.current = false;
    };
  }, [handleGameEvent, getGame]);

  // 키보드 이벤트 (100% 실시간 공유)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const g = getGame();
      if (!g || g.isGameOver()) return;

      let actionSent = false;
      switch (e.key) {
        case 'ArrowLeft':
          if (g.moveLeft()) {
            sendGameplayAction('move_left');
            actionSent = true;
          }
          break;
        case 'ArrowRight':
          if (g.moveRight()) {
            sendGameplayAction('move_right');
            actionSent = true;
          }
          break;
        case 'ArrowDown':
          if (g.moveDown()) {
            sendGameplayAction('move_down');
            actionSent = true;
          }
          break;
        case 'ArrowUp':
          if (g.rotate()) {
            sendGameplayAction('rotate');
            actionSent = true;
          }
          break;
        case ' ':
          e.preventDefault();
          g.hardDrop();
          sendGameplayAction('hard_drop');
          actionSent = true;
          break;
        case 'p':
        case 'P':
          g.togglePause();
          sendGameplayAction('toggle_pause');
          actionSent = true;
          break;
      }
      
      if (actionSent) {
        setRenderTick(t => t + 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [getGame, sendGameplayAction]);

  const handleRematch = () => {
    socket?.emit('rematch_request');
  };

  /** 방을 나가고 로비로 돌아가기 */
  const handleQuit = () => {
    socket?.emit('leave_room');
    if (onLeaveRoom) {
      onLeaveRoom();
    }
  };

  // ========== 터치 컨트롤 핸들러 ==========
  const handleTouchAction = useCallback((e: React.TouchEvent, action: string) => {
    e.preventDefault(); // 브라우저 기본 동작 방지 (스크롤, 줌 등)
    const g = getGame();
    if (!g || g.isGameOver()) return;

    switch (action) {
      case 'left':
        if (g.moveLeft()) {
          sendGameplayAction('move_left');
        }
        break;
      case 'right':
        if (g.moveRight()) {
          sendGameplayAction('move_right');
        }
        break;
      case 'down':
        if (g.moveDown()) {
          sendGameplayAction('move_down');
        }
        break;
      case 'rotate':
        if (g.rotate()) {
          sendGameplayAction('rotate');
        }
        break;
      case 'hardDrop':
        g.hardDrop();
        sendGameplayAction('hard_drop');
        break;
      case 'pause':
        g.togglePause();
        sendGameplayAction('toggle_pause');
        break;
    }
    setRenderTick(t => t + 1);
  }, [getGame, sendGameplayAction]);

  const g = getGame();
  if (!g) {
    return (
      <div style={styles.loading}>
        <div style={styles.spinner} />
        <p>게임을 불러오는 중...</p>
      </div>
    );
  }

  const state = g.getState();

  return (
    <div style={styles.container} className="game-container">
      {/* 상단 정보 */}
      <div style={styles.header} className="game-header">
        <div style={styles.playerInfo} className="player-info">
          <span style={styles.label} className="label">나</span>
          <span style={styles.stat} className="stat">점수: {state.score}</span>
          <span style={styles.stat} className="stat">줄: {state.lines}</span>
          <span style={styles.stat} className="stat">레벨: {state.level}</span>
        </div>
        <div style={styles.versusContainer} className="vs-container">
          <span style={styles.vsText} className="vs-text">VS</span>
        </div>
        <div style={styles.playerInfo} className="player-info">
          <span style={styles.labelOpponent} className="label-opponent">{opponentName || '상대방'}</span>
          <span style={styles.stat} className="stat">점수: {opponentState.score}</span>
          <span style={styles.stat} className="stat">줄: {opponentState.lines}</span>
        </div>
      </div>

      {/* 게임 영역 */}
      <div style={styles.gameArea} className="game-area">
        {/* 내 보드 */}
        <div style={styles.boardContainer} className="board-container-player">
          <h3 style={styles.boardTitle} className="board-title">내 보드</h3>
          <Board 
            board={state.board} 
            currentPiece={state.currentPiece}
            attackAnimation={attackAnimation}
            scale={isMobile ? 0.75 : 1}
          />
          {state.paused && (
            <div style={styles.pauseOverlay} className="pause-overlay-mobile">
              <span>일시 정지 (P키로 해제)</span>
            </div>
          )}
        </div>

        {/* 사이드 패널 - PC만 표시 */}
        {!isMobile && (
        <div style={styles.sidePanel} className="side-panel">
          <div style={styles.nextPieceContainer} className="next-piece-container">
            <h4 style={styles.nextTitle} className="next-title">다음 블록</h4>
            <div style={styles.nextPiece}>
              {state.nextPiece && (() => {
                const shape = state.nextPiece.shape;
                // Find the bounding box of actual filled cells
                let minY = shape.length, maxY = 0, minX = shape[0].length, maxX = 0;
                let hasCell = false;
                for (let y = 0; y < shape.length; y++) {
                  for (let x = 0; x < shape[y].length; x++) {
                    if (shape[y][x]) {
                      minY = Math.min(minY, y);
                      maxY = Math.max(maxY, y);
                      minX = Math.min(minX, x);
                      maxX = Math.max(maxX, x);
                      hasCell = true;
                    }
                  }
                }
                if (!hasCell) return null;
                const croppedShape = shape.slice(minY, maxY + 1).map(row => row.slice(minX, maxX + 1));
                const cellSize = 25;
                return (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '2px',
                    padding: '8px',
                  }}>
                    {croppedShape.map((row, y) => (
                      <div key={y} style={{
                        display: 'flex',
                        gap: '2px',
                      }}>
                        {row.map((cell, x) => (
                          <div
                            key={x}
                            style={{
                              width: `${cellSize}px`,
                              height: `${cellSize}px`,
                              backgroundColor: cell ? state.nextPiece!.color : 'transparent',
                              border: cell ? '1px solid rgba(255,255,255,0.3)' : 'none',
                              borderRadius: '2px',
                              boxShadow: cell ? `inset 0 0 4px rgba(255,255,255,0.2)` : 'none',
                            }}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>

          {/* 공격 정보 */}
          <div style={styles.attackInfo} className="attack-info">
            <h4 style={styles.attackTitle} className="attack-title">공격 시스템</h4>
            <div style={styles.attackList} className="attack-list">
              <span>1줄 삭제 → 1줄 공격</span>
              <span>2줄 삭제 → 2줄 공격</span>
              <span>3줄 삭제 → 3줄 공격</span>
              <span style={styles.tetrisBonus}>4줄 (테트리스!) → 4줄 공격</span>
            </div>
          </div>
        </div>
        )}

        {/* 상대방 보드 - 우측 상단 오버레이 (B안: 최소화) */}
        {isMobile && (
          <div style={styles.opponentOverlay} className="opponent-overlay">
            <div style={styles.opponentHeader} className="opponent-header">
              <span style={styles.opponentLabel}>{opponentName || '상대방'}</span>
              <span style={styles.opponentScore}>{opponentState.score}점</span>
            </div>
            <div style={{
              transform: 'scale(0.4)',
              transformOrigin: 'top left',
              width: `${BOARD_WIDTH * 25}px`,
              height: `${BOARD_HEIGHT * 25}px`,
              pointerEvents: 'none',
            }}>
              <Board 
                board={opponentState.board} 
                currentPiece={opponentState.currentPiece}
                nextPieceColor={opponentState.nextPiece?.color}
                isOpponent={true}
                attackAnimation={opponentAttackAnimation}
                scale={1}
              />
            </div>
          </div>
        )}

        {/* PC용 상대방 보드 */}
        {!isMobile && (
          <div style={styles.boardContainer} className="board-container-opponent">
            <h3 style={styles.boardTitle} className="board-title">{opponentName || '상대방'}</h3>
            <Board 
              board={opponentState.board} 
              currentPiece={opponentState.currentPiece}
              nextPieceColor={opponentState.nextPiece?.color}
              isOpponent={true}
              attackAnimation={opponentAttackAnimation}
              scale={1}
            />
          </div>
        )}
      </div>

      {/* 조작법 - PC만 표시 */}
      {!isMobile && (
        <div style={styles.controls} className="controls-bar">
          <span>← → 이동</span>
          <span>↑ 회전</span>
          <span>↓ 아래로 이동</span>
          <span>Space 한 번에 내리기</span>
          <span>P 일시 정지</span>
        </div>
      )}

      {/* 모바일 터치 컨트롤 - C안: 왼쪽(조작), 오른쪽(하드드롭/일시정지) */}
      {isMobile && (
        <div style={styles.touchControls} className="touch-controls">
          {/* 왼쪽: 방향 조작 (←▲▶▼) */}
          <div style={styles.touchLeftGroup} className="touch-left-group">
            <div style={styles.touchRow} className="touch-row">
              <button 
                style={styles.touchButton} 
                className="touch-button touch-left"
                onTouchStart={(e) => handleTouchAction(e, 'left')}
              >
                ◀
              </button>
              <button 
                style={styles.touchButton} 
                className="touch-button touch-rotate"
                onTouchStart={(e) => handleTouchAction(e, 'rotate')}
              >
                ▲
              </button>
              <button 
                style={styles.touchButton} 
                className="touch-button touch-right"
                onTouchStart={(e) => handleTouchAction(e, 'right')}
              >
                ▶
              </button>
            </div>
            <div style={styles.touchRow} className="touch-row">
              <button 
                style={{...styles.touchButton, width: '100%'}}
                className="touch-button touch-down"
                onTouchStart={(e) => handleTouchAction(e, 'down')}
              >
                ▼
              </button>
            </div>
          </div>
          {/* 오른쪽: 하드드롭 + 일시정지 */}
          <div style={styles.touchRightGroup} className="touch-right-group">
            <button 
              style={{...styles.touchButton, height: 'auto', flex: 1, fontSize: 18}}
              className="touch-button touch-hard-drop"
              onTouchStart={(e) => handleTouchAction(e, 'hardDrop')}
            >
              ▼▼
            </button>
            <button 
              style={{...styles.touchButton, height: 'auto', flex: 1, fontSize: 16}}
              className="touch-button touch-pause"
              onTouchStart={(e) => handleTouchAction(e, 'pause')}
            >
              ⏸
            </button>
          </div>
        </div>
      )}

      {/* 게임 오버 오버레이 - 하단 고정 스타일 */}
      {gameOver && (
        <div style={styles.gameOverOverlay}>
          <div style={styles.gameOverContent} className="game-over-content-mobile">
            <div style={styles.gameOverHeader}>
              <h2 style={styles.gameOverTitle} className="game-over-title-mobile">
                {winner && winner === playerId ? '승리!' : '패배'}
              </h2>
              <p style={styles.finalScore} className="final-score-mobile">최종 점수: {state.score}</p>
            </div>
            <div style={styles.buttonGroup} className="button-group-mobile">
              <button style={styles.rematchButton} className="rematch-button-mobile" onClick={handleRematch}>
                재경기
              </button>
              <button style={styles.quitButton} className="quit-button-mobile" onClick={handleQuit}>
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

        /* ===== 모바일 반응형 레이아웃 (768px 이하) ===== */
        @media (max-width: 768px) {
          .game-container {
            padding: 8px !important;
            min-height: 100dvh;
            height: 100dvh;
            overflow: hidden;
            position: relative;
          }

          .game-header {
            flex-direction: column !important;
            gap: 8px !important;
            padding: 10px 15px !important;
            margin-bottom: 12px !important;
            max-width: 100% !important;
          }

          .game-header .player-info {
            flex-direction: row !important;
            flex-wrap: wrap !important;
            gap: 8px !important;
            min-width: auto !important;
            justify-content: center !important;
          }

          .game-header .player-info .label,
          .game-header .player-info .label-opponent {
            font-size: 14px !important;
            width: 100% !important;
            text-align: center !important;
          }

          .game-header .player-info .stat {
            font-size: 11px !important;
          }

          .game-header .vs-container {
            order: -1 !important;
          }

          .game-header .vs-text {
            font-size: 22px !important;
          }

          .game-area {
            flex-direction: column !important;
            gap: 12px !important;
            align-items: center !important;
            width: 100% !important;
          }

          .board-container-player {
            order: 1 !important;
          }

          .board-container-player .board-title {
            font-size: 13px !important;
            margin-bottom: 4px !important;
          }

          .side-panel {
            order: 2 !important;
            flex-direction: row !important;
            gap: 12px !important;
            min-width: auto !important;
            width: 100% !important;
            justify-content: center !important;
            flex-wrap: wrap !important;
          }

          .side-panel .next-piece-container {
            order: 1 !important;
          }

          .side-panel .next-piece-container .next-title {
            font-size: 11px !important;
            margin-bottom: 4px !important;
          }

          .side-panel .next-piece {
            min-height: auto !important;
            padding: 2px !important;
          }

          .side-panel .attack-info {
            order: 2 !important;
            padding: 8px 12px !important;
          }

          .side-panel .attack-info .attack-title {
            font-size: 10px !important;
            margin-bottom: 4px !important;
          }

          .side-panel .attack-info .attack-list {
            flex-direction: row !important;
            flex-wrap: wrap !important;
            gap: 6px !important;
            font-size: 9px !important;
          }

          .board-container-opponent {
            order: 3 !important;
          }

          .board-container-opponent .board-title {
            font-size: 12px !important;
            margin-bottom: 4px !important;
            color: #ff4444 !important;
          }

          /* ===== 상대방 오버레이 (우측 상단) ===== */
          .opponent-overlay {
            position: fixed !important;
            top: 8px !important;
            right: 8px !important;
            z-index: 1000 !important;
            padding: 4px !important;
            border-width: 1px !important;
            transform: scale(0.9) !important;
          }

          .opponent-overlay .opponent-header {
            display: flex !important;
            justify-content: space-between !important;
            align-items: center !important;
            margin-bottom: 2px !important;
            padding: 0 2px !important;
          }

          .opponent-overlay .opponent-label {
            font-size: 9px !important;
            font-weight: bold !important;
            color: #ff4444 !important;
          }

          .opponent-overlay .opponent-score {
            font-size: 9px !important;
            color: #aaa !important;
          }

          .controls-bar {
            order: 4 !important;
            flex-wrap: wrap !important;
            gap: 8px !important;
            margin-top: 12px !important;
            padding: 8px 12px !important;
            font-size: 10px !important;
            justify-content: center !important;
          }

          .pause-overlay-mobile {
            font-size: 14px !important;
            padding: 12px 24px !important;
          }

          .game-over-content-mobile {
            padding: 20px !important;
            padding-bottom: max(20px, env(safe-area-inset-bottom)) !important;
          }

          .game-over-title-mobile {
            font-size: 36px !important;
          }

          .final-score-mobile {
            font-size: 20px !important;
            margin-bottom: 24px !important;
          }

          .button-group-mobile {
            flex-direction: column !important;
            gap: 12px !important;
          }

          .rematch-button-mobile,
          .quit-button-mobile {
            padding: 12px 30px !important;
            font-size: 16px !important;
          }

          /* ===== 모바일 터치 컨트롤 ===== */
          .touch-controls {
            position: fixed !important;
            bottom: max(20px, env(safe-area-inset-bottom) + 10px) !important;
            left: 50% !important;
            transform: translateX(-50%) !important;
            display: flex !important;
            flex-direction: column !important;
            gap: 8px !important;
            padding: 8px !important;
            backgroundColor: rgba(10, 10, 26, 0.9) !important;
            borderRadius: 16px !important;
            border: 2px solid rgba(0, 255, 255, 0.3) !important;
          }

          .touch-row {
            display: flex !important;
            gap: 10px !important;
            justify-content: center !important;
          }

          .touch-button {
            width: 58px !important;
            height: 58px !important;
            borderRadius: 14px !important;
            border: 2px solid rgba(0, 255, 255, 0.6) !important;
            backgroundColor: rgba(0, 255, 255, 0.15) !important;
            color: #00ffff !important;
            font-size: 22px !important;
            fontWeight: bold !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            user-select: none !important;
            -webkit-tap-highlight-color: transparent !important;
            touch-action: manipulation !important;
          }

          .touch-button:active {
            backgroundColor: rgba(0, 255, 255, 0.4) !important;
            transform: scale(0.95) !important;
          }
        }

        /* ===== 작은 모바일 (480px 이하) ===== */
        @media (max-width: 480px) {
          .game-container {
            padding: 4px !important;
          }

          .game-header {
            padding: 8px 10px !important;
            margin-bottom: 8px !important;
          }

          .game-header .vs-text {
            font-size: 18px !important;
          }

          .game-area {
            gap: 8px !important;
          }

          .side-panel {
            gap: 8px !important;
          }

          .side-panel .attack-info .attack-list {
            font-size: 8px !important;
            gap: 4px !important;
          }

          .controls-bar {
            gap: 6px !important;
            font-size: 9px !important;
            padding: 6px 8px !important;
          }
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
  opponentOverlay: {
    position: 'fixed',
    top: '10px',
    right: '10px',
    zIndex: 100,
    backgroundColor: 'rgba(10, 10, 26, 0.95)',
    border: '2px solid #00ffff',
    borderRadius: '8px',
    padding: '4px',
    boxShadow: '0 0 15px rgba(0, 255, 255, 0.4)',
  },
  opponentHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '2px',
    padding: '0 4px',
  },
  opponentLabel: {
    fontSize: '10px',
    fontWeight: 'bold',
    color: '#ff4444',
  },
  opponentScore: {
    fontSize: '10px',
    color: '#aaa',
  },
  opponentOverlayTitle: {
    fontSize: '12px',
    color: '#ff6b6b',
    textAlign: 'center',
    marginBottom: '4px',
  },
  opponentStats: {
    display: 'flex',
    gap: '10px',
    justifyContent: 'center',
    fontSize: '11px',
    color: '#aaa',
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
    padding: '4px',
    backgroundColor: '#1a1a2e',
    borderRadius: '4px',
    border: '2px solid #333',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '80px',
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
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    padding: '20px',
    paddingBottom: 'max(20px, env(safe-area-inset-bottom))',
    zIndex: 100,
  },
  gameOverHeader: {
    marginBottom: '16px',
  },
  gameOverContent: {
    textAlign: 'center' as const,
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
  touchControls: {
    position: 'fixed' as const,
    bottom: 16,
    left: 0,
    right: 0,
    display: 'flex',
    justifyContent: 'space-between',
    padding: '0 12px',
    zIndex: 100,
    pointerEvents: 'none' as const,
  },
  touchLeftGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 6,
    pointerEvents: 'auto' as const,
  },
  touchRightGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 6,
    width: 52,
    pointerEvents: 'auto' as const,
  },
  touchRow: {
    display: 'flex',
    gap: 6,
    justifyContent: 'center',
  },
  touchButton: {
    width: 46,
    height: 46,
    borderRadius: 10,
    border: '2px solid rgba(0, 255, 255, 0.5)',
    backgroundColor: 'rgba(0, 255, 255, 0.12)',
    color: '#00ffff',
    fontSize: 18,
    fontWeight: 'bold',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    userSelect: 'none' as const,
    WebkitTapHighlightColor: 'transparent',
    touchAction: 'none',
  },
};

export default Game;
