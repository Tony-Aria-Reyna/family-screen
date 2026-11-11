// Builds dist/ (index.html, sw.js, manifest, icons) from src/. Run: node build.js
const fs = require('fs'), path = require('path'), esbuild = require('esbuild');
const M = p => fs.readFileSync(path.join(__dirname, 'node_modules', p), 'utf8');
const MOCK = process.env.MOCK === '1';
const out = path.join(__dirname, MOCK ? 'dist-test' : 'dist'); fs.mkdirSync(out, { recursive: true });
const sync = esbuild.buildSync({ entryPoints: ['src/sync.js'], bundle: true, minify: true, format: 'iife', globalName: 'SYNC', write: false, target: 'es2019', alias: MOCK ? { 'firebase/app': './test/mock-app.js', 'firebase/auth': './test/mock-auth.js', 'firebase/firestore': './test/mock-firestore.js', 'firebase/messaging': './test/mock-messaging.js' } : undefined }).outputFiles[0].text;
// Big libraries live in their own files, named by content, so they are fetched once and kept; the globe and card
// libraries are only loaded when that screen opens, which keeps the app quick to start.
const crypto = require('crypto'), hashOf = t => crypto.createHash('sha1').update(t).digest('hex').slice(0, 10);
const world = JSON.stringify(JSON.parse(M('world-atlas/countries-110m.json')));
const globeLib = ['d3-array/dist/d3-array.min.js', 'd3-geo/dist/d3-geo.min.js', 'topojson-client/dist/topojson-client.min.js'].map(M).join('\n') + '\nconst WORLD=' + world + ';';
const cardsLib = ['jsbarcode/dist/JsBarcode.all.min.js', 'qrcode-generator/dist/qrcode.js'].map(M).join('\n');
const LIBFILES = { globe: 'lib/globe-' + hashOf(globeLib) + '.js', cards: 'lib/cards-' + hashOf(cardsLib) + '.js' };
const cfgFile = path.join(__dirname, 'firebase-config.json');
const config = fs.existsSync(cfgFile) ? JSON.stringify(JSON.parse(fs.readFileSync(cfgFile, 'utf8'))) : 'null';
let html = fs.readFileSync('src/app.html', 'utf8');
// the helper needs each airport's time zone to ask for the right local date
function helperCode() {
  const app = fs.readFileSync('src/app.html', 'utf8'), tz = {};
  for (const m of app.matchAll(/^\s*([A-Z]{3}):\['([^']*)','([A-Za-z_\/]+)'/gm)) tz[m[1]] = [m[3], m[2]];
  return fs.readFileSync('notifier/Code.gs', 'utf8').replace('{/*@TZ@*/}', () => JSON.stringify(tz).replace(/\],/g, '],\n  '));
}
html = html.replace('<script>/*@LIBS@*/</script>', '').replace('<script>const WORLD=/*@WORLD@*/;</script>', '').replace('/*@LIBFILES@*/', () => JSON.stringify(LIBFILES)).replace('/*@SYNC@*/', () => sync).replace('/*@HOME@*/', () => fs.readFileSync('src/home.js', 'utf8').replace('/*@RECIPES@*/[]', () => JSON.stringify(JSON.parse(fs.readFileSync('src/recipes.json', 'utf8')))).replace("/*@ALEXA@*/''", () => JSON.stringify(fs.readFileSync('src/alexa-skill.js', 'utf8')))).replace('/*@ROSTER@*/', () => fs.readFileSync('src/roster-parse.js', 'utf8')).replace('/*@NOTIFIER@*/null', () => JSON.stringify({ code: helperCode(), manifest: fs.readFileSync('notifier/appsscript.json', 'utf8') })).replace('/*@CONFIG@*/null', () => config);
const version = 'fs-' + Date.now().toString(36);
html = html.replace('/*@VERSION@*/', version);
fs.writeFileSync(path.join(out, 'index.html'), html);
fs.mkdirSync(path.join(out, 'lib'), { recursive: true });
fs.writeFileSync(path.join(out, LIBFILES.globe), globeLib); fs.writeFileSync(path.join(out, LIBFILES.cards), cardsLib);
fs.writeFileSync(path.join(out, 'version.json'), JSON.stringify({ version }));
fs.writeFileSync(path.join(out, 'sw.js'), fs.readFileSync('src/sw.js', 'utf8').replace('__VERSION__', version).replace('__LIBS__', JSON.stringify(Object.values(LIBFILES))));
for (const f of ['manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'privacy.html', 'earth-day.jpg', 'earth-night.jpg']) fs.copyFileSync(path.join('src', f), path.join(out, f));
fs.mkdirSync(path.join(out, 'lib'), { recursive: true });
for (const f of ['pdf.min.mjs', 'pdf.worker.min.mjs']) fs.copyFileSync(path.join(__dirname, 'node_modules/pdfjs-dist/build', f), path.join(out, 'lib', f));
console.log('built', version, (html.length / 1024).toFixed(0) + ' KB');

// Safety net: refuse to finish if any script in the built page has a syntax error (a typo would blank the app)
{
  const vm = require('vm');
  for (const f of [path.join(out, 'index.html')]) {
    const html = fs.readFileSync(f, 'utf8'); let n = 0;
    for (const m of html.matchAll(/<script(?![^>]*\bsrc=)(?![^>]*type="module")[^>]*>([\s\S]*?)<\/script>/g)) {
      n++; try { new vm.Script(m[1], { filename: f + ' script ' + n }); } catch (e) { console.error('BUILD STOPPED: syntax error in script ' + n + ': ' + e.message); fs.rmSync(f); process.exit(1); }
    }
  }
}
