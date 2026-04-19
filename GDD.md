# 2인용 경쟁 테트리스 (Battle Tetris)

## 1. CONCEPT

**Battle Tetris**는 두 플레이어가 원격으로 접속하여 실시간으로 경쟁하는 테트리스 게임입니다. 한 플레이어가 줄을 삭제하면 상대방의 보드 하단에 해당하는数量的의 공격 라인이 추가됩니다 (1줄 삭제 = 1줄 공격). 먼저 게임오버가 된 플레이어가 지는 방식입니다.

**장르**: 실시간 멀티플레이어 아케이드 게임  
**핵심 게임 루프 (30초 주기)**: 블록 배치 → 줄 삭제 확인 → 상대방 공격 → 다음 블록 Fallon  
**승패 조건**: 상대방의 블록이 화면 상단을 넘으면 패배  
**비주얼 스타일**: 네온 사이버펑크 (어두운 배경 + 발광 테트리스 블록)

---

## 2. PLAYER SYSTEMS

| 항목 | 설명 |
|------|------|
| **조작** | 좌우 이동, 회전, soft drop, hard drop |
| **조작키** | Arrow Left/Right (이동), Arrow Up (회전), Arrow Down (soft drop), Space (hard drop) |
| **시작 위치** | 보드 상단 (y=0) 중앙에서 Fallon |
| **게임오버 조건** | 새로운 블록이 Fallon 위치에서 기존 블록과 충돌할 때 |

---

## 3. COMBAT & ATTACK SYSTEM

**라인 삭제 시 공격 테이블**:

| 삭제 줄 수 | 상대방에게 추가되는 라인 |
|------------|-------------------------|
| 1줄 | 1줄 |
| 2줄 | 2줄 |
| 3줄 | 3줄 |
| 4줄 (Tetris) | 4줄 |

**공격 라인 추가 규칙**:
- 라인은 보드 하단에서 위로 쌓임
- 추가된 라인에 랜덤하게 1-2개의 빈 공간 생성 (공격 피해 완하)
- 쌓인 라인이 existing 블록을 위로 밀어올림

---

## 4. BOARD & PIECE SPECIFICATIONS

**보드 크기**: 10 columns × 20 rows

**테트로미노 (7종)**:
| 이름 | 도형 | 색상 |
|------|------|------|
| I | ████ | Cyan (#00FFFF) |
| O | ██ / ██ | Yellow (#FFFF00) |
| T | █ / ██ / █ | Magenta (#FF00FF) |
| S | ██ / ██ | Green (#00FF00) |
| Z | ██ / ██ | Red (#FF0000) |
| J | █ / █ / ██ | Blue (#0000FF) |
| L | █ / █ / ██ | Orange (#FF8000) |

**랜덤 블록 생성**: 7-bag randomizer (7개 블록을 섞어서 순차 Fallon, 반복)

---

## 5. NETWORK ARCHITECTURE

### Server (Node.js + Socket.IO)
```
Event Flow:
1. client → server: 'join' → 방 참가 또는 생성
2. server → client: 'matched' → 게임 시작 알림
3. client → server: 'move' → 조작 이벤트
4. server → client: 'attack' → 상대방에게 공격
5. client → server: 'gameover' → 패배 신고
6. server → all clients: 'game_end' → 최종 결과
```

### Room System
- 2명씩 방 매칭
- 방 코드 기반 접속 (재연결 지원)
- 한 명이 나가면 자동 패배 처리

---

## 6. AUDIO DESIGN

**SFX 목록**:
- 블록 Fallon: thud sound
- 라인 삭제: sweep + clear
- 공격 수신: warning + impact
- 게임오버: game over melody
- Tetris (4줄 삭제): special fanfare

**BGM**: 없음 (게임 집중을 위한 조용한 배경)

---

## 7. UI/HUD DESIGN

### 메인 화면
- 방 코드 입력/생성
- 대기실 (상대방 대기 표시)
- 시작 버튼

### 인게임 화면
- 내 보드 (가운데)
- 상대방 보드 (오른쪽, 축소판)
- 상대 보드 하단 라인 수신 시 경고 애니메이션
- 라인 삭제 시 이펙트
- 게임오버 오버레이

### 색상 팔레트
- 배경: #0a0a1a (짙은 네이비)
- 보드 배경: #1a1a2e
- 그리드 선: #2a2a4e
- 텍스트: #ffffff, #00ffff

---

## 8. TECHNICAL STACK

- **Frontend**: React + Vite + TypeScript
- **Backend**: Node.js + Express + Socket.IO
- **Styling**: CSS Modules (inline for simplicity)
- **게임 로직**: 순수 TypeScript (React 없이 클라이언트 게임 로직 분리)

---

## 9. FILE STRUCTURE

```
src/
├── server/
│   ├── index.ts           # 서버 진입점
│   ├── room.ts            # 방 관리 로직
│   └── types.ts           # 서버 타입 정의
├── client/
│   ├── main.tsx           # React 엔트리
│   ├── App.tsx            # 메인 앱 (로비/게임)
│   ├── components/
│   │   ├── Lobby.tsx      # 방 입장/생성 UI
│   │   ├── Game.tsx       # 게임 보드
│   │   ├── Board.tsx      # 테트리스 보드
│   │   ├── Tetromino.tsx  # 블록 렌더링
│   │   └── OpponentBoard.tsx  # 상대방 보드
│   ├── game/
│   │   ├── TetrisGame.ts  # 게임 로직 클래스
│   │   ├── types.ts       # 게임 타입
│   │   └── constants.ts   # 블록 정의, 크기 등
│   └── socket/
│       └── client.ts      # Socket.IO 클라이언트
server/index.ts
```