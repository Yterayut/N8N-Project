// ES module script: PDF -> JPEG using pdfjs-dist + @napi-rs/canvas
import { readFileSync, writeFileSync } from 'fs';

const N8N_MODS = '/home/oneclimate-uat/.nvm/versions/node/v20.19.0/lib/node_modules/n8n/node_modules';
const { createCanvas } = await import(`${N8N_MODS}/@napi-rs/canvas/index.js`);

// Load pdfjs
const pdfjsLib = await import(`${N8N_MODS}/pdfjs-dist/legacy/build/pdf.mjs`);

const inputPath = process.argv[2] || '/tmp/input.pdf';
const outputPath = process.argv[3] || '/tmp/output.jpg';
const scale = parseFloat(process.argv[4] || '2.0');

const data = new Uint8Array(readFileSync(inputPath));
const doc = await pdfjsLib.getDocument({ data }).promise;
console.error(`PDF pages: ${doc.numPages}`);

const page = await doc.getPage(1);
const viewport = page.getViewport({ scale });
console.error(`Page size: ${viewport.width}x${viewport.height}`);

const canvas = createCanvas(Math.round(viewport.width), Math.round(viewport.height));
const ctx = canvas.getContext('2d');

// Fill white background
ctx.fillStyle = '#ffffff';
ctx.fillRect(0, 0, canvas.width, canvas.height);

// Render PDF page
await page.render({
  canvasContext: ctx,
  viewport
}).promise;

const buf = canvas.toBuffer('image/jpeg', { quality: 0.85 });
writeFileSync(outputPath, buf);
console.error(`JPEG written: ${buf.length} bytes`);
console.log(buf.toString('base64'));
