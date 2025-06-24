FROM node:18-slim

RUN apt-get update && \
    apt-get install -y \
    ffmpeg \
    curl \
    python3 \
    && curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp \
    && apt-get remove -y curl \
    && apt-get autoremove -y \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./

RUN npm install --production --omit=dev --no-audit --prefer-offline

COPY . .

RUN useradd -m appuser && chown -R appuser:appuser /app
USER appuser

CMD ["node", "index.js"]