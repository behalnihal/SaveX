FROM node:18-alpine

RUN apk add --no-cache ffmpeg curl python3 \
    && curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp

WORKDIR /app

COPY . .
RUN npm install --omit=dev --no-audit --prefer-offline

EXPOSE 8000
CMD ["npm", "run", "start"]