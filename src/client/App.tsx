import { useState, useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import Lobby from './components/Lobby';
import Game from './components/Game';
import { soundManager } from './utils/SoundManager';

function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const [gameKey, setGameKey] = useState(0);
  const [gameState, setGameState] = useState<'lobby' | 'waiting' | 'countdown' | 'playing' | 'finished'>('lobby');
  const [roomId, setRoomId] = useState<string>('');
  const [players, setPlayers] = useState<Array<{ id: string; name: string }>>([]);
  const [isHost, setIsHost] = useState(false);
  const [canStartGame, setCanStartGame] = useState(false);
  const [countdownCount, setCountdownCount] = useState(0);
  const [gameEndData, setGameEndData] = useState<{ winnerId: string; winnerName: string; loserId: string; loserName: string } | null>(null);
  const [replayRequest, setReplayRequest] = useState<{ fromPlayerId: string; fromPlayerName: string } | null>(null);
  const [soundInitialized, setSoundInitialized] = useState(false);
  
  const [playerName, setPlayerName] = useState(() => {
    return localStorage.getItem('battle-tetris-nickname') || '';
  });

  useEffect(() => {
    // 동일 출처 사용 (프로덕션/로컬 모두 동작)
    const serverUrl = import.meta.env.VITE_SOCKET_URL || window.location.origin;

    const newSocket = io(serverUrl, {
      transports: ['websocket', 'polling'],
      timeout: 10000,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    newSocket.on('connect', () => {
      console.log('[App] 서버에 연결됨! socket.id:', newSocket.id);
      setConnectionStatus('connected');
    });

    newSocket.on('connect_error', (err) => {
      console.log('[App] 연결 오류:', err.message);
      setConnectionStatus('error');
    });

    newSocket.on('disconnect', (reason) => {
      console.log('[App] 연결 해제:', reason);
      if (reason !== 'io client disconnect') {
        setConnectionStatus('connecting');
      }
    });

    // 게임 관련 이벤트 핸들러들
    newSocket.on('joined', (data: { roomId: string; playerId: string; players: Array<{ id: string; name: string }>; isHost: boolean; canStartGame: boolean; gameState: string }) => {
      console.log('[App] 방 입장:', data);
      setRoomId(data.roomId);
      setPlayers(data.players);
      setIsHost(data.isHost);
      setCanStartGame(data.canStartGame);
      setGameState(data.isHost ? 'waiting' : 'waiting');
      
      // 첫 사용자 상호작용 후 BGM 시작
      if (!soundInitialized) {
        setTimeout(() => {
          soundManager.startBGM();
          setSoundInitialized(true);
        }, 500);
      }
    });

    newSocket.on('waiting_for_player', (data: { roomId: string }) => {
      console.log('[App] 플레이어 대기 중:', data);
      setGameState('waiting');
    });

    newSocket.on('player_joined', (data: { playerId: string; playerName: string; roomFull?: boolean }) => {
      console.log('[App] 플레이어 입장:', data);
      if (data.roomFull) {
        setGameState('waiting');
      }
    });

    newSocket.on('countdown_start', (data: { count: number }) => {
      console.log('[App] 카운트다운 시작:', data);
      setGameState('countdown');
      setCountdownCount(data.count);
    });

    newSocket.on('countdown_tick', (data: { count: number }) => {
      console.log('[App] 카운트다운:', data.count);
      setCountdownCount(data.count);
    });

    newSocket.on('game_start', (data: { players: Array<{ id: string; name: string }> }) => {
      console.log('[App] 게임 시작!', data);
      setGameState('playing');
      setPlayers(data.players);
      setGameKey(prev => prev + 1); // 게임 컴포넌트 리렌더링
    });

    newSocket.on('replay_start', (data: { players: Array<{ id: string; name: string }> }) => {
      console.log('[App] 게임 재시작!', data);
      setGameState('playing');
      setPlayers(data.players);
      setGameKey(prev => prev + 1); // 게임 컴포넌트 리렌더링
      setReplayRequest(null); // 리플레이 요청 초기화
    });

    newSocket.on('game_end', (data: { winnerId: string; winnerName: string; loserId: string; loserName: string }) => {
      console.log('[App] 게임 종료:', data);
      setGameState('finished');
      setGameEndData(data);
      soundManager.stopBGM();
    });

    newSocket.on('replay_requested', (data: { fromPlayerId: string; fromPlayerName: string }) => {
      console.log('[App] 리플레이 요청 받음:', data);
      setReplayRequest(data);
    });

    // 소켓 객체를 즉시 상태에 설정 (연결 전에도 이벤트 등록 가능)
    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  const handleLeaveRoom = useCallback(() => {
    setGameKey(prev => prev + 1);
    setGameState('lobby');
    setRoomId('');
    setPlayers([]);
    setIsHost(false);
    setCanStartGame(false);
    setGameEndData(null);
    setReplayRequest(null);
    soundManager.stopBGM();
  }, []);

  const handleStartGame = useCallback(() => {
    if (socket && canStartGame) {
      socket.emit('request_start');
    }
  }, [socket, canStartGame]);

  const handleReplayRequest = useCallback(() => {
    if (socket && gameEndData) {
      const currentPlayer = players.find(p => p.id === socket.id);
      if (currentPlayer) {
        socket.emit('replay_request', {
          fromPlayerId: socket.id,
          fromPlayerName: currentPlayer.name,
        });
      }
    }
  }, [socket, gameEndData, players]);

  const handleReplayAccept = useCallback(() => {
    if (socket && replayRequest) {
      socket.emit('replay_accept', {
        fromPlayerId: replayRequest.fromPlayerId,
      });
    }
  }, [socket, replayRequest]);

  const handleSettingsChange = useCallback((settings: { serverUrl?: string; playerName?: string }) => {
    if (settings.playerName !== undefined) {
      setPlayerName(settings.playerName);
      localStorage.setItem('battle-tetris-nickname', settings.playerName);
    }
  }, []);

  // 게임 상태별 렌더링
  if (gameState === 'playing') {
    return (
      <Game
        key={gameKey}
        socket={socket}
        roomId={roomId}
        players={players}
        onLeaveRoom={handleLeaveRoom}
      />
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      <Lobby
        key={gameKey}
        socket={socket}
        connectionStatus={connectionStatus}
        initialPlayerName={playerName}
        gameState={gameState}
        roomId={roomId}
        players={players}
        isHost={isHost}
        canStartGame={canStartGame}
        onLeaveRoom={handleLeaveRoom}
        onSettingsChange={handleSettingsChange}
        onStartGame={handleStartGame}
        onReplayRequest={handleReplayRequest}
        onReplayAccept={handleReplayAccept}
      />
      
      {/* 카운트다운 오버레이 */}
      {gameState === 'countdown' && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            fontSize: '8rem',
            fontWeight: 'bold',
            color: countdownCount <= 1 ? '#00ff00' : '#ffffff',
            textShadow: '0 0 20px currentColor',
            animation: 'pulse 1s ease-in-out',
          }}>
            {countdownCount === 0 ? 'Play!' : countdownCount}
          </div>
        </div>
      )}
      
      {/* 게임 종료 오버레이 */}
      {gameState === 'finished' && gameEndData && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.9)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          color: 'white',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '3rem', fontWeight: 'bold', marginBottom: '2rem', color: '#00ff00' }}>
            🎉 {gameEndData.winnerName} 승리! 🎉
          </div>
          
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button 
              onClick={handleReplayRequest}
              style={{
                padding: '1rem 2rem',
                fontSize: '1.2rem',
                backgroundColor: '#00ff00',
                color: '#000',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 'bold',
              }}
            >
              🔄 Replay
            </button>
            
            <button 
              onClick={handleLeaveRoom}
              style={{
                padding: '1rem 2rem',
                fontSize: '1.2rem',
                backgroundColor: '#ff4444',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 'bold',
              }}
            >
              🏠 뒤로가기
            </button>
          </div>
        </div>
      )}
      
      {/* 리플레이 요청 오버레이 */}
      {replayRequest && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          color: 'white',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '1.5rem', marginBottom: '2rem' }}>
            플레이어 {replayRequest.fromPlayerName}의<br />
            Replay 동의를 기다립니다...
          </div>
          
          <button 
            onClick={handleReplayAccept}
            style={{
              padding: '1rem 2rem',
              fontSize: '1.2rem',
              backgroundColor: '#00ff00',
              color: '#000',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 'bold',
            }}
          >
            ✅ 동의
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
