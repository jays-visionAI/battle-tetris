# Battle Tetris - Implementation Plan

## Summary
배틀 테트리스 게임의 P키 일시정지 동작 확인 및 모바일 반응형 레이아웃 적용

## Scope

### In Scope
1. **P키 일시정지 동작 확인**
   - P키 누르면 본인만 정지 (공격 불가) - 이미 구현됨
   - 상대방의 공격은 계속 받음 - 이미 구현됨 (`addAttackLines`에 paused 체크 없음)

2. **모바일 반응형 레이아웃**
   - PC(>768px): 기존 가로형 레이아웃 유지
   - 모바일(≤768px): 세로형 레이아웃으로 변경
     - 상단: 점수/레벨 정보 (가로 배치)
     - 중앙: 내 보드 (scale 0.75)
     - 사이드 패널: 다음 블록 + 공격 정보 (가로 배치)
     - 하단: 상대방 보드 (scale 0.55, 미니맵 스타일)
     - 조작법: 하단에 간략히 표시

### Out of Scope
- 터치 컨트롤 (추후 작업)
- 모바일 전용 UI 컴포넌트 추가

## Planned Changes

| # | File | Change |
|---|------|--------|
| 1 | `src/client/components/Game.tsx` | CSS 미디어 쿼리 추가, JSX 요소에 클래스명 부여 |
| 2 | `src/client/index.css` | 모바일 글로벌 스타일 추가 |

## Technical Approach

### P키 일시정지 (이미 구현 완료)
- `TetrisGame.addAttackLines()`에 paused 체크 없음 → paused 상태에서도 공격 받음
- `TetrisGame.update()`에서 paused 체크 → 자동 낙하만 멈춤
- `moveLeft/Right/Down/Rotate/HardDrop`에서 paused 체크 → 조작 불가
- Game.tsx의 `attacked` 이벤트 핸들러는 paused와 무관하게 항상 처리

### 모바일 레이아웃
- CSS `@media (max-width: 768px)` 사용
- Flexbox 방향을 row → column으로 변경
- Board 컴포넌트의 `scale` prop 활용 (내 보드 0.75, 상대방 0.55)
- `isMobile` 상태로 JSX에서도 조건부 렌더링 지원
