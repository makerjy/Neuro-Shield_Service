FROM node:20-alpine

WORKDIR /app

# citizen_sms_service 의존성 설치
COPY citizen_sms_service/package.json citizen_sms_service/package-lock.json* ./
RUN npm install --omit=dev 2>/dev/null || npm install

# 서버 소스 복사
COPY citizen_sms_service/server ./server

EXPOSE 4120

CMD ["node", "./server/index.js"]
