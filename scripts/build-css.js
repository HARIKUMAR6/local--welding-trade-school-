/**
 * Concatenates src/input.css + src/css/*.css into one Tailwind entry file and compiles it.
 * (Per-page component styles live in src/css/ so each homepage's CSS stays readable.)
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const parts = [path.join(ROOT, 'src', 'input.css')];
const dir = path.join(ROOT, 'src', 'css');
if (fs.existsSync(dir)) fs.readdirSync(dir).filter((f) => f.endsWith('.css')).sort().forEach((f) => parts.push(path.join(dir, f)));

const bundle = path.join(ROOT, 'src', '_bundle.css');
fs.writeFileSync(bundle, parts.map((p) => fs.readFileSync(p, 'utf8')).join('\n'));

const bin = path.join(ROOT, 'node_modules', 'tailwindcss', 'lib', 'cli.js');
const args = [bin, '-i', bundle, '-o', path.join(ROOT, 'assets', 'css', 'styles.css')];
if (!process.argv.includes('--dev')) args.push('--minify');
execFileSync(process.execPath, args, { stdio: 'inherit', cwd: ROOT });
