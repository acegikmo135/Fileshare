import http from "http";

const server = http.createServer((req, res) => {
  res.writeHead(200, {"Content-Type": "text/plain"});
  res.end("BACKEND IS RUNNING");
});

server.listen(process.env.PORT || 3000, () => {
  console.log("Server started");
});
