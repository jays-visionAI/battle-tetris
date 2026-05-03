import { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import Lobby from './components/Lobby';

function App() {
  const [gameKey, setGameKey] = useState(0);
  const socketRef = useRef<Socket | null>(null);
  const [playerName, setPlayerName] = useState(() => {
    return localStorage.getItem('battle-tetris-nickname') || '';
  });

  useEffect(() => {
    // 서버 URL 결정: 환경 변수 > 로컬호스트
    const serverUrl = import.meta.env.VITE_SOCKET_URL || 'http://127.0.0.1:3001';
    
    const socket = io(serverUrl, {
      transports: ['websocket', 'polling'],
      timeout: 10000,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });
    
    socket.on('connect', () => {
      console.log('서버에 연결됨! socket.id:', socket.id);
    });
    
    socket.on('connect_error', (err) => {
      console.log('연결 오류:', err.message);
    });
    
    socket.on('disconnect', (reason) => {
      console.log('연결 해제:', reason);
    });
    
    socketRef.current = socket;

    return () => {
      socket.disconnect();
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
      socket={socketRef.current} 
      initialPlayerName={playerName}
      onLeaveRoom={handleLeaveRoom}
      onSettingsChange={handleSettingsChange}
    />
  );
}

export default App;
