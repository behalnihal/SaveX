FROM node:22-alpine

# Nightly is yt-dlp's recommended channel for keeping up with site changes.
# Set YT_DLP_VERSION to a release tag for reproducible builds.
ARG YT_DLP_CHANNEL=nightly
ARG YT_DLP_VERSION=latest
RUN apk add --no-cache ca-certificates ffmpeg curl python3 \
    && case "$YT_DLP_CHANNEL" in \
        nightly) yt_dlp_repo=yt-dlp-nightly-builds ;; \
        stable) yt_dlp_repo=yt-dlp ;; \
        *) exit 1 ;; \
       esac \
    && if [ "$YT_DLP_VERSION" = latest ]; then \
         yt_dlp_release=latest/download; \
       else \
         yt_dlp_release=download/$YT_DLP_VERSION; \
       fi \
    && curl -fL --retry 3 "https://github.com/yt-dlp/$yt_dlp_repo/releases/$yt_dlp_release/yt-dlp" -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp \
    && yt-dlp --version

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev --no-audit
COPY . .

ENV PORT=8000
EXPOSE 8000
CMD ["npm", "run", "start"]
