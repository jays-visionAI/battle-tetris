import { Server, Socket } from 'socket.io';
import { createServer } from 'http';

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

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

io.on('connection', (socket: Socket) => {
  console.log(`Client connected: ${socket.id}`);

  let currentRoomId: string | null = null;

  socket.on('join', (data: { roomId?: string; playerName: string }) => {
    const room = getOrCreateRoom(data.roomId);
    currentRoomId = room.id;

    const player: Player = {
      id: socket.id,
      socket,
      name: data.playerName || `Player ${room.players.size + 1}`,
      board: createEmptyBoard(),
      score: 0,
      lines: 0,
    };

    room.players.set(socket.id, player);
    socket.join(room.id);

    console.log(`Player ${player.name} (${socket.id}) joined room ${room.id}`);

    const playersInRoom = Array.from(room.players.values()).map(p => ({
      id: p.id,
      name: p.name,
    }));

    socket.emit('joined', {
      roomId: room.id,
      playerId: socket.id,
      players: playersInRoom,
    });

    if (room.players.size === 2 && !room.gameStarted) {
      room.gameStarted = true;
      io.to(room.id).emit('game_start', {
        players: playersInRoom,
      });
      console.log(`Game started in room ${room.id}`);
    } else {
      socket.emit('waiting', { roomId: room.id });
      socket.to(room.id).emit('player_joined', {
        playerId: socket.id,
        playerName: data.playerName || `Player ${room.players.size}`,
      });
    }
  });

  socket.on('attack', (data: { lines: number; fromPlayerId: string }) => {
    if (!currentRoomId) return;
    
    const room = rooms.get(currentRoomId);
    if (!room) return;

    console.log(`Player ${data.fromPlayerId} sending ${data.lines} lines of attack`);
    
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
    console.log(`Client disconnected: ${socket.id}`);
    
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
  });
});

const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
  console.log(`🎮 Battle Tetris server running on port ${PORT}`);
});

export { io, rooms };