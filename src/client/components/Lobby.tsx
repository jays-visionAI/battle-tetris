import { useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';

interface Player {
  id: string;
  name: string;
}

interface RoomInfo {
  id: string;
  playerCount: number;
  maxPlayers: number;
  hasStarted: boolean;
  hostName: string;
  hostId: string;
}

interface LobbyProps {
  socket: Socket | null;
  connectionStatus?: 'connecting' | 'connected' | 'error';
  initialPlayerName?: string;
  gameState?: 'lobby' | 'waiting' | 'countdown' | 'playing' | 'finished';
  roomId?: string;
  players?: Array<{ id: string; name: string }>;
  isHost?: boolean;
  canStartGame?: boolean;
  serverUrl?: string;
  onSettingsChange?: (settings: { serverUrl?: string; playerName?: string }) => void;
  onLeaveRoom?: () => void;
  onStartGame?: () => void;
  onReplayRequest?: () => void;
  onReplayAccept?: () => void;
}

function RoomListIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00ffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function PlayerIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function TargetIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffff00" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

function LightningIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffff00" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

function SkullIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ff4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="9" cy="10" r="1.5" fill="#ff4444" />
      <circle cx="15" cy="10" r="1.5" fill="#ff4444" />
      <path d="M8 16c1.5 2 4.5 2 6 0" />
    </svg>
  );
}

export default function Lobby({ 
  socket, 
  connectionStatus, 
  initialPlayerName = '', 
  gameState = 'lobby',
  roomId: propsRoomId = '',
  players: propsPlayers = [],
  isHost = false,
  canStartGame = false,
  serverUrl = '', 
  onSettingsChange, 
  onLeaveRoom,
  onStartGame,
  onReplayRequest,
  onReplayAccept
}: LobbyProps) {
  const [playerName, setPlayerName] = useState(initialPlayerName);
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [isWaiting, setIsWaiting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [players, setPlayers] = useState<Player[]>([]);
  const [roomList, setRoomList] = useState<RoomInfo[]>([]);
  const [showRoomList, setShowRoomList] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsServerUrl, setSettingsServerUrl] = useState(serverUrl || '');
  const [gameStarted, setGameStarted] = useState(false);
  const [joiningRoomId, setJoiningRoomId] = useState<string | null>(null);
  const [joinCodeInput, setJoinCodeInput] = useState('');

  // Sync connectionStatus prop into local state
  useEffect(() => {
    if (connectionStatus === 'connected') {
      setConnected(true);
      setError(null);
    } else if (connectionStatus === 'error') {
      setConnected(false);
    }
  }, [connectionStatus]);

  useEffect(() => {
    if (!socket) return;

    const onConnect = () => {
      console.log('[Lobby] 서버에 연결됨');
      setConnected(true);
      setError(null);
    };

    const onConnectError = (err: Error) => {
      console.log('[Lobby] 서버 연결 실패:', err.message);
      setConnected(false);
    };

    const onDisconnect = () => {
      console.log('[Lobby] 서버 연결 해제');
      setConnected(false);
    };

    const onRoomsList = (rooms: RoomInfo[]) => {
      console.log('[Lobby] 방 목록 수신:', rooms.length, '개');
      setRoomList(rooms);
    };

    const onJoined = (data: { roomId: string; playerId: string; players: Player[] }) => {
      console.log('[Lobby] 방 입장:', data.roomId);
      setCurrentRoomId(data.roomId);
      setPlayerId(data.playerId);
      setPlayers(data.players);
      setShowRoomList(false);
    };

    const onWaiting = () => {
      console.log('[Lobby] 대기 중...');
      setIsWaiting(true);
    };

    const onPlayerJoined = (data: { playerId: string; playerName: string }) => {
      console.log('[Lobby] 플레이어 입장:', data.playerName);
      setPlayers(prev => [...prev, { id: data.playerId, name: data.playerName }]);
    };

    const onGameStart = (data: { players: Player[] }) => {
      console.log('[Lobby] 게임 시작!', data);
      setPlayers(data.players);
      setIsWaiting(false);
      setGameStarted(true);
    };

    const onRoomDeleted = () => {
      console.log('[Lobby] 방이 삭제되었습니다');
      setCurrentRoomId(null);
      setPlayerId(null);
      setPlayers([]);
      setIsWaiting(false);
      setShowRoomList(true);
      setGameStarted(false);
    };

    const onError = (data: { message: string }) => {
      console.log('[Lobby] 서버 에러:', data.message);
      setError(data.message);
    };

    socket.on('connect', onConnect);
    socket.on('connect_error', onConnectError);
    socket.on('disconnect', onDisconnect);
    socket.on('rooms_list', onRoomsList);
    socket.on('joined', onJoined);
    socket.on('waiting', onWaiting);
    socket.on('player_joined', onPlayerJoined);
    socket.on('game_start', onGameStart);
    socket.on('room_deleted', onRoomDeleted);
    socket.on('error', onError);

    // 이미 연결되어 있으면 상태 업데이트
    if (socket.connected) {
      setConnected(true);
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('connect_error', onConnectError);
      socket.off('disconnect', onDisconnect);
      socket.off('rooms_list', onRoomsList);
      socket.off('joined', onJoined);
      socket.off('waiting', onWaiting);
      socket.off('player_joined', onPlayerJoined);
      socket.off('game_start', onGameStart);
      socket.off('room_deleted', onRoomDeleted);
      socket.off('error', onError);
    };
  }, [socket]);

  const handleCreateRoom = () => {
    // 닉네임 필수 체크
    if (!playerName.trim()) {
      setError('닉네임을 입력해주세요');
      return;
    }
    
    if (!socket || !connected) {
      setError('서버에 연결되지 않았습니다. 데모 모드로 진행합니다.');
      startDemoGame();
      return;
    }
    
    setError(null);
    setIsWaiting(true);
    setShowRoomList(false);

    socket.emit('join', { roomId: undefined, playerName: playerName.trim() });
  };

  const handleJoinRoomById = (targetRoomId: string) => {
    // 닉네임 체크
    if (!playerName.trim()) {
      setError('닉네임을 입력해주세요');
      return;
    }
    
    if (!socket || !connected) {
      setError('서버에 연결되지 않았습니다.');
      return;
    }

    setError(null);
    setShowRoomList(false);

    socket.emit('join', { roomId: targetRoomId, playerName: playerName.trim() });
  };

  const startDemoGame = () => {
    if (!playerName.trim()) {
      setError('닉네임을 입력해주세요');
      return;
    }
    
    const simulatedRoomId = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    const simulatedPlayerId = `demo_${Date.now()}`;
    
    setCurrentRoomId(simulatedRoomId);
    setPlayerId(simulatedPlayerId);
    setPlayers([
      { id: 'demo_opponent', name: '데모 상대' },
      { id: simulatedPlayerId, name: playerName.trim() }
    ]);
    setIsWaiting(false);
    setShowRoomList(false);
    setGameStarted(true);
  };

  const handleLeaveRoom = () => {
    if (socket && connected) {
      socket.emit('leave_room');
    }
    setCurrentRoomId(null);
    setPlayerId(null);
    setPlayers([]);
    setIsWaiting(false);
    setShowRoomList(true);
    setGameStarted(false);
    if (onLeaveRoom) {
      onLeaveRoom();
    }
  };

  // 게임은 App.tsx에서 별도로 처리함

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
        <button 
          style={styles.settingsButton}
          onClick={() => setShowSettings(!showSettings)}
          title="설정"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </div>

      {/* 설정 패널 */}
      {showSettings && (
        <div style={styles.settingsPanel}>
          <h3 style={styles.settingsTitle}>설정</h3>
          <div style={styles.inputGroup}>
            <label style={styles.label}>서버 주소</label>
            <input
              type="text"
              value={settingsServerUrl}
              onChange={(e) => setSettingsServerUrl(e.target.value)}
              placeholder="https://battle-tetris.onrender.com"
              style={styles.input}
            />
          </div>
          <button 
            style={styles.saveButton}
            onClick={() => {
              if (onSettingsChange && settingsServerUrl !== serverUrl) {
                onSettingsChange({ serverUrl: settingsServerUrl });
              }
              setShowSettings(false);
            }}
          >
            설정 저장
          </button>
        </div>
      )}

      <div style={styles.card}>
        <div style={styles.inputGroup}>
          <label style={styles.label}>
            닉네임 <span style={{ color: '#ff4444' }}>*필수</span>
          </label>
          <input
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="플레이어 이름"
            style={{
              ...styles.input,
              borderColor: !playerName.trim() && error ? '#ff4444' : '#333',
            }}
            maxLength={20}
          />
        </div>

        {error && <p style={styles.error}>{error}</p>}

        <div style={styles.divider}>
          <span style={styles.dividerLine}></span>
          <span style={styles.dividerText}>또는</span>
          <span style={styles.dividerLine}></span>
        </div>

        {/* 새 방 만들기 */}
        <button 
          style={{
            ...styles.createButton,
            opacity: !playerName.trim() ? 0.6 : 1,
            cursor: !playerName.trim() ? 'not-allowed' : 'pointer',
          }} 
          onClick={handleCreateRoom}
          disabled={!playerName.trim()}
        >
          {isWaiting ? '방 생성 중...' : '새 방 만들기'}
        </button>

        {/* 게임 상태에 따른 UI */}
        {gameState === 'waiting' && propsRoomId && (
          <div style={styles.waitingContainer}>
            <div style={styles.spinner} />
            {isHost ? (
              <>
                <p style={styles.waitingText}>상대방을 기다리는 중...</p>
                <p style={styles.roomCode}>방 코드: <strong>{propsRoomId}</strong></p>
                <p style={styles.shareText}>이 코드를 상대방에게 공유하세요</p>
              </>
            ) : (
              <>
                <p style={styles.waitingText}>방에 입장했습니다.</p>
                <p style={styles.roomCode}>방 코드: <strong>{propsRoomId}</strong></p>
                
                {/* 두 번째 플레이어 시작 버튼 */}
                {canStartGame && (
                  <div style={{ marginTop: '2rem' }}>
                    <p style={styles.shareText}>플레이어 {propsPlayers.find(p => p.id !== (socket?.id))?.name}이 입장했습니다!</p>
                    <button 
                      style={{
                        ...styles.createButton,
                        backgroundColor: '#00ff00',
                        color: '#000',
                        fontWeight: 'bold',
                        animation: 'glow 2s infinite',
                      }}
                      onClick={onStartGame}
                    >
                      🎮 Start Game!
                    </button>
                  </div>
                )}
              </>
            )}
            
            <div style={styles.playersInRoom}>
              <h4 style={{ color: '#00ffff', marginBottom: '1rem' }}>참가자 ({propsPlayers.length}/2)</h4>
              {propsPlayers.map(player => (
                <div key={player.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  marginBottom: '0.5rem',
                  color: player.id === socket?.id ? '#00ff00' : '#ffffff'
                }}>
                  <span>👤</span>
                  <span>{player.name} {player.id === socket?.id ? '(나)' : ''}</span>
                  {player.id === propsPlayers.find(p => isHost && p.id === socket?.id)?.id && <span>👑</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 방 목록 */}
      {connected && showRoomList && (
        <div style={styles.roomListContainer}>
          <h3 style={styles.roomListTitle}>
            <RoomListIcon /> 현재 방 목록 ({roomList.length}개)
          </h3>
          {roomList.length === 0 ? (
            <div style={styles.noRooms}>
              <p>아직 생성된 방이 없습니다.</p>
              <p style={styles.noRoomsHint}>'새 방 만들기' 버튼을 눌러 방을 생성하세요!</p>
            </div>
          ) : (
            <div style={styles.roomList}>
              {roomList.map((room) => (
                <div key={room.id}>
                  <div
                    style={{
                      ...styles.roomItem,
                      opacity: room.hasStarted ? 0.5 : 1,
                      cursor: 'default',
                    }}
                  >
                    <div style={styles.roomItemLeft}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={styles.roomItemHost}>{room.hostName}</span>
                        {room.hostId === playerId && (
                          <span style={{
                            padding: '2px 8px',
                            backgroundColor: '#00ff00',
                            color: '#000',
                            borderRadius: '10px',
                            fontSize: '10px',
                            fontWeight: 'bold',
                          }}>
                            나의 방
                          </span>
                        )}
                        <span style={styles.roomItemStatus}>
                          {room.hasStarted ? '게임 중' : '대기 중'}
                        </span>
                      </div>
                    </div>
                    <div style={styles.roomItemRight}>
                      <span style={styles.roomItemPlayers}>
                        <PlayerIcon /> {room.playerCount}/{room.maxPlayers}
                      </span>
                      {!room.hasStarted && room.playerCount < room.maxPlayers && (
                        <button
                          style={{
                            ...styles.roomItemJoin,
                            border: 'none',
                            cursor: 'pointer',
                          }}
                          onClick={() => {
                            if (!playerName.trim()) {
                              setError('먼저 닉네임을 입력해주세요');
                              return;
                            }
                            setError(null);
                            setJoiningRoomId(room.id);
                            setJoinCodeInput('');
                          }}
                        >
                          입장
                        </button>
                      )}
                      {room.hostId === playerId && !room.hasStarted && (
                        <button
                          style={{
                            padding: '4px 8px',
                            fontSize: '11px',
                            backgroundColor: '#ff4444',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            marginLeft: '4px',
                          }}
                          onClick={() => {
                            if (socket && connected) {
                              socket.emit('delete_room');
                            }
                          }}
                        >
                          삭제
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 코드 입력 영역 */}
                  {joiningRoomId === room.id && (
                    <div style={styles.roomJoinForm}>
                      <label style={{ ...styles.label, marginBottom: '6px', fontSize: '12px' }}>
                        4자리 입장 코드 입력
                      </label>
                      <div style={styles.joinRow}>
                        <input
                          type="text"
                          value={joinCodeInput}
                          onChange={(e) => setJoinCodeInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                          placeholder="0000"
                          style={{
                            ...styles.input,
                            textAlign: 'center',
                            letterSpacing: '4px',
                            fontSize: '18px',
                            fontWeight: 'bold',
                          }}
                          maxLength={4}
                          autoFocus
                        />
                      </div>
                      <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                        <button
                          style={{
                            flex: 1,
                            padding: '10px',
                            fontSize: '14px',
                            backgroundColor: '#ff4444',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                          }}
                          onClick={() => {
                            setJoiningRoomId(null);
                            setJoinCodeInput('');
                          }}
                        >
                          취소
                        </button>
                        <button
                          style={{
                            flex: 2,
                            padding: '10px',
                            fontSize: '14px',
                            backgroundColor: joinCodeInput === room.id ? '#00ff00' : '#333',
                            color: joinCodeInput === room.id ? '#0a0a1a' : '#888',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: joinCodeInput === room.id ? 'pointer' : 'not-allowed',
                            fontWeight: 'bold',
                            transition: 'all 0.2s',
                          }}
                          disabled={joinCodeInput !== room.id}
                          onClick={() => {
                            if (joinCodeInput === room.id) {
                              handleJoinRoomById(room.id);
                              setJoiningRoomId(null);
                              setJoinCodeInput('');
                            }
                          }}
                        >
                          참가하기
                        </button>
                      </div>
                    </div>
                  )}
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
            <TargetIcon />
            <span>상대보다 오래 살아남으세요!</span>
          </div>
          <div style={styles.ruleItem}>
            <LightningIcon />
            <span>줄을 삭제하면 상대방에게 공격 라인을 보냅니다</span>
          </div>
          <div style={styles.ruleItem}>
            <SkullIcon />
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
  settingsButton: {
    marginLeft: 'auto',
    padding: '6px',
    backgroundColor: 'transparent',
    border: '1px solid #333',
    borderRadius: '6px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s',
  },
  settingsPanel: {
    width: '100%',
    maxWidth: '400px',
    marginBottom: '20px',
    padding: '20px',
    backgroundColor: '#1a1a2e',
    borderRadius: '12px',
    border: '2px solid #00ffff',
    animation: 'slideUp 0.3s ease-out',
  },
  settingsTitle: {
    color: '#00ffff',
    marginBottom: '15px',
    fontSize: '18px',
    textAlign: 'center',
  },
  saveButton: {
    width: '100%',
    padding: '12px',
    marginTop: '10px',
    fontSize: '14px',
    backgroundColor: '#00ffff',
    color: '#0a0a1a',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: 'bold',
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
    margin: '25px 0',
  },
  dividerLine: {
    flex: 1,
    height: '1px',
    backgroundColor: '#333',
  },
  dividerText: {
    padding: '0 15px',
    color: '#666',
    fontSize: '12px',
    textTransform: 'uppercase',
    letterSpacing: '2px',
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
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
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
  roomItemHost: {
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#00ffff',
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
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  roomItemJoin: {
    fontSize: '12px',
    padding: '4px 10px',
    backgroundColor: '#00ffff',
    color: '#0a0a1a',
    borderRadius: '4px',
    fontWeight: 'bold',
  },
  roomJoinForm: {
    marginTop: '-4px',
    marginBottom: '8px',
    padding: '14px 18px',
    backgroundColor: '#0f0f25',
    border: '2px solid #ff9900',
    borderTop: 'none',
    borderRadius: '0 0 10px 10px',
    animation: 'slideUp 0.2s ease-out',
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
  playersInRoom: {
    marginTop: '2rem',
    padding: '1rem',
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    borderRadius: '8px',
    border: '1px solid rgba(0, 255, 255, 0.3)',
  },
};
