import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";

const app = express();
const PORT = process.env.PORT || 3000;
const MASTER = process.env.MASTER_KEY || "manthan123";

// ensure uploads dir
if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

// multer config
const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB
});

// auth middleware
function auth(req, res, next) {
  const key = req.headers.authorization || req.query.key;
  if (key !== MASTER) return res.sendStatus(401);
  next();
}

// upload
app.post("/upload", auth, upload.single("file"), (req, res) => {
  const id = req.file.filename;

  // auto delete after 10 min if not downloaded
  setTimeout(() => {
    if (fs.existsSync(`uploads/${id}`)) {
      fs.unlink(`uploads/${id}`, () => {});
    }
  }, 10 * 60 * 1000);

  res.json({ link: `/file/${id}` });
});

// download (one-time)
app.get("/file/:id", auth, (req, res) => {
  const filePath = `uploads/${req.params.id}`;
  if (!fs.existsSync(filePath)) return res.sendStatus(404);

  res.download(filePath, () => {
    fs.unlink(filePath, () => {});
  });
});

app.get("/", (req, res) => {
  res.send("Private Share is running.");
});

app.listen(PORT, () => {
  console.log("Running on port", PORT);
});
