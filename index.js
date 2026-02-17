// index.js
import http from "http";
import { IncomingForm } from "formidable";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const PORT = process.env.PORT || 3000;
const files = new Map(); // code -> metadata

const uploadDir = "./uploads";
fs.mkdirSync(uploadDir, { recursive: true });

function json(res, data) {
  res.writeHead(200, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*"
  });
  res.end(JSON.stringify(data));
}

function genCode() {
  return crypto.randomBytes(4).toString("hex");
}

function getClientInfo(req) {
  return {
    ip: req.socket.remoteAddress,
    ua: req.headers["user-agent"] || "unknown"
  };
}

const server = http.createServer((req, res) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(200, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "*",
      "Access-Control-Allow-Headers": "*"
    });
    return res.end();
  }

  // UPLOAD
  if (req.url === "/upload" && req.method === "POST") {
    const form = new IncomingForm({
      uploadDir,
      keepExtensions: true
    });

    form.parse(req, (err, fields, file) => {
      const f = file.file;
      const code = genCode();
      const expires = Date.now() + 2 * 60 * 1000; // 2 min

      files.set(code, {
        path: f.filepath,
        name: f.originalFilename,
        expires,
        downloads: 0,
        devices: []
      });

      json(res, { code, expiresIn: 120 });
    });
    return;
  }

  // DOWNLOAD
  if (req.url.startsWith("/download/")) {
    const code = req.url.split("/").pop();
    const data = files.get(code);

    if (!data) return json(res, { error: "Invalid code" });
    if (Date.now() > data.expires) {
      files.delete(code);
      return json(res, { error: "Expired" });
    }

    const info = getClientInfo(req);
    data.devices.push(info);
    data.downloads++;

    res.writeHead(200, {
      "Content-Disposition": `attachment; filename="${data.name}"`
    });
    fs.createReadStream(data.path).pipe(res);
    return;
  }

  // STATS
  if (req.url.startsWith("/stats/")) {
    const code = req.url.split("/").pop();
    const data = files.get(code);
    if (!data) return json(res, { error: "Invalid" });

    json(res, {
      downloads: data.downloads,
      devices: data.devices,
      expiresIn: Math.max(0, Math.floor((data.expires - Date.now())/1000))
    });
    return;
  }

  // MANUAL EXPIRE
  if (req.url.startsWith("/expire/")) {
    const code = req.url.split("/").pop();
    files.delete(code);
    json(res, { success: true });
    return;
  }

  json(res, { status: "ok" });
});

server.listen(PORT, () => {
  console.log("Running on", PORT);
});
