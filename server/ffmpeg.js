const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");

const convertedDir = path.join(__dirname, "converted");
fs.mkdirSync(convertedDir, { recursive: true });

function convertToWav(inputPath, recordingId) {
  const outputPath = path.join(convertedDir, `${recordingId}.wav`);

  if (fs.existsSync(outputPath)) {
    return Promise.resolve({ filePath: outputPath, mimeType: "audio/wav" });
  }

  return new Promise((resolve) => {
    const ffmpeg = spawn("ffmpeg", [
      "-y",
      "-i",
      inputPath,
      "-ac",
      "1",
      "-ar",
      "16000",
      outputPath,
    ]);

    ffmpeg.on("error", () => {
      resolve(null);
    });

    ffmpeg.on("close", (code) => {
      if (code === 0 && fs.existsSync(outputPath)) {
        resolve({ filePath: outputPath, mimeType: "audio/wav" });
      } else {
        resolve(null);
      }
    });
  });
}

module.exports = { convertToWav };
