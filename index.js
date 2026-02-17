import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { formidable } from "formidable";
import crypto from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

const filesDB = new Map(); 
// code => { filepath, filename, createdAt, expiresAt, downloads, logs }

function json(res, obj, status = 200) {
  res.writeHead(status, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
  res.end(JSON.stringify(obj));
}

const server = http.createServer(async (req, res) => {

  // CORS
  if (req.method === "OPTIONS") {
    res.writeHead(200, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,DELETE",
      "Access-Control-Allow-Headers": "Content-Type"
    });
    return res.end();
  }

  // UPLOAD
  if (req.url === "/upload" && req.method === "POST") {
    const form = formidable({
      uploadDir: uploadsDir,
      keepExtensions: true,
      maxFileSize: 1024 * 1024 * 1024 // 1GB
    });

    form.parse(req, (err, fields, files) => {
      if (err) return json(res, { error: err.message }, 500);

      const file = files.file?.[0];
      if (!file) return json(res, { error: "No file" }, 400);

      const code = crypto.randomBytes(5).toString("hex");
      const expiresAt = Date.now() + 2 * 60 * 1000; // 2 min

      filesDB.set(code, {
        filepath: file.filepath,
        filename: file.originalFilename,
        createdAt: Date.now(),
        expiresAt,
        downloads: 0,
        logs: []
      });

      json(res, { code, expiresIn: 120 });
    });
    return;
  }

  // DOWNLOAD
  if (req.url.startsWith("/download/")) {
    const code = req.url.split("/").pop();
    const data = filesDB.get(code);

    if (!data) return json(res, { error: "Invalid code" }, 404);
    if (Date.now() > data.expiresAt) {
      fs.unlinkSync(data.filepath);
      filesDB.delete(code);
      return json(res, { error: "Expired" }, 410);
    }

    data.downloads++;
    data.logs.push({
      ip: req.socket.remoteAddress,
      ua: req.headers["user-agent"],
      time: new Date().toISOString()
    });

    res.writeHead(200, {
      "Content-Disposition": `attachment; filename="${data.filename}"`
    });
    fs.createReadStream(data.filepath).pipe(res);
    return;
  }

  // INFO
  if (req.url.startsWith("/info/")) {
    const code = req.url.split("/").pop();
    const data = filesDB.get(code);
    if (!data) return json(res, { error: "Invalid" }, 404);
    return json(res, data);
  }

  // MANUAL EXPIRE
  if (req.url.startsWith("/expire/")) {
    const code = req.url.split("/").pop();
    const data = filesDB.get(code);
    if (!data) return json(res, { error: "Invalid" }, 404);
    fs.unlinkSync(data.filepath);
    filesDB.delete(code);
    return json(res, { success: true });
  }

  json(res, { status: "Backend running" });
});

server.listen(process.env.PORT || 3000, () => {
  console.log("Server running");
});
