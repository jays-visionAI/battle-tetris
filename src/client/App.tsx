import { useState, useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import Lobby from './components/Lobby';

function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const [gameKey, setGameKey] = useState(0);
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

    // 소켓 객체를 즉시 상태에 설정 (연결 전에도 이벤트 등록 가능)
    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  const handleLeaveRoom = useCallback(() => {
    setGameKey(prev => prev + 1);
  }, []);

  const handleSettingsChange = useCallback((settings: { serverUrl?: string; playerName?: string }) => {
    if (settings.playerName !== undefined) {
      setPlayerName(settings.playerName);
      localStorage.setItem('battle-tetris-nickname', settings.playerName);
    }
  }, []);

  return (
    <Lobby
      key={gameKey}
      socket={socket}
      connectionStatus={connectionStatus}
      initialPlayerName={playerName}
      onLeaveRoom={handleLeaveRoom}
      onSettingsChange={handleSettingsChange}
    />
  );
}

export default App;
