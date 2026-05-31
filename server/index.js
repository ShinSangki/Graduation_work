require("dotenv").config();

const cors = require("cors");
const express = require("express");
const fs = require("node:fs");
const multer = require("multer");
const path = require("node:path");
const { convertToWav } = require("./ffmpeg");
const { generateEpisodeFromText, generateMemoir, transcribeAudio } = require("./gemini");

const app = express();
const port = Number(process.env.PORT || 3001);
const uploadDir = path.join(__dirname, "uploads");

fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || ".webm";
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
});

app.use(cors({ origin: true }));
app.use(express.json({ limit: "2mb" }));

function removeFile(filePath) {
  if (!filePath) return;
  try {
    fs.unlinkSync(filePath);
  } catch (error) {
    if (error.code !== "ENOENT") console.error(error);
  }
}

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/generate", upload.single("audio"), async (req, res) => {
  let converted;

  try {
    if (!req.file) {
      return res.status(400).json({ error: "audio file is required." });
    }

    const time = req.body.time || "알 수 없는 시기";
    const place = req.body.place || "알 수 없는 장소";
    converted = await convertToWav(req.file.path, `temp-${Date.now()}`);
    const source = converted || {
      filePath: req.file.path,
      mimeType: req.file.mimetype || "audio/webm",
    };
    const rawText = await transcribeAudio(source.filePath, source.mimeType);
    const memoir = await generateMemoir(rawText, time, place);

    res.status(200).json({ ...memoir, sttRawText: rawText });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || "AI generation failed." });
  } finally {
    removeFile(converted?.filePath);
    removeFile(req.file?.path);
  }
});

app.post("/api/generate-from-text", async (req, res) => {
  try {
    const sttRawText = String(req.body.sttRawText || "").trim();
    if (!sttRawText) {
      return res.status(400).json({ success: false, error: "sttRawText가 누락되었습니다." });
    }
    if (sttRawText.length < 200) {
      return res.status(400).json({ success: false, error: "sttRawText는 최소 200자 이상이어야 합니다." });
    }

    const geminiResult = await generateEpisodeFromText(sttRawText);
    const sttLength = sttRawText.length;
    const summaryLength = geminiResult.episode.content.length;
    const compressionRate = Math.round(((sttLength - summaryLength) / sttLength) * 100);
    const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, "");
    const episodeId = `EP${timestamp}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    res.status(200).json({
      success: true,
      episode: {
        episode_id: episodeId,
        title: geminiResult.episode.title,
        content: geminiResult.episode.content,
        tags: geminiResult.tags,
      },
      metadata: {
        stt_length: sttLength,
        summary_length: summaryLength,
        compression_rate: compressionRate,
        target_max_length: geminiResult.targetMaxLength,
        compression_target_met: summaryLength <= geminiResult.targetMaxLength,
        llm_model: geminiResult.model,
        api_call_count: geminiResult.apiCallCount,
        usage: geminiResult.usageMetadata,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: "자서전 생성 도중 서버 내부 에러가 발생했습니다." });
  }
});

app.listen(port, "0.0.0.0", () => {
  console.log(`AI proxy listening on http://0.0.0.0:${port}`);
});
