import express from "express";
import formidable from "formidable";
import fs from "fs";
import crypto from "crypto";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const uploads = new Map(); // in-memory DB

// utils
function genCode(){
  return crypto.randomBytes(6).toString("hex");
}

function getClientInfo(req){
  return {
    ip: req.headers["x-forwarded-for"] || req.socket.remoteAddress,
    ua: req.headers["user-agent"]
  };
}

// upload
app.post("/upload", (req,res)=>{
  const form = formidable({
    uploadDir:"./uploads",
    keepExtensions:true,
    maxFileSize: 200 * 1024 * 1024 // 200MB
  });

  const code = genCode();
  uploads.set(code,{
    status:"uploading",
    downloads:0,
    createdAt:Date.now(),
    expiresAt:Date.now()+120000,
    receivers:[]
  });

  form.parse(req,(err,fields,files)=>{
    if(err) return res.status(500).json({err:"upload failed"});

    const file = files.file[0];
    uploads.set(code,{
      ...uploads.get(code),
      status:"ready",
      path:file.filepath,
      name:file.originalFilename
    });

    res.json({ code, expiresIn:120 });
  });
});

// receive
app.post("/receive",(req,res)=>{
  const {code} = req.body;
  const entry = uploads.get(code);
  if(!entry) return res.status(404).json({err:"invalid"});

  if(Date.now()>entry.expiresAt){
    uploads.delete(code);
    return res.status(410).json({err:"expired"});
  }

  if(entry.status!=="ready")
    return res.status(202).json({err:"not_ready"});

  entry.downloads++;
  entry.receivers.push(getClientInfo(req));

  res.download(entry.path, entry.name);
});

// stats
app.get("/stats/:code",(req,res)=>{
  const e = uploads.get(req.params.code);
  if(!e) return res.status(404).json({err:"invalid"});
  res.json(e);
});

// manual expire
app.post("/expire",(req,res)=>{
  uploads.delete(req.body.code);
  res.json({ok:true});
});

app.listen(PORT,()=>console.log("Running",PORT));
