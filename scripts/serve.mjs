import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";

const distDir = join(dirname(fileURLToPath(import.meta.url)), "..", "dist");
const port = 4041;
const types = { ".json": "application/json", ".js": "text/javascript" };

createServer(async (req, res) => {
  try {
    const path = join(distDir, decodeURIComponent(req.url.split("?")[0]));
    const body = await readFile(path);
    res.setHeader("Content-Type", types[extname(path)] ?? "application/octet-stream");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.end(body);
  } catch {
    res.statusCode = 404;
    res.end("not found");
  }
}).listen(port, () => console.log(`serving dist/ on http://<your-ip>:${port}/repo.json`));
