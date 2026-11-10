// Builds dist/ (index.html, sw.js, manifest, icons) from src/. Run: node build.js
const fs = require('fs'), path = require('path'), esbuild = require('esbuild');
const M = p => fs.readFileSync(path.join(__dirname, 'node_modules', p), 'utf8');
const MOCK = process.env.MOCK === '1';
const out = path.join(__dirname, MOCK ? 'dist-test' : 'dist'); fs.mkdirSync(out, { recursive: true });
const sync = esbuild.buildSync({ entryPoints: ['src/sync.js'], bundle: true, minify: true, format: 'iife', globalName: 'SYNC', write: false, target: 'es2019', alias: MOCK ? { 'firebase/app': './test/mock-app.js', 'firebase/auth': './test/mock-auth.js', 'firebase/firestore': './test/mock-firestore.js', 'firebase/messaging': './test/mock-messaging.js' } : undefined }).outputFiles[0].text;
const libs = ['d3-array/dist/d3-array.min.js', 'd3-geo/dist/d3-geo.min.js', 'topojson-client/dist/topojson-client.min.js', 'jsbarcode/dist/JsBarcode.all.min.js', 'qrcode-generator/dist/qrcode.js'].map(M).join('\n');
const world = JSON.stringify(JSON.parse(M('world-atlas/countries-110m.json')));
const cfgFile = path.join(__dirname, 'firebase-config.json');
const config = fs.existsSync(cfgFile) ? JSON.stringify(JSON.parse(fs.readFileSync(cfgFile, 'utf8'))) : 'null';
let html = fs.readFileSync('src/app.html', 'utf8');
// the helper needs each airport's time zone to ask for the right local date
function helperCode() {
  const app = fs.readFileSync('src/app.html', 'utf8'), tz = {};
  for (const m of app.matchAll(/^\s*([A-Z]{3}):\['([^']*)','([A-Za-z_\/]+)'/gm)) tz[m[1]] = [m[3], m[2]];
  return fs.readFileSync('notifier/Code.gs', 'utf8').replace('{/*@TZ@*/}', () => JSON.stringify(tz).replace(/\],/g, '],\n  '));
}
html = html.replace('/*@LIBS@*/', () => libs).replace('/*@SYNC@*/', () => sync).replace('/*@HOME@*/', () => fs.readFileSync('src/home.js', 'utf8').replace('/*@RECIPES@*/[]', () => JSON.stringify(JSON.parse(fs.readFileSync('src/recipes.json', 'utf8'))))).replace('/*@ROSTER@*/', () => fs.readFileSync('src/roster-parse.js', 'utf8')).replace('/*@NOTIFIER@*/null', () => JSON.stringify({ code: helperCode(), manifest: fs.readFileSync('notifier/appsscript.json', 'utf8') })).replace('/*@WORLD@*/', () => world).replace('/*@CONFIG@*/null', () => config);
const version = 'fs-' + Date.now().toString(36);
html = html.replace('/*@VERSION@*/', version);
fs.writeFileSync(path.join(out, 'index.html'), html);
fs.writeFileSync(path.join(out, 'version.json'), JSON.stringify({ version }));
fs.writeFileSync(path.join(out, 'sw.js'), fs.readFileSync('src/sw.js', 'utf8').replace('__VERSION__', version));
for (const f of ['manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'privacy.html', 'earth-day.jpg', 'earth-night.jpg']) fs.copyFileSync(path.join('src', f), path.join(out, f));
fs.mkdirSync(path.join(out, 'lib'), { recursive: true });
for (const f of ['pdf.min.mjs', 'pdf.worker.min.mjs']) fs.copyFileSync(path.join(__dirname, 'node_modules/pdfjs-dist/build', f), path.join(out, 'lib', f));
console.log('built', version, (html.length / 1024).toFixed(0) + ' KB');
