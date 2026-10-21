// Usage: node scripts/contact-sheet.js <dir> <out.jpg> [startIndex] [count]
const sharp = require('sharp'); const fs = require('fs'); const path = require('path');
(async () => {
  const [dir, out, s = '0', c = '12'] = process.argv.slice(2);
  const files = fs.readdirSync(dir).filter((f) => /\.jpe?g$/i.test(f)).sort().slice(+s, +s + +c);
  const W = 400, H = 280, cols = 4, rows = Math.ceil(files.length / cols);
  const comps = [];
  for (let i = 0; i < files.length; i++) {
    const x = (i % cols) * W, y = Math.floor(i / cols) * H;
    const img = await sharp(path.join(dir, files[i])).resize(W - 6, H - 30, { fit: 'cover' }).toBuffer();
    comps.push({ input: img, left: x + 3, top: y + 3 });
    const label = Buffer.from(`<svg width="${W}" height="24"><rect width="100%" height="100%" fill="#000"/><text x="6" y="17" font-size="14" fill="#fff" font-family="Arial">${+s + i}: ${files[i].replace(/[<>&]/g, '').slice(0, 44)}</text></svg>`);
    comps.push({ input: label, left: x, top: y + H - 26 });
  }
  await sharp({ create: { width: W * cols, height: H * rows, channels: 3, background: '#222' } }).composite(comps).jpeg({ quality: 80 }).toFile(out);
  console.log(files.map((f, i) => `${+s + i}: ${f}`).join('\n'));
})();
