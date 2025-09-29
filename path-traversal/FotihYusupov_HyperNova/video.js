const fs = require("fs");

const video = (req, res) => {
  try {
    const range = req.headers.range;
    const videoPath = `videos/${req.params.video}`;
    const videoSize = fs.statSync(videoPath).size;
    const CHUNK_SIZE = 10 ** 6;
    let start = 0;
    let end = videoSize - 1;
    if (range) {
      start = Number(range.replace(/\D/g, ""));
      end = Math.min(start + CHUNK_SIZE, videoSize - 1);
    }
    const contentLength = end - start + 1;
    const headers = {
      "Content-Range": `bytes ${start}-${end}/${videoSize}`,
      "Accept-Ranges": "bytes",
      "Content-Length": contentLength,
      "Content-Type": "video/mp4",
    };
    res.writeHead(range ? 206 : 200, headers);
    const videoStream = fs.createReadStream(videoPath, { start, end });
    videoStream.pipe(res);
  } catch (err) {
    return res.json("error");
  }
};

module.exports = video;