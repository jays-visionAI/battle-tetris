import { useState, useCallback } from 'react';
import Lobby from './components/Lobby';

function App() {
  const [gameKey, setGameKey] = useState(0);

  const handleLeaveRoom = useCallback(() => {
    // gameKey를 변경하여 Lobby 컴포넌트를 강제로 다시 마운트
    setGameKey(prev => prev + 1);
  }, []);

  return <Lobby key={gameKey} />;
}

export default App;
