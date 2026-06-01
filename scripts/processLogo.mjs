/**
 * One-off: make the MDA logo's solid black background transparent so it can
 * sit on a clean white badge instead of a black rectangle.
 */
import fs from 'fs';
import path from 'path';
import { PNG } from 'pngjs';

const SRC = path.resolve('/tmp/mda-logo-real.png');
const OUT = path.resolve('public/mda-logo-transparent.png');
const THRESHOLD = 70; // pixels with all channels below this become transparent

const buf = fs.readFileSync(SRC);

new PNG().parse(buf, (err, png) => {
  if (err) {
    console.error('Parse error:', err);
    process.exit(1);
  }
  let cleared = 0;
  for (let i = 0; i < png.data.length; i += 4) {
    const r = png.data[i];
    const g = png.data[i + 1];
    const b = png.data[i + 2];
    if (r <= THRESHOLD && g <= THRESHOLD && b <= THRESHOLD) {
      png.data[i + 3] = 0;
      cleared++;
    }
  }
  png.pack().pipe(fs.createWriteStream(OUT)).on('finish', () => {
    console.log(`Wrote ${OUT} — cleared ${cleared} background pixels.`);
  });
});
