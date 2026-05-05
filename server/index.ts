import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface Player {
  id: string;
  socket: Socket;
  name: string;
  board: (string | null)[][];
  score: number;
  lines: number;
}

interface Room {
  id: string;
  players: Map<string, Player>;
  gameStarted: boolean;
  gameState: 'waiting' | 'countdown' | 'playing' | 'finished';
  hostId?: string; // 방 생성자
  startRequestedBy?: string; // 시작 요청한 플레이어
  countdownTimer?: NodeJS.Timeout;
}

const rooms = new Map<string, Room>();

function generateRoomId(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function createEmptyBoard(): (string | null)[][] {
  return Array.from({ length: 20 }, () => Array(10).fill(null));
}

function createRoom(): Room {
  const id = generateRoomId();
  const room: Room = {
    id,
    players: new Map(),
    gameStarted: false,
    gameState: 'waiting',
  };
  rooms.set(id, room);
  return room;
}

function getOrCreateRoom(roomId?: string): Room {
  if (roomId && rooms.has(roomId)) {
    const room = rooms.get(roomId)!;
    if (room.players.size < 2) {
      return room;
    }
  }
  return createRoom();
}

function cleanupRoom(roomId: string): void {
  const room = rooms.get(roomId);
  if (room && room.players.size === 0) {
    rooms.delete(roomId);
  }
}

/** 모든 방의 목록을 생성하여 반환 */
function getRoomList(): Array<{ id: string; playerCount: number; maxPlayers: number; hasStarted: boolean }> {
  const list: Array<{ id: string; playerCount: number; maxPlayers: number; hasStarted: boolean }> = [];
  rooms.forEach((room) => {
    list.push({
      id: room.id,
      playerCount: room.players.size,
      maxPlayers: 2,
      hasStarted: room.gameStarted,
    });
  });
  return list;
}

/** 모든 연결된 클라이언트에게 방 목록 브로드캐스트 */
function broadcastRoomList(): void {
  const roomList = getRoomList();
  io.emit('rooms_list', roomList);
}

const app = express();
const httpServer = createServer(app);

// Socket.IO 서버 설정
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || '*',
    methods: ['GET', 'POST'],
  },
  // Render.com 환경에서 WebSocket 연결 안정성 향상
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ['websocket', 'polling'],
  allowEIO3: true,
});

// Health check 엔드포인트 (Render.com 로드밸런서용)
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    rooms: rooms.size,
    connections: io.engine.clientsCount,
  });
});

// 프로덕션: 빌드된 클라이언트 파일 제공
// 여러 가능한 경로를 시도하여 dist/client 디렉토리 찾기
const possiblePaths = [
  path.join(__dirname, '../dist/client'),       // 개발 환경 (server/index.ts → dist/client)
  path.join(__dirname, '../../dist/client'),     // Render.com 배포 환경
  path.join(process.cwd(), 'dist/client'),       // 현재 작업 디렉토리 기준
];

let clientDistPath = '';
for (const p of possiblePaths) {
  if (fs.existsSync(p)) {
    clientDistPath = p;
    break;
  }
}

if (!clientDistPath) {
  // 기본값 설정
  clientDistPath = path.join(__dirname, '../dist/client');
}

console.log(`[Server] 클라이언트 파일 제공 경로: ${clientDistPath}`);

app.use(express.static(clientDistPath));

// 프로덕션에서 SPA fallback — 모든 경로를 index.html로
app.get('*', (req, res) => {
  res.sendFile(path.join(clientDistPath, 'index.html'));
});

io.on('connection', (socket: Socket) => {
  console.log(`[Server] 클라이언트 연결됨: ${socket.id}`);

  let currentRoomId: string | null = null;

  // 새 클라이언트가 접속하면 현재 방 목록 전송
  socket.emit('rooms_list', getRoomList());

  socket.on('join', (data: { roomId?: string; playerName: string }) => {
    const room = getOrCreateRoom(data.roomId);
    currentRoomId = room.id;

    // 첫 번째 플레이어면 호스트로 설정
    if (room.players.size === 0) {
      room.hostId = socket.id;
    }

    const player: Player = {
      id: socket.id,
      socket,
      name: data.playerName || `플레이어 ${room.players.size + 1}`,
      board: createEmptyBoard(),
      score: 0,
      lines: 0,
    };

    room.players.set(socket.id, player);
    socket.join(room.id);

    console.log(`[Server] 플레이어 ${player.name}(${socket.id}) 방 ${room.id} 입장`);

    const playersInRoom = Array.from(room.players.values()).map(p => ({
      id: p.id,
      name: p.name,
    }));

    const isHost = socket.id === room.hostId;
    const isSecondPlayer = room.players.size === 2 && !isHost;

    socket.emit('joined', {
      roomId: room.id,
      playerId: socket.id,
      players: playersInRoom,
      isHost,
      canStartGame: isSecondPlayer,
      gameState: room.gameState,
    });

    // 방 목록 브로드캐스트
    broadcastRoomList();

    if (room.players.size === 2) {
      // 2명이 입장했을 때
      socket.to(room.id).emit('player_joined', {
        playerId: socket.id,
        playerName: data.playerName || `플레이어 ${room.players.size}`,
        roomFull: true,
      });
    } else {
      // 호스트가 입장한 경우 (대기 중)
      socket.emit('waiting_for_player', { roomId: room.id });
    }
  });

  socket.on('leave_room', () => {
    if (!currentRoomId) return;

    const room = rooms.get(currentRoomId);
    if (!room) return;

    const player = room.players.get(socket.id);
    room.players.delete(socket.id);
    socket.leave(currentRoomId);

    if (player) {
      console.log(`[Server] 플레이어 ${player.name}(${socket.id}) 방 ${currentRoomId} 퇴장`);
      room.players.forEach((p) => {
        p.socket.emit('opponent_left', { name: player.name });
      });
    }

    cleanupRoom(currentRoomId);
    currentRoomId = null;

    // 방 목록 브로드캐스트
    broadcastRoomList();
  });

  socket.on('attack', (data: { lines: number; fromPlayerId: string }) => {
    if (!currentRoomId) return;
    
    const room = rooms.get(currentRoomId);
    if (!room) return;

    console.log(`[Server] 플레이어 ${data.fromPlayerId}가 ${data.lines}줄 공격 전송`);
    
    room.players.forEach((player) => {
      if (player.id !== data.fromPlayerId) {
        player.socket.emit('attacked', { lines: data.lines });
      }
    });
  });

  // 실시간 게임플레이 액션 처리 (모든 조작을 실시간 공유)
  socket.on('gameplay_action', (data: {
    action: string;
    data: any;
    board: (string | null)[][];
    currentPiece: any;
    nextPiece: any;
    score: number;
    lines: number;
    level: number;
    fromPlayerId: string;
    timestamp: number;
  }) => {
    if (!currentRoomId) return;
    
    const room = rooms.get(currentRoomId);
    if (!room) return;

    // 같은 방의 다른 플레이어에게 즉시 전송
    room.players.forEach((p) => {
      if (p.id !== data.fromPlayerId) {
        p.socket.emit('gameplay_action', {
          action: data.action,
          data: data.data,
          board: data.board,
          currentPiece: data.currentPiece,
          nextPiece: data.nextPiece,
          score: data.score,
          lines: data.lines,
          level: data.level,
          fromPlayerId: data.fromPlayerId,
          timestamp: data.timestamp,
        });
      }
    });
  });

  socket.on('board_update', (data: { 
    board: (string | null)[][]; 
    score: number; 
    lines: number; 
    fromPlayerId: string 
  }) => {
    if (!currentRoomId) return;
    
    const room = rooms.get(currentRoomId);
    if (!room) return;

    const player = room.players.get(data.fromPlayerId);
    if (player) {
      player.board = data.board;
      player.score = data.score;
      player.lines = data.lines;
    }

    room.players.forEach((p) => {
      if (p.id !== data.fromPlayerId) {
        p.socket.emit('board_update', {
          board: data.board,
          score: data.score,
          lines: data.lines,
          fromPlayerId: data.fromPlayerId,
        });
      }
    });
  });

  socket.on('game_over', (data: { winnerId: string; loserId: string; winnerName: string; loserName: string }) => {
    if (!currentRoomId) return;
    
    const room = rooms.get(currentRoomId);
    if (!room) return;

    room.gameState = 'finished';
    room.gameStarted = false;

    io.to(room.id).emit('game_end', {
      winnerId: data.winnerId,
      loserId: data.loserId,
      winnerName: data.winnerName,
      loserName: data.loserName,
    });
  });

  socket.on('rematch_request', () => {
    if (!currentRoomId) return;
    
    const room = rooms.get(currentRoomId);
    if (!room) return;

    socket.to(room.id).emit('rematch_requested', { from: socket.id });
  });

  // 게임 시작 요청 (두 번째 플레이어만 가능)
  socket.on('request_start', () => {
    if (!currentRoomId) return;
    
    const room = rooms.get(currentRoomId);
    if (!room || room.gameState !== 'waiting' || room.players.size !== 2) return;

    const isSecondPlayer = socket.id !== room.hostId;
    if (!isSecondPlayer) return; // 호스트는 시작 불가

    // 카운트다운 시작
    room.gameState = 'countdown';
    room.startRequestedBy = socket.id;
    
    console.log(`[Server] 게임 시작 카운트다운! 방 ${room.id}`);
    
    let countdown = 3;
    io.to(room.id).emit('countdown_start', { count: countdown });
    
    const countdownInterval = setInterval(() => {
      countdown--;
      if (countdown > 0) {
        io.to(room.id).emit('countdown_tick', { count: countdown });
      } else {
        clearInterval(countdownInterval);
        
        // 게임 시작!
        room.gameState = 'playing';
        room.gameStarted = true;
        
        const playersInRoom = Array.from(room.players.values()).map(p => ({
          id: p.id,
          name: p.name,
        }));
        
        io.to(room.id).emit('game_start', {
          players: playersInRoom,
        });
        
        console.log(`[Server] 게임 시작! 방 ${room.id}`);
      }
    }, 1000);
  });

  // Replay 요청
  socket.on('replay_request', (data: { fromPlayerId: string; fromPlayerName: string }) => {
    if (!currentRoomId) return;
    
    const room = rooms.get(currentRoomId);
    if (!room) return;

    // 상대방에게 Replay 요청 전달
    room.players.forEach((player) => {
      if (player.id !== data.fromPlayerId) {
        player.socket.emit('replay_requested', {
          fromPlayerId: data.fromPlayerId,
          fromPlayerName: data.fromPlayerName,
        });
      }
    });
  });

  // Replay 수락
  socket.on('replay_accept', (data: { fromPlayerId: string }) => {
    if (!currentRoomId) return;
    
    const room = rooms.get(currentRoomId);
    if (!room) return;

    // 카운트다운 시작
    room.gameState = 'countdown';
    
    let countdown = 3;
    io.to(room.id).emit('countdown_start', { count: countdown });
    
    const countdownInterval = setInterval(() => {
      countdown--;
      if (countdown > 0) {
        io.to(room.id).emit('countdown_tick', { count: countdown });
      } else {
        clearInterval(countdownInterval);
        
        // 게임 재시작!
        room.gameState = 'playing';
        room.gameStarted = true;
        
        const playersInRoom = Array.from(room.players.values()).map(p => ({
          id: p.id,
          name: p.name,
        }));
        
        io.to(room.id).emit('replay_start', {
          players: playersInRoom,
        });
        
        console.log(`[Server] 게임 재시작! 방 ${room.id}`);
      }
    }, 1000);
  });

  socket.on('rematch_accept', () => {
    if (!currentRoomId) return;
    
    const room = rooms.get(currentRoomId);
    if (!room) return;

    room.players.forEach((player) => {
      player.socket.emit('rematch_start');
    });

    room.gameStarted = false;
  });

  socket.on('disconnect', () => {
    console.log(`[Server] 클라이언트 연결 해제: ${socket.id}`);
    
    if (currentRoomId) {
      const room = rooms.get(currentRoomId);
      if (room) {
        const disconnectedPlayer = room.players.get(socket.id);
        room.players.delete(socket.id);
        
        if (disconnectedPlayer) {
          room.players.forEach((player) => {
            player.socket.emit('opponent_left', { name: disconnectedPlayer.name });
          });
        }
        
        cleanupRoom(currentRoomId);
      }
    }

    // 방 목록 브로드캐스트
    broadcastRoomList();
  });
});

const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
  console.log(`🎮 Battle Tetris 서버 실행 중 (포트 ${PORT})`);
  console.log(`📦 클라이언트 파일 제공 경로: ${clientDistPath}`);
});

export { io, rooms };
