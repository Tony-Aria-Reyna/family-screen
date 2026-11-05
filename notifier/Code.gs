/**
 * Family Screen — notification helper (Google Apps Script).
 * Runs every 5 minutes in your own Google account. Reads the family calendar from Firebase and
 * sends reminders to the phones that turned notifications on in Family Screen.
 * Set-up: paste this file, paste appsscript.json, then run setup() once and allow access.
 */
const PROJECT_ID = '__PROJECT_ID__';
const APP_URL = '__APP_URL__';
const BASE = 'https://firestore.googleapis.com/v1/projects/' + PROJECT_ID + '/databases/(default)/documents';

/* ---------- run once ---------- */
function setup() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('tick').timeBased().everyMinutes(5).create();
  tick();
  Logger.log('Family Screen helper is set up and will check every 5 minutes.');
}
/* send a test to every phone that has notifications on */
function testAllPhones() {
  listDocs('households').forEach(h => Object.keys(h.devices || {}).forEach(k => send(h, k, '🔔 Family Screen', 'Test from the helper — notifications are working.', 'test')));
}

/* ---------- every 5 minutes ---------- */
function tick() {
  const props = PropertiesService.getScriptProperties();
  const sent = props.getProperties();
  const now = new Date();
  for (const h of listDocs('households')) {
    let err = '';
    try {
      const data = { events: listDocs('households/' + h._id + '/events'), todos: listDocs('households/' + h._id + '/todos'), flights: listDocs('households/' + h._id + '/flights') };
      const msgs = planNotifications(h, data, now, k => !!sent[k]);
      for (const m of msgs) { send(h, m.device, m.title, m.body, m.tag); props.setProperty(m.key, String(now.getTime())); sent[m.key] = '1'; }
      if (h.testPing && h.testPing.hash && (h.devices || {})[h.testPing.hash]) send(h, h.testPing.hash, '🔔 Family Screen', 'Test notification — this phone is all set.', 'test');
    } catch (e) { err = String(e && e.message || e).slice(0, 300); }
    patch('households/' + h._id, { notifier: { lastRun: now.getTime(), error: err }, testPing: null });
  }
  // tidy up: forget reminders older than 4 days
  const cutoff = now.getTime() - 4 * 864e5;
  Object.keys(sent).forEach(k => { if (+sent[k] > 1 && +sent[k] < cutoff) props.deleteProperty(k); });
}

/* ---------- what to send (pure logic, no network) ---------- */
function planNotifications(h, data, now, already) {
  const out = [], devices = h.devices || {}, people = h.people || [];
  const nameOf = id => ((people.find(p => p.id === id) || {}).name) || '';
  const todayK = keyOf(now), tomorrowK = keyOf(addDays(now, 1));
  const follows = (dev, whos) => !dev.people || !dev.people.length || !whos || !whos.length || whos.indexOf('all') >= 0 || whos.some(w => dev.people.indexOf(w) >= 0);
  for (const hash of Object.keys(devices)) {
    const dev = devices[hash]; if (!dev || !dev.token) continue;
    const lead = (dev.lead || 30) * 60e3;
    // 1) reminders before timed entries (today and early tomorrow)
    if (dev.remind !== false) for (const e of data.events) {
      if (!e.time || e.done || !follows(dev, e.whos)) continue;
      for (const k of [todayK, tomorrowK]) {
        if (!occursOn(e, k)) continue;
        const start = at(k, e.time), from = start.getTime() - lead;
        if (now.getTime() >= from && now < start) {
          const key = 'r|' + hash + '|' + e.id + '|' + k;
          if (already(key)) continue;
          const mins = Math.max(1, Math.round((start - now) / 60e3));
          const who = (e.whos || []).map(nameOf).filter(Boolean).join(' + ');
          out.push({ device: hash, key, tag: e.id + k, title: (e.todoId ? '☐ ' : '⏰ ') + e.title, body: `${fmt12(e.time)} (in ${mins >= 60 ? Math.round(mins / 60) + ' hr' : mins + ' min'})${who ? ' · ' + who : ''}${e.addr ? ' · 📍 ' + e.addr : ''}${e.note ? ' · ' + e.note : ''}` });
        }
      }
    }
    // 2) morning summary at 7am
    if (dev.morning !== false && now.getHours() === 7 && now.getMinutes() < 15) {
      const key = 'm|' + hash + '|' + todayK;
      if (!already(key)) {
        const items = [];
        data.events.filter(e => !e.done && occursOn(e, todayK) && follows(dev, e.whos)).sort((a, b) => (a.time || '').localeCompare(b.time || ''))
          .forEach(e => items.push((e.time ? fmt12(e.time) + ' ' : '') + e.title));
        data.flights.filter(f => follows(dev, [f.who])).forEach(f => {
          const s = new Date(f.start), en = new Date(f.end);
          if (keyOf(s) === todayK) items.push(fmtTime(s) + ' ✈️ ' + nameOf(f.who) + ' ' + (f.flight || '') + ' ' + f.from + '→' + f.to);
          if (keyOf(en) === todayK && keyOf(s) !== todayK) items.push(fmtTime(en) + ' 🛬 ' + nameOf(f.who) + ' lands ' + f.to);
        });
        if (items.length) out.push({ device: hash, key, tag: 'morning' + todayK, title: '☀️ Today: ' + items.length + (items.length === 1 ? ' thing' : ' things'), body: items.slice(0, 6).join('\n') + (items.length > 6 ? '\n+' + (items.length - 6) + ' more' : '') });
      }
    }
    // 3) booked jobs whose time has passed: did it get done?
    if (dev.jobs !== false) for (const t of data.todos) {
      if (t.done || !t.eventId) continue;
      const e = data.events.find(x => x.id === t.eventId); if (!e) continue;
      if (!follows(dev, t.who ? [t.who] : [])) continue;
      const due = e.time ? new Date(at(e.date, e.time).getTime() + 60 * 60e3) : at(e.date, '18:00');
      if (now < due || now - due > 2 * 864e5) continue;
      const key = 'j|' + hash + '|' + t.id + '|' + e.date;
      if (already(key)) continue;
      out.push({ device: hash, key, tag: 'job' + t.id, title: '✅ Did it get done?', body: t.title + (t.who ? ' · ' + nameOf(t.who) : '') + ' — open Family Screen to tick it off or move it.' });
    }
  }
  return out;
}

/* ---------- dates (the script runs in NZ time; see appsscript.json) ---------- */
function pad(n) { return (n < 10 ? '0' : '') + n; }
function keyOf(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function kd(k) { const p = k.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2], 12); }
function at(k, hm) { const p = k.split('-').map(Number), t = hm.split(':').map(Number); return new Date(p[0], p[1] - 1, p[2], t[0], t[1]); }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function monday(d) { const x = new Date(d); x.setHours(12, 0, 0, 0); return addDays(x, -((x.getDay() + 6) % 7)); }
function fmt12(hm) { const t = hm.split(':').map(Number); return ((t[0] % 12) || 12) + ':' + pad(t[1]) + (t[0] < 12 ? 'am' : 'pm'); }
function fmtTime(d) { return fmt12(pad(d.getHours()) + ':' + pad(d.getMinutes())); }
function occursOn(e, key) {          // same rules as the app
  if (!e.rpt) return e.date === key;
  const r = e.rpt; if (key < e.date) return false; if (r.until && key > r.until) return false; if (r.ex && r.ex.indexOf(key) >= 0) return false;
  const a = kd(e.date), b = kd(key), n = Math.max(1, r.n || 1), DAY = 864e5;
  if (r.f === 'D') return Math.round((b - a) / DAY) % n === 0;
  if (r.f === 'W') { const days = r.days && r.days.length ? r.days : [a.getDay()]; if (days.indexOf(b.getDay()) < 0) return false; return Math.round((monday(b) - monday(a)) / (7 * DAY)) % n === 0; }
  if (r.f === 'M') { if (b.getDate() !== a.getDate()) return false; return ((b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth()) % n === 0; }
  if (r.f === 'Y') return b.getDate() === a.getDate() && b.getMonth() === a.getMonth() && (b.getFullYear() - a.getFullYear()) % n === 0;
  return e.date === key;
}

/* ---------- Firebase (Firestore + Cloud Messaging) over the web ---------- */
function headers() { return { Authorization: 'Bearer ' + ScriptApp.getOAuthToken(), 'x-goog-user-project': PROJECT_ID }; }
function dec(v) {
  if (!v) return null;
  if ('stringValue' in v) return v.stringValue; if ('integerValue' in v) return Number(v.integerValue); if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue; if ('nullValue' in v) return null; if ('timestampValue' in v) return v.timestampValue;
  if ('mapValue' in v) { const o = {}, f = v.mapValue.fields || {}; Object.keys(f).forEach(k => o[k] = dec(f[k])); return o; }
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(dec);
  return null;
}
function enc(x) {
  if (x === null || x === undefined) return { nullValue: null };
  if (typeof x === 'boolean') return { booleanValue: x };
  if (typeof x === 'number') return Number.isInteger(x) ? { integerValue: String(x) } : { doubleValue: x };
  if (typeof x === 'string') return { stringValue: x };
  if (Array.isArray(x)) return { arrayValue: { values: x.map(enc) } };
  const f = {}; Object.keys(x).forEach(k => f[k] = enc(x[k])); return { mapValue: { fields: f } };
}
function listDocs(path) {
  const out = []; let token = '';
  do {
    const r = UrlFetchApp.fetch(BASE + '/' + path + '?pageSize=300' + (token ? '&pageToken=' + encodeURIComponent(token) : ''), { headers: headers(), muteHttpExceptions: true });
    if (r.getResponseCode() !== 200) throw new Error('Reading ' + path + ': ' + r.getResponseCode() + ' ' + r.getContentText().slice(0, 200));
    const j = JSON.parse(r.getContentText());
    (j.documents || []).forEach(d => { const o = dec({ mapValue: { fields: d.fields || {} } }); o._id = d.name.split('/').pop(); if (!o.id) o.id = o._id; out.push(o); });
    token = j.nextPageToken || '';
  } while (token);
  return out;
}
function patch(path, fields) {
  const mask = Object.keys(fields).map(k => 'updateMask.fieldPaths=' + encodeURIComponent(k)).join('&');
  const body = { fields: {} }; Object.keys(fields).forEach(k => { if (fields[k] !== undefined) body.fields[k] = enc(fields[k]); });
  UrlFetchApp.fetch(BASE + '/' + path + '?' + mask, { method: 'patch', contentType: 'application/json', payload: JSON.stringify(body), headers: headers(), muteHttpExceptions: true });
}
function send(h, hash, title, body, tag) {
  const dev = (h.devices || {})[hash]; if (!dev || !dev.token) return;
  const msg = { message: { token: dev.token, data: { title: String(title), body: String(body), tag: String(tag || ''), url: APP_URL },
    webpush: { headers: { Urgency: 'high', TTL: '3600' } } } };
  const r = UrlFetchApp.fetch('https://fcm.googleapis.com/v1/projects/' + PROJECT_ID + '/messages:send', { method: 'post', contentType: 'application/json', payload: JSON.stringify(msg), headers: headers(), muteHttpExceptions: true });
  const code = r.getResponseCode();
  if (code === 404 || (code === 400 && /UNREGISTERED|INVALID_ARGUMENT/.test(r.getContentText()))) {
    // that phone uninstalled or turned notifications off: forget it
    UrlFetchApp.fetch(BASE + '/households/' + h._id + '?updateMask.fieldPaths=' + encodeURIComponent('devices.`' + hash + '`'), { method: 'patch', contentType: 'application/json', payload: JSON.stringify({ fields: {} }), headers: headers(), muteHttpExceptions: true });
  } else if (code !== 200) throw new Error('Sending: ' + code + ' ' + r.getContentText().slice(0, 200));
}
if (typeof module !== 'undefined') module.exports = { planNotifications, occursOn };
