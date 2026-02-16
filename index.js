import express from "express";
import formidable from "formidable";
import fs from "fs";
import path from "path";
import cors from "cors";  // ✅ import cors

const app = express();
const PORT = process.env.PORT || 3000;
const MASTER = process.env.MASTER_KEY || "manthan123";

// allow CORS for your Vercel frontend
app.use(cors({
  origin: "https://filesnap-eight.vercel.app", // replace with your actual Vercel URL
  methods: ["GET", "POST"]
}));

// ensure uploads folder exists
if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");

// ...rest of your backend code (upload/download endpoints)...

// auth middleware
function auth(req, res, next) {
  const key = req.headers.authorization || req.query.key;
  if (key !== MASTER) return res.sendStatus(401);
  next();
}

// upload endpoint
app.post("/upload", auth, (req, res) => {
  const form = formidable({
    uploadDir: "uploads",
    keepExtensions: true,
    maxFileSize: 100 * 1024 * 1024 // 100MB
  });

  form.parse(req, (err, fields, files) => {
    if (err) return res.status(400).send("Upload error");

    const file = files.file[0];
    const id = path.basename(file.filepath);

    // auto delete after 10 minutes
    setTimeout(() => {
      if (fs.existsSync(`uploads/${id}`)) {
        fs.unlink(`uploads/${id}`, () => {});
      }
    }, 10 * 60 * 1000);

    res.json({ link: `/file/${id}` });
  });
});

// download endpoint (one-time)
app.get("/file/:id", auth, (req, res) => {
  const filePath = `uploads/${req.params.id}`;
  if (!fs.existsSync(filePath)) return res.sendStatus(404);

  res.download(filePath, () => {
    fs.unlink(filePath, () => {});
  });
});

// root
app.get("/", (req, res) => {
  res.send("Private Share is running.");
});

app.listen(PORT, () => {
  console.log("Running on port", PORT);
});
