FROM node:22-alpine

RUN apk add --no-cache ffmpeg curl python3 \
    && curl -fL https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev --no-audit
COPY . .

ENV PORT=8000
EXPOSE 8000
CMD ["npm", "run", "start"]
