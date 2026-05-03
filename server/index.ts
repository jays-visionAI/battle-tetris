import express from 'express';
import path from 'path';
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
const clientDistPath = path.join(__dirname, '../dist/client');
app.use(express.static(clientDistPath));

// 프로덕션에서 SPA fallback — 모든 경로를 index.html로
app.get('*', (req, res) => {
  res.sendFile(path.join(clientDistPath, 'index.html'));
});

io.on('connection', (socket: Socket) => {
  console.log(`클라이언트 연결됨: ${socket.id}`);

  let currentRoomId: string | null = null;

  // 새 클라이언트가 접속하면 현재 방 목록 전송
  socket.emit('rooms_list', getRoomList());

  socket.on('join', (data: { roomId?: string; playerName: string }) => {
    const room = getOrCreateRoom(data.roomId);
    currentRoomId = room.id;

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

    console.log(`플레이어 ${player.name}(${socket.id}) 방 ${room.id} 입장`);

    const playersInRoom = Array.from(room.players.values()).map(p => ({
      id: p.id,
      name: p.name,
    }));

    socket.emit('joined', {
      roomId: room.id,
      playerId: socket.id,
      players: playersInRoom,
    });

    // 방 목록 브로드캐스트
    broadcastRoomList();

    if (room.players.size === 2 && !room.gameStarted) {
      room.gameStarted = true;
      io.to(room.id).emit('game_start', {
        players: playersInRoom,
      });
      console.log(`게임 시작! 방 ${room.id}`);
    } else {
      socket.emit('waiting', { roomId: room.id });
      socket.to(room.id).emit('player_joined', {
        playerId: socket.id,
        playerName: data.playerName || `플레이어 ${room.players.size}`,
      });
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
      console.log(`플레이어 ${player.name}(${socket.id}) 방 ${currentRoomId} 퇴장`);
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

    console.log(`플레이어 ${data.fromPlayerId}가 ${data.lines}줄 공격 전송`);
    
    room.players.forEach((player) => {
      if (player.id !== data.fromPlayerId) {
        player.socket.emit('attacked', { lines: data.lines });
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

  socket.on('game_over', (data: { winnerId: string; loserId: string }) => {
    if (!currentRoomId) return;
    
    const room = rooms.get(currentRoomId);
    if (!room) return;

    io.to(room.id).emit('game_end', {
      winnerId: data.winnerId,
      loserId: data.loserId,
    });
  });

  socket.on('rematch_request', () => {
    if (!currentRoomId) return;
    
    const room = rooms.get(currentRoomId);
    if (!room) return;

    socket.to(room.id).emit('rematch_requested', { from: socket.id });
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
    console.log(`클라이언트 연결 해제: ${socket.id}`);
    
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
  console.log(`📦 클라이언트 파일 제공 경로: ${path.join(__dirname, '../dist/client')}`);
});

export { io, rooms };
