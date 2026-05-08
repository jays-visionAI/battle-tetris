#!/bin/bash
# Battle Tetris - GitHub 푸시 및 Render 배포 자동화 스크립트

echo "🎮 Battle Tetris 배포 설정"
echo "=========================="

# GitHub 사용자명 입력
read -p "GitHub 사용자명을 입력하세요: " GITHUB_USERNAME

if [ -z "$GITHUB_USERNAME" ]; then
    echo "❌ 사용자명이 필요합니다!"
    exit 1
fi

# 원격지 URL 설정
GIT_URL="https://github.com/$GITHUB_USERNAME/battle-tetris.git"
git remote set-url origin "$GIT_URL"

echo "✅ 원격지 URL 설정 완료: $GIT_URL"

# 푸시
echo ""
echo "📤 GitHub에 푸시 중..."
git push -u origin main

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ GitHub 푸시 완료!"
    echo ""
    echo "📝 다음 단계: Render.com에서 배포"
    echo "   1. https://render.com 접속 → GitHub 로그인"
    echo "   2. 'New' → 'Web Service' 클릭"
    echo "   3. 'battle-tetris' 저장소 선택"
    echo "   4. Build Command: npm install && npm run build"
    echo "   5. Start Command: npm start"
    echo "   6. 'Create Web Service' 클릭"
else
    echo ""
    echo "❌ 푸시 실패! GitHub 저장소를 먼저 생성해주세요."
    echo "   https://github.com/new 에서 'battle-tetris' 이름으로 새 저장소 생성"
fi