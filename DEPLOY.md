# 🚀 Battle Tetris 배포 가이드

## 방법 1: Render.com (추천 - 무료 tier 사용 가능)

### 1단계: GitHub에 코드 푸시
```bash
git init
git add .
git commit -m "Battle Tetris game"
git branch -M main
git remote add origin https://github.com/jays-visionAI/battle-tetris.git
git push -u origin main
```

### 2단계: Render에서 배포
1. [Render](https://render.com) 가입
2. "New" → "Web Service" 클릭
3. GitHub 저장소 연결
4. 설정:
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Plan**: Free

### 3단계: 환경변수 설정
Render Dashboard에서:
- `PORT`: 3001

---

## 방법 2: Railway.app

### 1단계: Railway CLI 설치
```bash
npm install -g @railway/cli
railway login
```

### 2단계: 배포
```bash
cd your-project
railway init
railway up
```

Railway가 자동으로 감지:
- Build: `npm install && npm run build`
- Start: `npm start`

---

## 방법 3: Vercel + Socket.IO 서버 분리 (고급)

### 문제점
Vercel Serverless Functions는 WebSocket을 지원하지 않음.
Socket.IO 서버를 별도로 배포해야 함.

### 해결책: 분리 배포
1. **서버**: Railway, Render, 또는 Node.js 호스팅 가능服务商
2. **클라이언트**: Vercel

### 환경변수 설정
클라이언트에서:
```typescript
const socket = io('https://your-server.railway.app');
```

---

## 방법 4: pm2로 자체 VPS 배포

### 서버 설정
```bash
# SSH 접속 후
ssh user@your-server

# Node.js 설치
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 프로젝트 복사
git clone https://github.com/jays-visionAI/battle-tetris.git
cd battle-tetris
npm install

# 빌드
npm run build

# pm2로 실행
npm install -g pm2
pm2 start server/index.js --name battle-tetris
pm2 save

# 시스템 부팅 시 자동 시작
pm2 startup
```

### Nginx 리버스 프록시 설정
```nginx
# /etc/nginx/sites-available/battle-tetris
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/battle-tetris /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# SSL 적용
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

---

## 빠른 시작 체크리스트

- [ ] GitHub에 코드 푸시
- [ ] Render 또는 Railway 계정 생성
- [ ] 프로젝트 연결 및 배포
- [ ] 포트 3001번 열기
- [ ] https://your-app.onrender.com으로 접속 확인

---

## 로컬에서 프로덕션 모드 테스트

```bash
# 빌드
npm run build

# 서버 시작
PORT=3001 npm start

# 브라우저에서 확인
http://localhost:3001
```

---

## 문제 해결

### "Cannot connect to server"
- 서버가 실행 중인지 확인: `pm2 logs`
- 포트 번호 확인: `PORT` 환경변수와 일치하는지

### "Socket.io connection failed"
- CORS 설정 확인 (server/index.ts)
- WebSocket 프록시 설정 확인

### "Build failed"
- TypeScript 에러 확인: `npx tsc --noEmit`
- 의존성 설치: `npm install`