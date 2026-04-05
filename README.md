# 매매일지

개인 매매 기록 및 AI 분석 앱

## 배포 방법

### 1. GitHub에 올리기
```bash
git init
git add .
git commit -m "first commit"
git remote add origin https://github.com/your-username/trading-journal.git
git push -u origin main
```

### 2. Upstash Redis 설정
1. https://upstash.com 에서 무료 계정 생성
2. Redis 데이터베이스 생성
3. REST URL과 REST Token 복사

### 3. Vercel 배포
1. https://vercel.com 에서 GitHub 연동
2. 이 저장소 import
3. 환경변수 추가:
   - `UPSTASH_REDIS_REST_URL` = Upstash Redis REST URL
   - `UPSTASH_REDIS_REST_TOKEN` = Upstash Redis REST Token
4. Deploy!

### 4. 아이폰 홈 화면에 추가
Safari에서 배포된 URL 접속 → 공유 버튼 → 홈 화면에 추가
→ 앱 아이콘으로 사용 가능!

## 환경변수
`.env.local.example` 파일을 `.env.local`로 복사하고 값을 입력하세요.
