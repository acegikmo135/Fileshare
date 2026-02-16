import express from "express";
import formidable from "formidable";
import fs from "fs";
import path from "path";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 3000;
const MASTER = process.env.MASTER_KEY || "manthan123";

app.use(cors({ origin: "*" }));
app.use(express.json());

if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");

const fileMap = {}; // code -> file path

function generateCode(length = 6) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let code = "";
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Upload
app.post("/upload", (req, res) => {
  const key = req.headers.authorization || req.query.key;
  if (key !== MASTER) return res.sendStatus(401);

  const form = formidable({
    uploadDir: "uploads",
    keepExtensions: true,
    maxFileSize: 100 * 1024 * 1024, // 100 MB
  });

  form.parse(req, (err, fields, files) => {
    if (err) return res.status(400).send("Upload error");

    const file = Array.isArray(files.file) ? files.file[0] : files.file;
    const code = generateCode();
    const id = path.basename(file.filepath);
    fileMap[code] = `uploads/${id}`;

    // Auto-delete after 10 minutes
    setTimeout(() => {
      if (fs.existsSync(fileMap[code])) fs.unlinkSync(fileMap[code]);
      delete fileMap[code];
    }, 10 * 60 * 1000);

    res.json({ code });
  });
});

// Receive
app.post("/receive", (req, res) => {
  const { code } = req.body;
  const filePath = fileMap[code];

  if (!filePath || !fs.existsSync(filePath)) return res.status(404).send("File not found or expired");

  res.download(filePath, () => {
    fs.unlinkSync(filePath);
    delete fileMap[code];
  });
});

app.get("/", (req, res) => res.send("Private Share with Code running."));

app.listen(PORT, () => console.log(`Running on port ${PORT}`));
