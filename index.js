import express from "express";
import formidable from "formidable";
import fs from "fs";
import path from "path";
import cors from "cors";
import { nanoid } from "nanoid";

const app = express();
app.use(cors());
app.use(express.json());

const uploadDir = "./uploads";
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

// In-memory DB (use Redis later if needed)
const files = new Map();

/* ---------------- UPLOAD ---------------- */
app.post("/upload", (req, res) => {
  const form = formidable({
    uploadDir,
    keepExtensions: true,
    maxFileSize: 1 * 1024 * 1024 * 1024 // 5GB
  });

  form.parse(req, (err, fields, filesData) => {
    if (err) return res.status(500).json({ error: err.message });

    const file = filesData.file[0];
    const code = nanoid(6).toUpperCase();
    const expireAt = Date.now() + 2 * 60 * 1000;

    files.set(code, {
      path: file.filepath,
      name: file.originalFilename,
      size: file.size,
      expireAt,
      downloads: 0,
      logs: []
    });

    res.json({ code, expireAt });
  });
});

/* ---------------- DOWNLOAD ---------------- */
app.get("/download/:code", (req, res) => {
  const entry = files.get(req.params.code);
  if (!entry) return res.status(404).json({ error: "Invalid code" });

  if (Date.now() > entry.expireAt) {
    cleanup(req.params.code);
    return res.status(410).json({ error: "Expired" });
  }

  entry.downloads++;
  entry.logs.push({
    ip: req.headers["x-forwarded-for"] || req.socket.remoteAddress,
    ua: req.headers["user-agent"],
    time: new Date().toISOString()
  });

  res.setHeader("Content-Disposition", `attachment; filename="${entry.name}"`);
  fs.createReadStream(entry.path).pipe(res);
});

/* ---------------- STATS ---------------- */
app.get("/stats/:code", (req, res) => {
  const entry = files.get(req.params.code);
  if (!entry) return res.status(404).json({ error: "Invalid" });

  res.json({
    downloads: entry.downloads,
    size: entry.size,
    expiresIn: entry.expireAt - Date.now(),
    logs: entry.logs
  });
});

/* ---------------- MANUAL EXPIRE ---------------- */
app.post("/expire/:code", (req, res) => {
  cleanup(req.params.code);
  res.json({ ok: true });
});

/* ---------------- CLEANUP ---------------- */
function cleanup(code) {
  const entry = files.get(code);
  if (!entry) return;
  fs.unlink(entry.path, () => {});
  files.delete(code);
}

/* ---------------- AUTO CLEANER ---------------- */
setInterval(() => {
  for (const [code, entry] of files) {
    if (Date.now() > entry.expireAt) cleanup(code);
  }
}, 30000);

app.listen(3000, () => {
  console.log("Running on http://localhost:3000");
});
