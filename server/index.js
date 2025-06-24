import express from "express";
import "dotenv/config";
import { exec } from "child_process";
import { unlinkSync } from "fs";
import cors from "cors";

const app = express();
app.use(cors());
const port = process.env.PORT;

const downloadHandler = (req, res) => {
  const tweetUrl = req.query.url;
  if (!tweetUrl) return res.status(400).send("URL required");

  const filename = `video_${Date.now()}.mp4`;
  const command = `yt-dlp -f "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]" -o "${filename}" "${tweetUrl}"`;
  exec(command, (error) => {
    if (error) return res.status(500).send("Download Failed");
    res.download(filename, () => {
      unlinkSync(filename);
    });
  });
};

app.get("/", (req, res) => {
  res.send("Welcome to X video downloader");
});
app.get("/download", downloadHandler);

app.listen(port, () => {
  console.log(`server is running on port ${port}`);
});
