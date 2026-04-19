# 🚀 GitHub & Render 배포 가이드

## 1단계: GitHub에서 새 저장소 생성

1. [github.com](https://github.com) 접속 → 로그인
2. 우측 상단 **"+"** 버튼 → **"New repository"** 클릭
3. 설정:
   - **Repository name:** `battle-tetris`
   - **Description:** 실시간 2인용 테트리스 게임
   - **Public** 선택 (무료 tier)
   - ✅ **"Add a README file"** 체크

4. **"Create repository"** 클릭

---

## 2단계: 로컬 Git 설정 및 푸시

생성된 저장소 페이지에서 다음 명령어를 복사하세요:

```bash
# 원격지 URL을 방금 생성한 저장소로 변경
git remote set-url origin https://github.com/YOUR_USERNAME/battle-tetris.git

# 푸시
git push -u origin main
```

**`YOUR_USERNAME`을 실제 GitHub 사용자명으로 교체하세요!**

---

## 3단계: Render.com에서 배포

### Render 가입 (이미 않았다면)
1. [render.com](https://render.com) 접속
2. **"Sign Up"** → GitHub 계정으로 가입

### Web Service 생성
1. **"Dashboard"** → **"New +"** → **"Web Service"**
2. **"Configure account"**에서 GitHub 저장소 연결
3. `battle-tetris` 저장소 선택
4. 설정 입력:
   - **Name:** `battle-tetris`
   - **Region:** Singapore (동아시아)
   - **Branch:** `main`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
5. **Plan:** Free 선택
6. **"Create Web Service"** 클릭

---

## 4단계: 배포 완료 확인

- 약 2-3분 후 배포 완료
- **"Logs"** 탭에서 빌드 과정 확인 가능
- 완료되면 URL 제공 (예: `https://battle-tetris.onrender.com`)

---

## 친구와 함께 플레이하기 🔥

1. 자신에게 할당된 URL을 친구에게 공유
2. 친구도 같은 URL 접속
3. 2명이 접속하면 자동으로 게임 시작!

---

## ⚠️ 문제 해결

### "Repository not found" 에러
- GitHub 저장소 URL이 정확한지 확인
- 저장소가 Public인지 확인 (Private은 Render 접근 불가)

### Build 실패
- Build Command가 정확한지 확인
- 로그에서 에러 메시지 확인

### 포트 에러
- Render 환경변수에 `PORT=3001` 추가
- 또는 Render Dashboard에서 직접 설정