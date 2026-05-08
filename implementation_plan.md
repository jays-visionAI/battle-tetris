# Battle Tetris - Implementation Plan

## Summary
배틀 테트리스 게임에 로그인/전적관리/리더보드 기능 추가 및 모바일 스크롤 방지 완전 적용

## Scope

### In Scope
1. **모바일 스크롤 완전 방지**
   - 게임 화면에서 위아래 스크롤이 절대 발생하지 않도록 수정
   - `overflow: hidden` + `position: fixed` + `touch-action: none` 조합으로 완전 차단
   - 불필요한 요소(조작법, 공격 시스템 설명 등) 모바일에서 숨김
   - 모바일에서 화면 안에 모든 요소가 보이도록 레이아웃 최적화

2. **로그인 기능**
   - 닉네임 기반 간편 로그인 (localStorage에 저장)
   - 로그인 시 기존 전적 불러오기
   - 닉네임 변경 가능 (전적은 유지)

3. **전적 관리**
   - 유저별 전적: 총 게임 수, 승, 패, 승률
   - localStorage 기반 저장 (서버 없이 클라이언트에서 관리)
   - 게임 종료 시 자동 전적 업데이트
   - 로비에서 내 전적 확인 가능

4. **리더보드 (랭킹)**
   - 리더보드 페이지 추가
   - 승률 기준 랭킹 (동률 시 승수 → 총 게임 수 순)
   - 상위 10명 표시
   - 로비에서 리더보드 페이지로 이동 가능

### Out of Scope
- 서버 DB 연동 (추후 작업)
- 회원가입/비밀번호 (간편 닉네임 로그인)
- 실시간 리더보드 (로컬 기반)

## Planned Changes

| # | File | Change |
|---|------|--------|
| 1 | `src/client/index.css` | 모바일 스크롤 완전 방지 CSS 추가 |
| 2 | `src/client/components/Game.tsx` | 모바일 불필요 요소 숨김, 스크롤 방지 강화 |
| 3 | `src/client/App.tsx` | 로그인 상태 관리, 전적/리더보드 페이지 라우팅 |
| 4 | `src/client/components/Lobby.tsx` | 로그인 UI, 전적 표시, 리더보드 버튼 |
| 5 | `src/client/components/Leaderboard.tsx` | **신규** - 리더보드 페이지 |
| 6 | `src/client/utils/StatsManager.ts` | **신규** - 전적 관리 유틸 (localStorage) |

## Technical Approach

### 모바일 스크롤 방지
- `body.game-active`에 `overflow: hidden !important; position: fixed; width: 100%; height: 100%;` 적용
- 게임 컨테이너에 `touch-action: none; overscroll-behavior: none;` 추가
- iOS Safari 대응: `-webkit-overflow-scrolling: auto;`
- 모바일에서 불필요한 사이드 패널(공격 시스템 설명), 조작법 바 숨김

### 로그인
- 닉네임 입력 → localStorage에 `battle-tetris-user` 키로 저장
- 로그인 상태: `{ nickname, loggedIn: true }`
- App.tsx에서 로그인 상태 관리, Lobby에 prop으로 전달

### 전적 관리 (StatsManager)
- localStorage 키: `battle-tetris-stats`
- 데이터 구조: `{ [nickname]: { wins, losses, totalGames } }`
- 게임 종료 시 `recordGame(winner, loser)` 호출
- 승률 = wins / totalGames * 100

### 리더보드
- 모든 유저의 전적을 승률 기준으로 정렬
- Leaderboard 컴포넌트에서 상위 10명 표시
- 랭킹 테이블: 순위, 닉네임, 승, 패, 승률, 총 게임 수

## Risk Assessment
- **낮음**: localStorage 기반이라 데이터 유실 가능성 있음 (브라우저 데이터 삭제 시)
- **낮음**: 동일 닉네임 사용 시 전적 공유됨 (서버 DB 없음)
- **낮음**: 모바일 스크롤 방지가 iOS Safari에서 완벽하지 않을 수 있음
