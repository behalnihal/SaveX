# SaveX

A minimal, black video and audio downloader built with Next.js, Express, yt-dlp, and FFmpeg.

Supports public links from **YouTube (including Shorts), Instagram (including Reels), X/Twitter, TikTok, Vimeo, and Reddit**.

- **Video:** MP4 or WebM, best available or a resolution cap from 360p to 4K.
- **Audio only:** MP3 or M4A, best available or a target bitrate of 128, 192, or 320 kbps.
- Correct file extensions and filenames after conversion, inline errors, and cancellation.
- One media item per request. For multi-video posts, saves the first item. Live streams are excluded.

Quality choices are ceilings, not promises: downloads use available source quality without upscaling. Increasing an audio bitrate cannot improve the original recording. Some sites require login, cookies, or bot verification even for public posts; SaveX currently handles public links that yt-dlp can access without authentication.

## Run locally

Requires **Node.js 22 or later**, a current **yt-dlp**, **FFmpeg**, and **FFprobe** on PATH. Current YouTube extraction also uses a JavaScript runtime; SaveX enables Node for yt-dlp. Install the official yt-dlp executable (which bundles its JavaScript support), or install the Python package with its default dependencies:

```sh
python3 -m pip install --upgrade 'yt-dlp[default]'
# macOS, if FFmpeg is not installed:
brew install ffmpeg
```

Start the API in one terminal:

```sh
cd server
cp .env.example .env
npm ci
npm run dev
```

Start the frontend in a second terminal:

```sh
cd client
cp .env.example .env.local
npm ci
npm run dev
```

Open [localhost:3000](http://localhost:3000). The API defaults to port 8000. For a deployed frontend, set `NEXT_PUBLIC_API_URL` to the API's HTTPS origin at build time. Set `CLIENT_ORIGIN` on the server to the frontend origin, or a comma-separated list of origins. `YT_DLP_PATH` optionally selects a custom executable.

## Download API

The original `GET /download?url=...` endpoint remains compatible and defaults to MP4 at the best available quality.

```sh
curl --get http://localhost:8000/download \
  --data-urlencode 'url=https://www.youtube.com/watch?v=VIDEO_ID' \
  --data-urlencode 'format=mp4' \
  --data-urlencode 'quality=1080' \
  --output video.mp4
```

| Parameter | Values | Default |
| --- | --- | --- |
| `url` | Public HTTP(S) media link from a supported site | Required |
| `format` | `mp4`, `webm`, `mp3`, `m4a` | `mp4` |
| Video `quality` | `best`, `2160`, `1440`, `1080`, `720`, `480`, `360` | `best` |
| Audio `quality` | `best`, `320`, `192`, `128` | `best` |

Successful responses are file attachments with the final filename in `Content-Disposition`. Failures return JSON `{ "error": "..." }` and a suitable HTTP status. The server allows three concurrent downloads, aborts work when the client disconnects, times out downloads after ten minutes, and cleans up temporary files on completion or failure. yt-dlp skips files larger than 500 MB when their size is known; this flag does not enforce a hard limit on streams of unknown size. Put deployment-specific traffic and resource limits at your reverse proxy.

## Verify

```sh
cd server
npm test
```

```sh
cd client
npm run lint
npm run typecheck
npm run build
```

API tests cover platform validation, argument injection, quality selection, all output formats, streamed filenames, cleanup, resource limits, and errors without requiring third-party network access.

## Docker API

```sh
cd server
docker build -t savex-api .
docker run --rm -p 8000:8000 -e CLIENT_ORIGIN=http://localhost:3000 savex-api
```

The image includes Node, Python, FFmpeg, and the official yt-dlp executable. Rebuild it regularly to pick up extractor fixes.

