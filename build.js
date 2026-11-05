// Builds dist/ (index.html, sw.js, manifest, icons) from src/. Run: node build.js
const fs = require('fs'), path = require('path'), esbuild = require('esbuild');
const M = p => fs.readFileSync(path.join(__dirname, 'node_modules', p), 'utf8');
const MOCK = process.env.MOCK === '1';
const out = path.join(__dirname, MOCK ? 'dist-test' : 'dist'); fs.mkdirSync(out, { recursive: true });
const sync = esbuild.buildSync({ entryPoints: ['src/sync.js'], bundle: true, minify: true, format: 'iife', globalName: 'SYNC', write: false, target: 'es2019', alias: MOCK ? { 'firebase/app': './test/mock-app.js', 'firebase/auth': './test/mock-auth.js', 'firebase/firestore': './test/mock-firestore.js' } : undefined }).outputFiles[0].text;
const libs = ['d3-array/dist/d3-array.min.js', 'd3-geo/dist/d3-geo.min.js', 'topojson-client/dist/topojson-client.min.js'].map(M).join('\n');
const world = JSON.stringify(JSON.parse(M('world-atlas/countries-110m.json')));
const cfgFile = path.join(__dirname, 'firebase-config.json');
const config = fs.existsSync(cfgFile) ? JSON.stringify(JSON.parse(fs.readFileSync(cfgFile, 'utf8'))) : 'null';
let html = fs.readFileSync('src/app.html', 'utf8');
html = html.replace('/*@LIBS@*/', () => libs).replace('/*@SYNC@*/', () => sync).replace('/*@WORLD@*/', () => world).replace('/*@CONFIG@*/null', () => config);
fs.writeFileSync(path.join(out, 'index.html'), html);
const version = 'fs-' + Date.now().toString(36);
fs.writeFileSync(path.join(out, 'sw.js'), fs.readFileSync('src/sw.js', 'utf8').replace('__VERSION__', version));
for (const f of ['manifest.webmanifest', 'icon-192.png', 'icon-512.png']) fs.copyFileSync(path.join('src', f), path.join(out, f));
console.log('built', version, (html.length / 1024).toFixed(0) + ' KB');
