import express from "express";
import cors from "cors";
import { formidable } from "formidable";
import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";
import os from "os";

const app = express();
app.use(cors());
app.use(express.json());

const uploads = new Map();
const UPLOAD_DIR = "./files";
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Auto cleanup every 10 sec
setInterval(() => {
  const now = Date.now();
  for (const [code, data] of uploads) {
    if (now > data.expires) {
      try { fs.unlinkSync(data.filePath); } catch {}
      uploads.delete(code);
    }
  }
}, 10000);

// Upload
app.post("/upload", (req, res) => {
  const form = formidable({
    uploadDir: UPLOAD_DIR,
    keepExtensions: true
  });

  form.parse(req, (err, fields, files) => {
    if (err) return res.status(500).json({ error: "Upload failed" });

    const file = files.file[0];
    const code = nanoid(8);

    uploads.set(code, {
      filePath: file.filepath,
      fileName: file.originalFilename,
      expires: Date.now() + 2 * 60 * 1000,
      downloads: 0,
      uploaderIP: req.ip,
      receivers: []
    });

    res.json({ code });
  });
});

// Receive
app.post("/receive", (req, res) => {
  const { code } = req.body;
  const data = uploads.get(code);

  if (!data) return res.status(404).json({ error: "Invalid or expired" });
  if (Date.now() > data.expires) return res.status(404).json({ error: "Expired" });

  const ua = req.headers["user-agent"] || "Unknown";
  data.downloads++;
  data.receivers.push({
    ip: req.ip,
    ua,
    time: new Date().toISOString()
  });

  res.download(data.filePath, data.fileName);
});

// Stats
app.post("/stats", (req, res) => {
  const { code } = req.body;
  const data = uploads.get(code);
  if (!data) return res.status(404).json({ error: "Not found" });
  res.json(data);
});

// Manual expire
app.post("/expire", (req, res) => {
  const { code } = req.body;
  const data = uploads.get(code);
  if (!data) return res.status(404).json({ error: "Not found" });
  try { fs.unlinkSync(data.filePath); } catch {}
  uploads.delete(code);
  res.json({ success: true });
});

app.listen(3000, () => {
  console.log("Backend running on http://localhost:3000");
});
