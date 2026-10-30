# SaveX

A minimal, black video and audio downloader built with Next.js, Express, yt-dlp, and FFmpeg.

Supports public links from **YouTube (including Shorts), Instagram (including Reels), X/Twitter, TikTok, Vimeo, and Reddit**.

- **Video:** MP4 or WebM, best available or a resolution cap from 360p to 4K.
- **Audio only:** MP3 or M4A, best available or a target bitrate of 128, 192, or 320 kbps.
- **Trim:** optional start and end times for video or audio clips. Accepts seconds, `MM:SS`, or `HH:MM:SS`, including up to three decimal places for seconds.
- Correct file extensions and filenames after conversion, inline errors, and cancellation.
- One media item per request. For multi-video posts, saves the first item. Live streams are excluded.

Quality choices are ceilings, not promises: downloads use available source quality without upscaling. Increasing an audio bitrate cannot improve the original recording. Some sites require login, cookies, or bot verification even for public posts. YouTube can optionally use a server-managed session; see troubleshooting below.

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
| `start` | Optional start time, e.g. `90`, `01:30`, or `00:01:30.500` | Beginning |
| `end` | Optional end time, later than `start` | End of media |

For a clip, add `--data-urlencode 'start=00:30' --data-urlencode 'end=01:00'` to the example above. Leave both blank or omit them for the full download. A start alone saves through the end; an end alone starts at the beginning. Trimming uses yt-dlp's `--download-sections` and FFmpeg. Video clips are re-encoded for cleaner cuts, so preparing a clip can take longer than a full download. An end beyond the source duration stops at the source's end.

Successful responses are file attachments with the final filename in `Content-Disposition`. Failures return JSON `{ "error": "...", "code": "...", "requestId": "..." }` and a suitable HTTP status. `X-Request-Id` matches the corresponding redacted container log. The server allows three concurrent downloads, aborts work when the client disconnects, times out downloads after ten minutes, and cleans up temporary files on completion or failure. yt-dlp skips files larger than 500 MB when their size is known; this flag does not enforce a hard limit on streams of unknown size. Put deployment-specific traffic and resource limits at your reverse proxy.

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

API tests cover platform validation, argument injection, quality and time range selection, all output formats, streamed filenames, cleanup, resource limits, and errors without requiring third-party network access.

## Docker API

```sh
cd server
docker build -t savex-api .
docker run --rm -p 8000:8000 -e CLIENT_ORIGIN=http://localhost:3000 savex-api
```

The image includes Node, Python, FFmpeg, CA certificates, and the official yt-dlp nightly executable with bundled EJS scripts. The nightly channel is [recommended by yt-dlp](https://github.com/yt-dlp/yt-dlp#update) for site compatibility. Set `--build-arg YT_DLP_CHANNEL=stable` to use stable, or `--build-arg YT_DLP_VERSION=RELEASE_TAG` to pin a release on the selected channel.

## YouTube troubleshooting

YouTube can challenge a server session even when the video plays publicly in a browser. A `YOUTUBE_BOT_CHECK` response identifies this; it does not mean the video itself is private. An `AUTH_REQUIRED` response identifies content that requires account access or age verification.

First rebuild and redeploy the **API container**, bypassing the cached yt-dlp download layer:

```sh
cd server
docker build --pull --no-cache -t savex-api .
```

Then diagnose the same URL **inside the running container** so the check uses its network and configuration:

```sh
docker exec YOUR_CONTAINER npm run diagnose:youtube -- 'https://www.youtube.com/watch?v=b52WH2gAim4'
```

This prints the yt-dlp/Node versions, whether cookies and a proxy are configured, format-extraction results, and redacted errors. It does not download the video or print cookie contents or proxy credentials. Locally, run the same `npm run diagnose:youtube -- 'URL'` command from `server/`.

### Container logs

SaveX writes structured JSON logs to stdout and stderr, so they appear in your host's container log viewer or with:

```sh
docker logs --follow YOUR_CONTAINER
```

At startup, look for `server_started` and `dependency_version` events for yt-dlp and FFmpeg. Each download emits `download_received`, `download_started`, `ytdlp_started`, live `ytdlp_stderr` messages, and either `download_prepared` / `download_completed`, `download_failed`, or `download_cancelled`. Every event carries a request ID; failures include the classification code and redacted upstream details. Cookie contents, signed URLs, and proxy credentials are omitted. No log files inside the image or special logging environment variables are needed.

### Optional session configuration

If YouTube still challenges the server, configure an authorized session using a Netscape-format cookies file, following [yt-dlp's YouTube cookie instructions](https://github.com/yt-dlp/yt-dlp/wiki/Extractors#exporting-youtube-cookies). Keep cookies outside the repository and mount them as a secret:

```sh
docker run --rm -p 8000:8000 \
  -e CLIENT_ORIGIN=https://YOUR_FRONTEND \
  -e YOUTUBE_COOKIES_FILE=/run/secrets/youtube-cookies.txt \
  --mount type=bind,source=/ABSOLUTE/PRIVATE/PATH/youtube-cookies.txt,target=/run/secrets/youtube-cookies.txt,readonly \
  savex-api
```

SaveX makes a private, writable copy for each YouTube download and deletes it with the other temporary files. The original secret stays unchanged. Cookies are never accepted from query parameters, sent to the frontend, or used for other platforms. Treat this file as an account credential and replace it when its session expires. yt-dlp warns that accounts used for downloading can be restricted; use a dedicated account with appropriate access if authentication is necessary.

`YOUTUBE_PROXY_URL` optionally selects an HTTP, HTTPS, or SOCKS5 proxy you control for YouTube extraction and downloading. Configure it through your deployment's secret environment settings. A proxy or cookie file is not guaranteed to resolve a challenged session. Do not disable TLS verification to address these errors.

| Error code | Server-side next step |
| --- | --- |
| `YOUTUBE_BOT_CHECK` | Check the session and server network using the diagnosis command; configure fresh cookies if required. |
| `YOUTUBE_SESSION_REJECTED` | Inspect the redacted upstream error. For PO token requirements, follow the official [PO Token Guide](https://github.com/yt-dlp/yt-dlp/wiki/PO-Token-Guide); SaveX does not bundle a token provider. |
| `YOUTUBE_RUNTIME_ERROR` | Rebuild with the current downloader and bundled EJS scripts; Node 22+ is required. |
| `YOUTUBE_CONFIG_ERROR` | Check the cookies secret mount, Netscape file format, and proxy URL. |
| `UPSTREAM_RATE_LIMIT` | Reduce request traffic and wait before retrying. |
| `UPSTREAM_TLS_ERROR` | Fix the container's CA trust or network configuration. |

An update fixes extractor compatibility issues; a genuine session or network challenge requires deployment configuration. The website cannot sign into a user's YouTube browser session.

