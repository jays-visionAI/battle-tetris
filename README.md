# 🎮 Battle Tetris - GitHub & Render 배포 가이드

## 🚀 한 줄 요약
GitHub에 코드 푸시 → Render.com에서 호스팅 → 친구와 함께 플레이!

---

## 1단계: GitHub에서 새 저장소 생성

1. **[github.com](https://github.com)** 접속 → 로그인
2. 우측 상단 **"+"** 버튼 → **"New repository"**
3. 설정:
   - **Repository name:** `battle-tetris`
   - **Description:** 실시간 2인용 테트리스 게임
   - **Public** 선택
   - ✅ **"Add a README file"** 체크
4. **"Create repository"** 클릭

---

## 2단계: 원격지 URL 변경 및 푸시

GitHub 저장소를 만든 후:

```bash
# 1단계: 원격지 URL 변경 (YOUR_USERNAME을 실제 GitHub 아이디로 교체)
git remote set-url origin https://github.com/YOUR_USERNAME/battle-tetris.git

# 2단계: 확인
git remote -v

# 3단계: 푸시
git push -u origin main
```

---

## 3단계: Render.com에서 배포

1. **[render.com](https://render.com)** 접속 → GitHub 계정으로 로그인
2. **Dashboard** → **"New +"** → **"Web Service"**
3. `battle-tetris` 저장소 선택
4. 설정:
   - **Name:** `battle-tetris`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Plan:** Free
5. **"Create Web Service"** 클릭 → 약 2-3분 대기

---

## 4단계: 완료! 🎉

배포 완료 시 URL이 표시됩니다 (예: `https://battle-tetris.onrender.com`)

이 URL을 친구에게 공유해서 함께 플레이하세요!

---

## ⚠️ 문제 해결

| 문제 | 해결책 |
|------|--------|
| "Repository not found" | GitHub 저장소가 Public인지 확인 |
| Build 실패 | 로그 확인, `PORT=3001` 환경변수 설정 |
| 소켓 연결 실패 | CORS 설정 확인 |