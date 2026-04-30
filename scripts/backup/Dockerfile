FROM node:20-alpine
RUN apk add --no-cache postgresql-client tzdata
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY . .
ENV TZ=Asia/Ho_Chi_Minh
CMD ["node", "backup.js"]
