import sharp from "sharp";
import fs from "fs";
import path from "path";

const [,, src, dest, maxEdgeStr] = process.argv;
const maxEdge = Number(maxEdgeStr || 1920);
const ext = path.extname(dest).toLowerCase();
await fs.promises.mkdir(path.dirname(dest), { recursive: true });
let img = sharp(src);
const meta = await img.metadata();
const w = meta.width || 0;
const h = meta.height || 0;
const long = Math.max(w, h);
if (long > maxEdge && long > 0) {
  img = img.resize({
    width: w >= h ? maxEdge : null,
    height: h > w ? maxEdge : null,
    fit: "inside",
    withoutEnlargement: false,
  });
}
if (ext === ".png") {
  await img.png({ compressionLevel: 9 }).toFile(dest);
} else if (ext === ".jpg" || ext === ".jpeg") {
  await img.jpeg({ quality: 90, mozjpeg: true }).toFile(dest);
} else if (ext === ".webp") {
  await img.webp({ quality: 90 }).toFile(dest);
} else {
  // unknown: write jpeg then rename not needed — default jpeg bytes with original ext name
  await img.jpeg({ quality: 90, mozjpeg: true }).toFile(dest);
}
console.log("ok", dest);
