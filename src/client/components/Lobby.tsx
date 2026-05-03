import { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import Game from './Game';

interface Player {
  id: string;
  name: string;
}

interface RoomInfo {
  id: string;
  playerCount: number;
  maxPlayers: number;
  hasStarted: boolean;
}

export default function Lobby() {
  const [playerName, setPlayerName] = useState('');
  const [roomId, setRoomId] = useState('');
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [isWaiting, setIsWaiting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [players, setPlayers] = useState<Player[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [roomList, setRoomList] = useState<RoomInfo[]>([]);
  const [showRoomList, setShowRoomList] = useState(true);

  useEffect(() => {
    const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || '';
    const newSocket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      timeout: 5000,
    });

    newSocket.on('connect', () => {
      console.log('서버에 연결됨');
      setConnected(true);
      setError(null);
    });

    newSocket.on('connect_error', () => {
      console.log('서버 연결 실패 - 데모 모드로 실행');
      setConnected(false);
    });

    newSocket.on('disconnect', () => {
      console.log('서버 연결 해제');
      setConnected(false);
    });

    newSocket.on('rooms_list', (rooms: RoomInfo[]) => {
      setRoomList(rooms);
    });

    newSocket.on('joined', (data: { roomId: string; playerId: string; players: Player[] }) => {
      setCurrentRoomId(data.roomId);
      setPlayerId(data.playerId);
      setPlayers(data.players);
      setShowRoomList(false);
    });

    newSocket.on('waiting', () => {
      setIsWaiting(true);
    });

    newSocket.on('player_joined', (data: { playerId: string; playerName: string }) => {
      setPlayers(prev => [...prev, { id: data.playerId, name: data.playerName }]);
    });

    newSocket.on('game_start', (data: { players: Player[] }) => {
      setPlayers(data.players);
      setIsWaiting(false);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  const handleCreateRoom = () => {
    if (!socket) {
      setError('서버에 연결되지 않았습니다. 데모 모드로 진행합니다.');
      startDemoGame();
      return;
    }
    
    setError(null);
    setIsWaiting(true);
    setShowRoomList(false);

    socket.emit('join', { roomId: undefined, playerName: playerName || '플레이어1' });
  };

  const handleJoinRoom = () => {
    if (!roomId.trim()) {
      setError('방 코드를 입력해주세요');
      return;
    }
    
    if (!socket || !connected) {
      setError('서버에 연결되지 않았습니다.');
      return;
    }
    
    setError(null);
    setShowRoomList(false);

    socket.emit('join', { roomId: roomId.toUpperCase(), playerName: playerName || '플레이어1' });
  };

  const handleJoinRoomById = (targetRoomId: string) => {
    if (!socket || !connected) {
      setError('서버에 연결되지 않았습니다.');
      return;
    }

    setError(null);
    setShowRoomList(false);

    socket.emit('join', { roomId: targetRoomId, playerName: playerName || '플레이어1' });
  };

  const startDemoGame = () => {
    const simulatedRoomId = 'DEMO' + Math.random().toString(36).substring(2, 6).toUpperCase();
    const simulatedPlayerId = `demo_${Date.now()}`;
    
    setCurrentRoomId(simulatedRoomId);
    setPlayerId(simulatedPlayerId);
    setPlayers([
      { id: 'demo_opponent', name: '데모 상대' },
      { id: simulatedPlayerId, name: playerName || '플레이어1' }
    ]);
    setIsWaiting(false);
    setShowRoomList(false);
  };

  // 게임 화면으로 전환
  if (currentRoomId && playerId) {
    return <Game playerId={playerId} roomId={currentRoomId} onLeaveRoom={() => {
      setCurrentRoomId(null);
      setPlayerId(null);
      setPlayers([]);
      setIsWaiting(false);
      setShowRoomList(true);
    }} />;
  }

  return (
    <div style={styles.container}>
      <div style={styles.titleContainer}>
        <h1 style={styles.title}>배틀 테트리스</h1>
        <p style={styles.subtitle}>실시간 1:1 테트리스 대결</p>
      </div>

      <div style={styles.statusBar}>
        <div style={{
          ...styles.statusDot,
          backgroundColor: connected ? '#00ff00' : '#ff4444',
        }} />
        <span style={styles.statusText}>
          {connected ? '서버 연결됨' : '데모 모드 (서버 연결 없음)'}
        </span>
      </div>

      <div style={styles.card}>
        <div style={styles.inputGroup}>
          <label style={styles.label}>닉네임</label>
          <input
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="닉네임을 입력하세요"
            style={styles.input}
            maxLength={20}
          />
        </div>

        <div style={styles.divider}>
          <span style={styles.dividerText}>또는</span>
        </div>

        <div style={styles.inputGroup}>
          <label style={styles.label}>방 코드 입력</label>
          <div style={styles.joinRow}>
            <input
              type="text"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value.toUpperCase())}
              placeholder="ABC123"
              style={styles.input}
              maxLength={6}
            />
            <button style={styles.joinButton} onClick={handleJoinRoom}>
              참가
            </button>
          </div>
        </div>

        {error && <p style={styles.error}>{error}</p>}

        <button 
          style={styles.createButton} 
          onClick={handleCreateRoom}
        >
          {isWaiting ? '방 생성 중...' : '새 방 만들기'}
        </button>

        {isWaiting && currentRoomId && (
          <div style={styles.waitingContainer}>
            <div style={styles.spinner} />
            <p style={styles.waitingText}>상대방을 기다리는 중...</p>
            <p style={styles.roomCode}>방 코드: <strong>{currentRoomId}</strong></p>
            <p style={styles.shareText}>이 코드를 상대방에게 공유하세요</p>
          </div>
        )}
      </div>

      {/* 방 목록 */}
      {connected && showRoomList && (
        <div style={styles.roomListContainer}>
          <h3 style={styles.roomListTitle}>
            📋 현재 방 목록 ({roomList.length}개)
          </h3>
          {roomList.length === 0 ? (
            <div style={styles.noRooms}>
              <p>아직 생성된 방이 없습니다.</p>
              <p style={styles.noRoomsHint}>'새 방 만들기' 버튼을 눌러 방을 생성하세요!</p>
            </div>
          ) : (
            <div style={styles.roomList}>
              {roomList.map((room) => (
                <div
                  key={room.id}
                  style={{
                    ...styles.roomItem,
                    opacity: room.hasStarted ? 0.5 : 1,
                    cursor: room.hasStarted ? 'not-allowed' : 'pointer',
                  }}
                  onClick={() => {
                    if (!room.hasStarted && room.playerCount < room.maxPlayers) {
                      handleJoinRoomById(room.id);
                    }
                  }}
                >
                  <div style={styles.roomItemLeft}>
                    <span style={styles.roomItemCode}>{room.id}</span>
                    <span style={styles.roomItemStatus}>
                      {room.hasStarted ? '게임 중' : '대기 중'}
                    </span>
                  </div>
                  <div style={styles.roomItemRight}>
                    <span style={styles.roomItemPlayers}>
                      👤 {room.playerCount}/{room.maxPlayers}
                    </span>
                    {!room.hasStarted && room.playerCount < room.maxPlayers && (
                      <span style={styles.roomItemJoin}>입장</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={styles.instructions}>
        <h3 style={styles.instructionsTitle}>게임 규칙</h3>
        <div style={styles.ruleList}>
          <div style={styles.ruleItem}>
            <span style={styles.ruleIcon}>🎯</span>
            <span>상대보다 오래 살아남으세요!</span>
          </div>
          <div style={styles.ruleItem}>
            <span style={styles.ruleIcon}>⚡</span>
            <span>줄을 삭제하면 상대방에게 공격 라인을 보냅니다</span>
          </div>
          <div style={styles.ruleItem}>
            <span style={styles.ruleIcon}>💀</span>
            <span>상대방의 블록이 꼭대기에 도달하면 승리!</span>
          </div>
        </div>
      </div>

      <div style={styles.controls}>
        <h3 style={styles.controlsTitle}>조작법</h3>
        <div style={styles.controlList}>
          <span><strong>← →</strong> 좌우 이동</span>
          <span><strong>↑</strong> 회전</span>
          <span><strong>↓</strong> 아래로 이동</span>
          <span><strong>Space</strong> 한 번에 내리기</span>
          <span><strong>P</strong> 일시 정지</span>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
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
    justifyContent: 'center',
    minHeight: '100vh',
    backgroundColor: '#0a0a1a',
    color: '#fff',
    fontFamily: 'Arial, sans-serif',
    padding: '20px',
  },
  titleContainer: {
    textAlign: 'center',
    marginBottom: '30px',
  },
  title: {
    fontSize: '56px',
    fontWeight: 'bold',
    color: '#00ffff',
    textShadow: '0 0 30px rgba(0, 255, 255, 0.5), 0 0 60px rgba(0, 255, 255, 0.3)',
    margin: 0,
    letterSpacing: '6px',
  },
  subtitle: {
    fontSize: '18px',
    color: '#888',
    marginTop: '10px',
  },
  statusBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '20px',
    padding: '8px 16px',
    backgroundColor: '#1a1a2e',
    borderRadius: '20px',
  },
  statusDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    animation: 'pulse 2s infinite',
  },
  statusText: {
    fontSize: '12px',
    color: '#888',
  },
  card: {
    backgroundColor: '#1a1a2e',
    padding: '40px',
    borderRadius: '16px',
    border: '2px solid #333',
    width: '100%',
    maxWidth: '400px',
    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)',
  },
  inputGroup: {
    marginBottom: '20px',
  },
  label: {
    display: 'block',
    marginBottom: '8px',
    color: '#888',
    fontSize: '14px',
    textTransform: 'uppercase',
    letterSpacing: '1px',
  },
  input: {
    width: '100%',
    padding: '12px 16px',
    fontSize: '16px',
    backgroundColor: '#0a0a1a',
    border: '2px solid #333',
    borderRadius: '8px',
    color: '#fff',
    outline: 'none',
    transition: 'border-color 0.3s',
    boxSizing: 'border-box',
  },
  joinRow: {
    display: 'flex',
    gap: '10px',
  },
  joinButton: {
    padding: '12px 24px',
    fontSize: '14px',
    backgroundColor: '#333',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: 'bold',
    transition: 'all 0.3s',
    whiteSpace: 'nowrap',
  },
  divider: {
    display: 'flex',
    alignItems: 'center',
    margin: '30px 0',
  },
  dividerText: {
    flex: 1,
    textAlign: 'center',
    color: '#666',
    fontSize: '12px',
    textTransform: 'uppercase',
  },
  createButton: {
    width: '100%',
    padding: '16px',
    fontSize: '18px',
    backgroundColor: '#00ffff',
    color: '#0a0a1a',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: 'bold',
    transition: 'all 0.3s',
    marginTop: '10px',
  },
  error: {
    color: '#ff4444',
    fontSize: '14px',
    marginTop: '10px',
    textAlign: 'center',
  },
  waitingContainer: {
    marginTop: '30px',
    padding: '20px',
    backgroundColor: '#0a0a1a',
    borderRadius: '8px',
    textAlign: 'center',
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '4px solid #333',
    borderTop: '4px solid #00ffff',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    margin: '0 auto 20px',
  },
  waitingText: {
    fontSize: '18px',
    color: '#00ffff',
    marginBottom: '20px',
  },
  roomCode: {
    fontSize: '32px',
    color: '#fff',
    letterSpacing: '4px',
    marginBottom: '10px',
  },
  shareText: {
    fontSize: '14px',
    color: '#888',
  },
  // 방 목록 스타일
  roomListContainer: {
    marginTop: '30px',
    width: '100%',
    maxWidth: '400px',
    animation: 'slideUp 0.5s ease-out',
  },
  roomListTitle: {
    color: '#00ffff',
    marginBottom: '15px',
    fontSize: '16px',
    textAlign: 'center',
  },
  noRooms: {
    textAlign: 'center',
    padding: '30px',
    backgroundColor: '#1a1a2e',
    borderRadius: '12px',
    border: '2px dashed #333',
  },
  noRoomsHint: {
    color: '#666',
    fontSize: '13px',
    marginTop: '8px',
  },
  roomList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  roomItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '14px 18px',
    backgroundColor: '#1a1a2e',
    borderRadius: '10px',
    border: '2px solid #333',
    transition: 'all 0.2s',
  },
  roomItemLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  roomItemCode: {
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: '2px',
  },
  roomItemStatus: {
    fontSize: '12px',
    padding: '3px 8px',
    borderRadius: '4px',
    backgroundColor: '#333',
    color: '#aaa',
  },
  roomItemRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  roomItemPlayers: {
    fontSize: '14px',
    color: '#888',
  },
  roomItemJoin: {
    fontSize: '12px',
    padding: '4px 10px',
    backgroundColor: '#00ffff',
    color: '#0a0a1a',
    borderRadius: '4px',
    fontWeight: 'bold',
  },
  instructions: {
    marginTop: '30px',
    textAlign: 'center',
    color: '#666',
    maxWidth: '400px',
  },
  instructionsTitle: {
    color: '#ffff00',
    marginBottom: '15px',
    fontSize: '16px',
    textTransform: 'uppercase',
    letterSpacing: '2px',
  },
  ruleList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  ruleItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    fontSize: '14px',
    color: '#aaa',
  },
  ruleIcon: {
    fontSize: '20px',
  },
  controls: {
    marginTop: '30px',
    textAlign: 'center',
    color: '#666',
  },
  controlsTitle: {
    color: '#00ffff',
    marginBottom: '15px',
    fontSize: '14px',
    textTransform: 'uppercase',
    letterSpacing: '2px',
  },
  controlList: {
    display: 'flex',
    gap: '20px',
    justifyContent: 'center',
    flexWrap: 'wrap',
    fontSize: '12px',
    color: '#666',
  },
};
