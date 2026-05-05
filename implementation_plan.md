# Battle Tetris - Implementation Plan

## Summary
배틀 테트리스 게임의 멀티플레이어 실시간 공유, 사운드 시스템, 방 입장/시작 플로우를 개선합니다.

## Scope

### In Scope
1. **실시간 게임플레이 100% 공유**
   - 상대방의 currentPiece를 실시간으로 보드에 렌더링 (고스트 블록 효과)
   - `gameplay_action`에 currentPiece, nextPiece 포함 전송
   - 상대방 보드에서도 현재 조각이 움직이는 것처럼 보이도록 개선

2. **BGM 및 효과음 시스템**
   - 테트리스 스타일 BGM (MP3 파일 로드 및 루프)
   - 공격 발동 시 효과음 (라인 수에 따른 피치 변화)
   - 공격 수신 시 효과음 (강한 임팩트)
   - 사용자 첫 상호작용 후 BGM 시작 (브라우저 정책 준수)

3. **방 생성/입장 플로우 개선**
   - 방 생성자: 입장 후 "대기중..." 표시
   - 2번째 플레이어 입장 시: "플레이어 OOO이 입장했습니다." 메시지 표시
   - 게임 시작 권한: **두 번째로 입장한 플레이어**에게만 "Start" 버튼 활성화
   - Start 버튼 클릭 시: 서버에 `request_start` → 3-2-1-Play 카운트다운 → 게임 시작
   - 카운트다운 동안 양쪽 화면에 오버레이 표시

4. **게임 종료 / Replay / 뒤로가기**
   - 게임 종료 시 승자명 표시 ("플레이어 OOO 승리!")
   - Replay 버튼 (재경기)
   - 한 사람이 Replay 누륾 → "플레이어 OOO의 Replay 동의를 기다립니다..."
   - 상대방도 누륾 → 3-2-1-Play 카운트다운 후 재시작
   - 뒤로가기 버튼 클릭 시 로비(초기 랜딩)로 이동

### Out of Scope
- 새로운 테트리스 조작/규칙 추가
- 랭킹/전적 시스템
- 3인 이상 멀티플레이

### Deferred
- 설정 패널의 서버 URL 저장/적용 실시간 반영

## Planned Changes

| # | File | Change |
|---|------|--------|
| 1 | `server/index.ts` | `request_start` 이벤트 핸들러 추가, 카운트다운 브로드캐스트, `player_joined` 메시지 개선, `gameStarted` 플래그 개선 |
| 2 | `src/client/components/Lobby.tsx` | 두 번째 플레이어 전용 Start 버튼, 입장 메시지 표시, 카운트다운 상태 처리, "대기중..." UI 개선 |
| 3 | `src/client/components/Game.tsx` | 상대방 currentPiece 실시간 렌더링, BGM 개선, 게임 종료 승자 표시, Replay 동의 플로우, 뒤로가기, 카운트다운 오버레이 |
| 4 | `src/client/components/Board.tsx` | `opponentCurrentPiece` prop 추가하여 상대방 현재 조각도 렌더링 |
| 5 | `src/client/game/TetrisGame.ts` | `reset()` 호출 시 상태 완전 초기화 보장 |

## Technical Approach

### 실시간 게임플레이 공유
- `gameplay_action` 이벤트에 `currentPiece`를 포함하여 전송
- `Board` 컴포넌트에 `opponentCurrentPiece` prop 추가
- 상대방 보드에서도 currentPiece를 병합하여 렌더링 (고스트 블록 색상은 반투명하게)

### BGM/효과음
- Web Audio API Oscillator 기반 루프 BGM (A minor 펜타토닉 스케일)
- `AudioContext` 싱글턴 관리로 리소스 누수 방지
- 효과음 볼륨 일관성 확보 (0.1 ~ 0.3)

### 방 시작 플로우
```
[방 생성자] join → "대기중..."
                    ↓
[2번째 플레이어] join → "플레이어 OOO 입장" 표시
                    ↓
            [2번째 플레이어] Start 버튼 활성화
                    ↓
            Start 클릭 → 서버 request_start → 카운트다운(3,2,1) emit
                    ↓
            양쪽 화면 카운트다운 오버레이 → game_start emit
```

### Replay 플로우
```
게임 종료 → 승자 표시 + Replay/뒤로가기 버튼
  ↓
플레이어A Replay 클릭 → "플레이어B의 동의 대기중..." 표시
  ↓
플레이어B Replay 클릭 → 서버 rematch_accept → 카운트다운 → 게임 리셋
```

## Risk Assessment
| Risk | Mitigation |
|------|------------|
| Web Audio API 브라우저 정책 | 사용자 첫 상호작용(키/클릭) 후 BGM 시작 |
| Socket.IO 이벤트 순서 꼬임 | `request_start` → 서버 검증(2명 있는지) → countdown → start 순서 보장 |
| currentPiece 전송량 과다 | 이벤트 기반 전송(조작 시에만)으로 최적화 유지 |
