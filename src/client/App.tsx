import { useState, useCallback, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import Lobby from './components/Lobby';

function App() {
  const [gameKey, setGameKey] = useState(0);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || '';
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      timeout: 5000,
    });
    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  const handleLeaveRoom = useCallback(() => {
    setGameKey(prev => prev + 1);
  }, []);

  return <Lobby key={gameKey} socket={socketRef.current} />;
}

export default App;
