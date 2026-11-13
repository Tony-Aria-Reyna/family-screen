/**
 * Family Screen — notification helper (Google Apps Script).
 * Runs every 5 minutes in your own Google account. Reads the family calendar from Firebase and
 * sends reminders to the phones that turned notifications on in Family Screen.
 * Set-up: paste this file, paste appsscript.json, then run setup() once and allow access.
 * Live flight status (optional): add a Script property AERODATABOX_KEY with your free RapidAPI key
 * (⚙️ Project Settings → Script properties). The key stays here in your Google account, never on the website.
 */
const HELPER_VERSION = 10;
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
  const flightNote = { key: !!props.getProperty('AERODATABOX_KEY'), used: +(props.getProperty('adb|' + keyOf(now).slice(0, 7)) || 0), budget: FLIGHT_BUDGET, error: '' };
  const rules = syncRules(props, now);
  for (const h of listDocs('households')) {
    let err = '';
    try {
      const data = { events: listDocs('households/' + h._id + '/events'), todos: listDocs('households/' + h._id + '/todos'), flights: listDocs('households/' + h._id + '/flights'), renewals: [] };
      try { data.renewals = listDocs('households/' + h._id + '/renewals'); } catch (e) {}
      data.bills = [];
      try { data.bills = billsTick(h, props, now); } catch (e) { Logger.log('Bills: ' + e); }
      // private entries: each member's own corner. Reminders for these go only to that member's own phones.
      for (const who of (h.members || [])) for (const c of ['events', 'todos']) {
        try { listDocs('households/' + h._id + '/private/' + encodeURIComponent(who) + '/' + c).forEach(x => { x._owner = who; data[c].push(x); }); } catch (e) {}
      }
      const msgs = planNotifications(h, data, now, k => !!sent[k]);
      billArrivals(h, data.bills, msgs, k => !!sent[k]);
      try { trackFlights(h, data.flights, now, props, msgs); } catch (e) { flightNote.error = String(e && e.message || e).slice(0, 200); }
      for (const m of msgs) { send(h, m.device, m.title, m.body, m.tag); props.setProperty(m.key, String(now.getTime())); sent[m.key] = '1'; }
      if (h.testPing && h.testPing.hash && (h.devices || {})[h.testPing.hash]) send(h, h.testPing.hash, '🔔 Family Screen', 'Test notification — this phone is all set.', 'test');
    } catch (e) { err = String(e && e.message || e).slice(0, 300); }
    patch('households/' + h._id, { notifier: { lastRun: now.getTime(), error: err, version: HELPER_VERSION, rules: rules, flights: { key: flightNote.key, used: +(props.getProperty('adb|' + keyOf(now).slice(0, 7)) || 0), budget: FLIGHT_BUDGET, error: flightNote.error } }, testPing: null });
  }
  // tidy up: forget reminders older than 4 days
  const cutoff = now.getTime() - 4 * 864e5;
  Object.keys(sent).forEach(k => { if (+sent[k] > 1 && +sent[k] < cutoff) props.deleteProperty(k); });
}

/* ---------- database rules: kept in step with the app automatically ----------
   The app's site publishes firestore.rules next to the app. Every 15 minutes this reads it, and if it has changed
   since last time it publishes it to Firebase (the same as pasting it into the console and pressing Publish).
   Firebase checks the rules first: a file with a mistake is refused and the rules already in place stay. */
function syncRules(props, now) {
  const last = JSON.parse(props.getProperty('RULES_STATE') || '{}');
  if (last.checked && now.getTime() - last.checked < 14 * 60e3) return last.report || null;
  const report = { checked: now.getTime(), ok: true, at: last.report && last.report.at || 0, error: '' };
  try {
    const r = UrlFetchApp.fetch(APP_URL.replace(/[^/]*$/, '') + 'firestore.rules?t=' + now.getTime(), { muteHttpExceptions: true, followRedirects: true });
    if (r.getResponseCode() !== 200) throw new Error('Could not read the rules file from the app site (' + r.getResponseCode() + ')');
    const text = r.getContentText();
    if (!/service\s+cloud\.firestore/.test(text) || !/match \/households\/\{hid\}/.test(text)) throw new Error('The rules file on the app site does not look right, so it was not published');
    const hash = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text));
    if (hash !== last.hash) {
      const api = 'https://firebaserules.googleapis.com/v1/projects/' + PROJECT_ID;
      const c = UrlFetchApp.fetch(api + '/rulesets', { method: 'post', contentType: 'application/json', headers: headers(), muteHttpExceptions: true,
        payload: JSON.stringify({ source: { files: [{ name: 'firestore.rules', content: text }] } }) });
      if (c.getResponseCode() !== 200) throw new Error('Firebase refused the new rules: ' + c.getContentText().slice(0, 200));
      const rel = 'projects/' + PROJECT_ID + '/releases/cloud.firestore';
      const u = UrlFetchApp.fetch('https://firebaserules.googleapis.com/v1/' + rel, { method: 'patch', contentType: 'application/json', headers: headers(), muteHttpExceptions: true,
        payload: JSON.stringify({ release: { name: rel, rulesetName: JSON.parse(c.getContentText()).name } }) });
      if (u.getResponseCode() !== 200) throw new Error('Could not switch to the new rules: ' + u.getContentText().slice(0, 200));
      last.hash = hash; report.at = now.getTime();
    }
  } catch (e) { report.ok = false; report.error = String(e && e.message || e).slice(0, 240); }
  last.checked = now.getTime(); last.report = report;
  props.setProperty('RULES_STATE', JSON.stringify(last));
  return report;
}
// run by hand from the script editor to publish the rules straight away
function publishRulesNow() { const p = PropertiesService.getScriptProperties(); p.deleteProperty('RULES_STATE'); Logger.log(JSON.stringify(syncRules(p, new Date()))); }

/* ---------- what to send (pure logic, no network) ---------- */
function planNotifications(h, all, now, already) {
  let data = all;
  const out = [], devices = h.devices || {}, people = h.people || [];
  const nameOf = id => ((people.find(p => p.id === id) || {}).name) || '';
  const todayK = keyOf(now), tomorrowK = keyOf(addDays(now, 1));
  const follows = (dev, whos) => !dev.people || !dev.people.length || !whos || !whos.length || whos.indexOf('all') >= 0 || whos.some(w => dev.people.indexOf(w) >= 0);
  for (const hash of Object.keys(devices)) {
    const dev = devices[hash]; if (!dev || !dev.token) continue;
    const mine = x => !x._owner || (dev.email && x._owner === String(dev.email).toLowerCase());
    data = { events: all.events.filter(mine), todos: all.todos.filter(mine), flights: all.flights, renewals: all.renewals || [], bills: all.bills || [] };
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
          if (dev.private) { out.push({ device: hash, key, tag: e.id + k, title: '⏰ Family Screen', body: 'Something on the calendar starts at ' + fmt12(e.time) + '.' }); continue; }
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
        if (items.length && dev.private) out.push({ device: hash, key, tag: 'morning' + todayK, title: '☀️ Family Screen', body: 'You have ' + items.length + (items.length === 1 ? ' thing' : ' things') + ' on today.' });
        else if (items.length) out.push({ device: hash, key, tag: 'morning' + todayK, title: '☀️ Today: ' + items.length + (items.length === 1 ? ' thing' : ' things'), body: items.slice(0, 6).join('\n') + (items.length > 6 ? '\n+' + (items.length - 6) + ' more' : '') });
      }
    }
    // renewals (WOF, rego, insurance…): a month before, a week before and on the day, at 9am
    if (dev.remind !== false && now.getHours() === 9 && now.getMinutes() < 15) for (const r of data.renewals) {
      if (!r.due) continue;
      const days = Math.round((at(r.due, '12:00') - at(todayK, '12:00')) / 864e5);
      const stage = days === 30 ? '30' : days === 7 ? '7' : days === 0 ? '0' : days === -3 ? 'late' : '';
      if (!stage) continue;
      const key = 'rn|' + hash + '|' + r.id + '|' + r.due + '|' + stage;
      if (already(key)) continue;
      const what = (r.emoji || '📌') + ' ' + r.what + (r.item ? ' · ' + r.item : '');
      const when = days === 0 ? 'is due today' : days < 0 ? 'was due ' + (-days) + ' days ago' : 'is due in ' + days + ' days';
      out.push({ device: hash, key, tag: 'rn' + r.id, title: dev.private ? '📌 Family Screen' : what, body: dev.private ? 'A renewal ' + when + '.' : 'Renewal ' + when + (r.cost ? ' · $' + r.cost : '') + (r.ref ? ' · ' + r.ref : '') });
    }
    // bills: 7 and 2 days before, on the day, then 3 days overdue (9am). Direct debits: one note 2 days before.
    if (dev.remind !== false && now.getHours() === 9 && now.getMinutes() < 15) for (const b of data.bills) {
      if (b.status !== 'due' || !b.due) continue;
      const days = Math.round((at(b.due, '12:00') - at(todayK, '12:00')) / 864e5);
      const stage = b.directDebit ? (days === 2 ? 'dd' : '') : ([7, 2, 0, -1, -2, -3].indexOf(days) >= 0 ? String(days) : '');
      if (!stage) continue;
      const key = 'bl|' + hash + '|' + b._id + '|' + b.due + '|' + stage;
      if (already(key)) continue;
      const amt = money(b.amount), day = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][at(b.due, '12:00').getDay()];
      const body = b.directDebit ? amt + ' will be taken by direct debit on ' + day + '.' : days > 0 ? amt + ' is due in ' + days + ' days (' + day + ').' : days === 0 ? amt + ' is due today.' : amt + ' was due ' + (-days) + (days === -1 ? ' day' : ' days') + ' ago. Tap ✅ Paid in the app once it is paid.';
      out.push({ device: hash, key, tag: 'bill' + b._id, title: dev.private ? '🧾 Family Screen' : (b.directDebit ? '💳 ' : '🧾 ') + b.biller, body: dev.private ? 'A bill needs attention.' : body });
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
      if (dev.private) { out.push({ device: hash, key, tag: 'job' + t.id, title: '✅ Family Screen', body: 'A booked job needs checking.' }); continue; }
      out.push({ device: hash, key, tag: 'job' + t.id, title: '✅ Did it get done?', body: t.title + (t.who ? ' · ' + nameOf(t.who) : '') + ' — open Family Screen to tick it off or move it.' });
    }
  }
  return out;
}

/* ---------- live flight status (AeroDataBox, free plan = 300 checks a month) ---------- */
const FLIGHT_BUDGET = 280;                 // stop a little short of the free 300
const AIRPORT_INFO = {/*@TZ@*/};           // code: [time zone, city], filled in from the app's airport list
const tzOf = c => (AIRPORT_INFO[c] || [])[0] || 'Pacific/Auckland', cityOf = c => (AIRPORT_INFO[c] || [])[1] || c;
const FINAL = ['Arrived', 'Landed', 'Canceled', 'CanceledUncertain', 'Diverted'];

// How long to wait between checks of one flight (minutes), or null = don't check now.
function checkEvery(f, lv, now, tight) {
  if (!/^[A-Z0-9]{2}\d{1,4}[A-Z]?$/.test(String(f.flight || '').replace(/\s/g, ''))) return null;
  lv = lv || {};
  if (lv.final) return null;
  const dep = lv.dep || Date.parse(f.start), arr = lv.arr || Date.parse(f.end), t = now.getTime();
  if (t < dep - 3 * 36e5 || t > arr + 2 * 36e5) return null;            // only from 3 hrs before take-off to just after landing
  const airborne = lv.status === 'EnRoute' || lv.status === 'Departed' || lv.status === 'Approaching' || !!lv.off;
  let m;
  if (!airborne) m = t < dep ? 115 : 25;                                 // before take-off: about 3 hrs and 1 hr before, then until it's airborne
  else m = arr - t > 70 * 60e3 ? 240 : 50;                                // in the air: every 4 hrs (the app fills in between), then once near landing
  return tight ? m * 2 : m;
}
const adbTime = o => o && o.utc ? Date.parse(String(o.utc).replace(' ', 'T')) : null;
function parseFlight(f, list) {
  if (!Array.isArray(list) || !list.length) return null;
  const x = list.find(y => y.departure && y.departure.airport && y.departure.airport.iata === f.from && (!y.arrival || !y.arrival.airport || y.arrival.airport.iata === f.to))
    || list.find(y => y.departure && y.departure.airport && y.departure.airport.iata === f.from) || null;
  if (!x) return null;
  const d = x.departure || {}, a = x.arrival || {};
  const depS = adbTime(d.scheduledTime), arrS = adbTime(a.scheduledTime);
  const off = adbTime(d.runwayTime) || (/EnRoute|Departed|Approaching|Arrived|Landed/.test(x.status || '') ? adbTime(d.revisedTime) : null);
  const dep = off || adbTime(d.revisedTime) || adbTime(d.predictedTime) || depS;
  const on = adbTime(a.runwayTime) || (/Arrived|Landed/.test(x.status || '') ? adbTime(a.revisedTime) : null);
  const arr = on || adbTime(a.revisedTime) || adbTime(a.predictedTime) || (arrS && dep && depS ? arrS + (dep - depS) : arrS);
  const out = { status: x.status || 'Unknown', depS, arrS, dep, arr, off: off || null, on: on || null,
    gate: d.gate || '', final: FINAL.indexOf(x.status) >= 0 };
  if (x.location && x.location.lat != null) out.pos = { lat: x.location.lat, lon: x.location.lon, alt: (x.location.altitude || {}).feet || 0, kt: (x.location.groundSpeed || {}).kt || 0, trk: (x.location.trueTrack || {}).deg || 0, at: Date.parse(String(x.location.reportedAtUtc || '').replace(' ', 'T')) || Date.now() };
  return out;
}
// Delay / cancellation messages when the status moves on (pure logic, no network)
function flightAlerts(h, f, prev, cur) {
  const out = [], people = h.people || [], who = ((people.find(p => p.id === f.who) || {}).nick) || ((people.find(p => p.id === f.who) || {}).name) || '';
  const route = cityOf(f.from) + '→' + cityOf(f.to), name = (f.flight || '') + ' ' + route;
  const late = cur.arr && cur.arrS ? Math.round((cur.arr - cur.arrS) / 60e3) : cur.dep && cur.depS ? Math.round((cur.dep - cur.depS) / 60e3) : 0;
  cur.told = prev.told || 0; cur.toldStatus = prev.toldStatus || '';
  if (/Canceled/.test(cur.status) && cur.toldStatus !== 'Canceled') {
    cur.toldStatus = 'Canceled';
    out.push({ tag: 'fl' + f.id, title: '❌ ' + (who ? who + "'s flight " : 'Flight ') + name + ' is cancelled', body: 'The airline has cancelled it. Check with ' + (who || 'the crew') + ' for the new plan.', who: f.who });
  } else if (cur.status === 'Diverted' && cur.toldStatus !== 'Diverted') {
    cur.toldStatus = 'Diverted';
    out.push({ tag: 'fl' + f.id, title: '↪️ ' + name + ' has been diverted', body: (who ? who + "'s" : 'The') + ' flight is landing somewhere other than ' + cityOf(f.to) + '.', who: f.who });
  } else if (!cur.final || cur.status === 'Landed' || cur.status === 'Arrived') {
    const step = Math.abs(late - cur.told);
    if (Math.abs(late) >= 15 && step >= 15 && !cur.on) {
      const tz = tzOf(f.to), when = Utilities.formatDate(new Date(cur.arr), tz, 'h:mma').toLowerCase();
      const nz = tz === 'Pacific/Auckland' ? '' : ' (' + Utilities.formatDate(new Date(cur.arr), 'Pacific/Auckland', 'h:mma').toLowerCase() + ' NZ)';
      out.push({ tag: 'fl' + f.id, title: (late > 0 ? '⏰ ' : '⏩ ') + name + ' running ' + Math.abs(late) + ' min ' + (late > 0 ? 'late' : 'early'),
        body: (who ? who + ' now lands ' : 'Now lands ') + cityOf(f.to) + ' about ' + when + nz + '.', who: f.who });
      cur.told = late;
    } else if (Math.abs(cur.told) >= 15 && Math.abs(late) < 10 && !cur.on) {
      out.push({ tag: 'fl' + f.id, title: '✅ ' + name + ' is back on time', body: (who ? who + "'s" : 'The') + ' flight has caught up.', who: f.who });
      cur.told = 0;
    }
  }
  return out;
}
function trackFlights(h, flights, now, props, msgs) {
  const key = props.getProperty('AERODATABOX_KEY'); if (!key) return;
  const mk = 'adb|' + keyOf(now).slice(0, 7);
  const live = Object.assign({}, h.live || {}); let changed = false;
  // forget flights that are long over or no longer on the calendar
  Object.keys(live).forEach(id => { const f = flights.find(x => x.id === id); if (!f || now.getTime() - (live[id].arr || Date.parse(f.end)) > 2 * 864e5) { delete live[id]; changed = true; } });
  for (const f of flights.sort((a, b) => Date.parse(a.start) - Date.parse(b.start))) {
    let used = +(props.getProperty(mk) || 0); if (used >= FLIGHT_BUDGET) break;
    const prev = live[f.id] || {}, every = checkEvery(f, prev, now, used > FLIGHT_BUDGET * 0.7);
    if (every == null || (prev.checked && now.getTime() - prev.checked < every * 60e3 - 30e3)) continue;
    const day = Utilities.formatDate(new Date(f.start), tzOf(f.from), 'yyyy-MM-dd');
    const r = UrlFetchApp.fetch('https://aerodatabox.p.rapidapi.com/flights/number/' + encodeURIComponent(String(f.flight).replace(/\s/g, '')) + '/' + day + '?withAircraftImage=false&withLocation=true&dateLocalRole=Departure',
      { headers: { 'X-RapidAPI-Key': key, 'X-RapidAPI-Host': 'aerodatabox.p.rapidapi.com' }, muteHttpExceptions: true });
    props.setProperty(mk, String(++used));
    const code = r.getResponseCode();
    if (code === 401 || code === 403) throw new Error('AeroDataBox did not accept the key (' + code + '). Check AERODATABOX_KEY.');
    if (code === 429) throw new Error('AeroDataBox says the monthly allowance is used up.');
    let cur = code === 200 ? parseFlight(f, JSON.parse(r.getContentText() || '[]')) : null;
    if (!cur) { live[f.id] = Object.assign({}, prev, { checked: now.getTime(), status: prev.status || 'NoData' }); changed = true; continue; }
    cur.flight = f.flight; cur.checked = now.getTime();
    if (!cur.pos && prev.pos && !cur.on) cur.pos = prev.pos;                       // keep the last radar fix
    if (cur.pos && prev.pos && cur.pos.at > prev.pos.at + 60e3) cur.prev = { lat: prev.pos.lat, lon: prev.pos.lon, at: prev.pos.at };
    else if (prev.prev) cur.prev = prev.prev;
    for (const a of flightAlerts(h, f, prev, cur)) for (const hash of Object.keys(h.devices || {})) {
      const dev = h.devices[hash]; if (!dev || !dev.token || dev.flights === false) continue;
      if (dev.people && dev.people.length && dev.people.indexOf(a.who) < 0) continue;
      msgs.push({ device: hash, key: 'f|' + hash + '|' + f.id + '|' + cur.told + '|' + cur.toldStatus + '|' + now.getTime(), tag: a.tag,
        title: dev.private ? '✈️ Family Screen' : a.title, body: dev.private ? 'A flight time has changed.' : a.body });
    }
    live[f.id] = cur; changed = true;
  }
  if (changed) { patch('households/' + h._id, { live: live }); h.live = live; }
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
/* ================= Bills by email =================
   Bills sent (or forwarded) to the family's bills address (a plus address of THIS Gmail account, e.g. you+bills@gmail.com,
   set in the app: Bills → Setup) are read every 10 minutes. Gemini reads the email and any PDF, the PDF is saved to
   Google Drive (“Household Bills/_To file”), and the bill appears in the app as “check it”. When you confirm it there,
   the app says which folder it goes in and this moves and renames the file. A Google Sheet register is kept up to date. */
const BILL_CATS = ['Power', 'Gas', 'Internet', 'Phone', 'Water', 'Rates', 'Insurance', 'Car', 'Mortgage', 'Rent', 'Subscriptions', 'Medical', 'School', 'Childcare', 'Credit card', 'Other'];
const money = c => '$' + (Number(c || 0) / 100).toFixed(2);
const normB = x => String(x || '').toLowerCase().replace(/[^a-z0-9]/g, '');
function getDoc(path) {
  const r = UrlFetchApp.fetch(BASE + '/' + path, { headers: headers(), muteHttpExceptions: true });
  if (r.getResponseCode() === 404) return null;
  if (r.getResponseCode() !== 200) throw new Error('Reading ' + path + ': ' + r.getResponseCode());
  const d = JSON.parse(r.getContentText()); const o = dec({ mapValue: { fields: d.fields || {} } }); o._id = d.name.split('/').pop(); return o;
}
function geminiKey(h) { const s = getDoc('households/' + h._id + '/secrets/ai'); return (s && s.gemini) || PropertiesService.getScriptProperties().getProperty('GEMINI_KEY') || ''; }
function gemini(key, parts, quick) {
  const props = PropertiesService.getScriptProperties();
  const call = (m, think) => {
    const gc = { responseMimeType: 'application/json' };
    if (think) gc.thinkingConfig = { thinkingLevel: 'low' };     // voice answers need to come back inside Alexa's few seconds
    return UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models/' + m + ':generateContent', { method: 'post', contentType: 'application/json', headers: { 'x-goog-api-key': key }, muteHttpExceptions: true,
      payload: JSON.stringify({ contents: [{ role: 'user', parts: parts }], generationConfig: gc }) });
  };
  let model = props.getProperty('GEMINI_MODEL') || 'gemini-3.6-flash', r = call(model, quick);
  if (quick && r.getResponseCode() === 400 && /think/i.test(r.getContentText())) r = call(model, false);
  if (r.getResponseCode() === 404) {   // that model was retired: use the newest Flash this key can use
    const list = JSON.parse(UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', { headers: { 'x-goog-api-key': key }, muteHttpExceptions: true }).getContentText()).models || [];
    const ok = list.filter(m => (m.supportedGenerationMethods || []).indexOf('generateContent') >= 0 && /gemini-[\d.]+-flash$/.test(m.name)).map(m => m.name.replace('models/', '')).sort((a, b) => parseFloat(b.split('-')[1]) - parseFloat(a.split('-')[1]));
    if (ok.length) { model = ok[0]; props.setProperty('GEMINI_MODEL', model); r = call(model, quick); if (quick && r.getResponseCode() === 400 && /think/i.test(r.getContentText())) r = call(model, false); }
  }
  if (r.getResponseCode() !== 200) { const e = new Error('Gemini ' + r.getResponseCode() + ': ' + r.getContentText().slice(0, 160)); e.gemini = true; throw e; }
  const j = JSON.parse(r.getContentText());
  return ((((j.candidates || [])[0] || {}).content || {}).parts || []).map(p => p.text || '').join('');
}
// Drive folders: paths are relative to the bills folder (“Power/Mercury/2026”); a leading “/” means from the top of My Drive
function billsRoot(h) { return folderPath(DriveApp.getRootFolder(), String(h.billsRoot || 'Household Bills')); }
function folderPath(start, path) {
  let f = start;
  for (const part of String(path).split('/').map(x => x.trim()).filter(Boolean)) { const it = f.getFoldersByName(part); f = it.hasNext() ? it.next() : f.createFolder(part); }
  return f;
}
function listFolders(f, prefix, depth, out) {
  if (out.length > 400) return; const it = f.getFolders();
  while (it.hasNext() && out.length <= 400) { const c = it.next(), n = c.getName(); if (n === '_To file') continue; const p = prefix + n; out.push(p); if (depth > 1) listFolders(c, p + '/', depth - 1, out); }
}
function billFileName(b) { return (b.due || b.date || '') + ' ' + String(b.biller || 'Bill').replace(/[\\/:*?"<>|]/g, '') + (b.amount ? ' ' + money(b.amount) : ''); }
function billsTick(h, props, now, force) {
  const addr = String(h.billEmail || '').toLowerCase().trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)) return [];
  const path = 'households/' + h._id + '/bills', prev = h.billsHelper || {};
  let bills = listDocs(path), err = '', added = 0; const fresh = [];
  try {
    const root = billsRoot(h), today = keyOf(now);
    // 1) file the ones you've confirmed into the folder you chose (creating folders as needed), and rename them
    for (const b of bills) {
      if (!b.fileTo || !b.pdf || !b.pdf.driveId || b.pdf.folder === b.fileTo) continue;
      const file = DriveApp.getFileById(b.pdf.driveId), dest = String(b.fileTo).charAt(0) === '/' ? folderPath(DriveApp.getRootFolder(), b.fileTo) : folderPath(root, b.fileTo);
      file.moveTo(dest); const ext = (file.getName().match(/\.[a-z0-9]+$/i) || ['.pdf'])[0]; file.setName(billFileName(b) + ext);
      b.pdf = { driveId: b.pdf.driveId, link: file.getUrl(), name: file.getName(), folder: b.fileTo };
      patch(path + '/' + b._id, { pdf: b.pdf, filedAt: now.getTime() }); props.deleteProperty('BILL_FOLDERS_AT');
    }
    // 2) direct debits come out on the day: mark them paid the day after
    for (const b of bills) if (b.status === 'due' && b.directDebit && b.due && b.due < today) { b.status = 'paid'; b.paidAt = at(b.due, '12:00').getTime(); b.paidHow = 'Direct debit'; b.paidBy = 'auto'; patch(path + '/' + b._id, { status: 'paid', paidAt: b.paidAt, paidHow: b.paidHow, paidBy: 'auto' }); }
    // 3) new emails, every 10 minutes
    const lastKey = 'BILL_MAIL_' + h._id;
    if (force || now.getTime() - Number(props.getProperty(lastKey) || 0) > 9.5 * 60e3) {
      props.setProperty(lastKey, String(now.getTime()));
      const seen = {}; bills.forEach(b => seen[b._id] = 1);
      const key = geminiKey(h);
      const threads = GmailApp.search('to:' + addr + ' newer_than:30d', 0, 20);
      if (threads.length && !key) throw new Error('No Gemini key yet: add it in the app (⚙️ → ✨ AI)');
      const inbox = folderPath(root, '_To file'), known = Object.keys(bills.reduce((o, b) => { if (b.biller) o[b.biller] = 1; return o; }, {})).slice(0, 60);
      const label = GmailApp.getUserLabelByName('Family Screen bills') || GmailApp.createLabel('Family Screen bills');
      for (const t of threads) {
        for (const msg of t.getMessages()) {
          const id = 'email-' + msg.getId(); if (seen[id]) continue;
          if ((msg.getTo() + ' ' + msg.getCc()).toLowerCase().indexOf(addr) < 0 && t.getMessages().length > 1) continue;
          const atts = msg.getAttachments({ includeInlineImages: false }).filter(a => /pdf|image\//i.test(a.getContentType()) && a.getSize() < 5e6).slice(0, 3);
          let text = String(msg.getPlainBody() || '').replace(/\n>.*$/gm, ''); if (text.trim().length < 40) text = String(msg.getBody() || '').replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
          const prompt = 'You read an email sent to a New Zealand household\'s bills address, and any bill attached to it. Return JSON only: ' +
            '{"is_bill":true,"biller":"company name, short (e.g. Mercury, Watercare, Auckland Council)","category":"one of ' + BILL_CATS.join(', ') + '","amount_cents":0,"due":"YYYY-MM-DD or empty","reference":"customer or account number as printed","period":"billing period, short","direct_debit":false,"min_due_cents":0,"summary":"one short line"}. ' +
            'Today is ' + today + ' (Pacific/Auckland). amount_cents is the amount to pay by the due date (not a previous balance, a credit or a usage figure), in cents. ' +
            'direct_debit is true only if it says the amount will be taken automatically by direct debit. If it is a receipt, a payment confirmation, a newsletter or a statement with nothing to pay, is_bill is false. ' +
            'Never guess: leave a field empty or 0 if it is not shown. Billers we already have: ' + JSON.stringify(known) + ' (use the same name if it is one of these).\n\n' +
            'From: ' + msg.getFrom() + '\nSubject: ' + msg.getSubject() + '\nDate: ' + msg.getDate() + '\n\n' + text.slice(0, 8000);
          const parts = [{ text: prompt }].concat(atts.map(a => ({ inline_data: { mime_type: a.getContentType().split(';')[0], data: Utilities.base64Encode(a.getBytes()) } })));
          let d; try { d = JSON.parse(gemini(key, parts) || '{}'); } catch (e) { if (e.gemini) throw e; d = { is_bill: true, summary: 'Couldn\'t read this one: open the email.' }; }
          const fromEmail = { from: String(msg.getFrom()).slice(0, 160), subject: String(msg.getSubject() || '').slice(0, 160), at: msg.getDate().getTime(), link: 'https://mail.google.com/mail/u/0/#all/' + msg.getId() };
          if (d.is_bill === false) { patch(path + '/' + id, { status: 'notbill', at: msg.getDate().getTime(), fromEmail: fromEmail, summary: String(d.summary || '').slice(0, 200) }); seen[id] = 1; continue; }
          const amount = Math.max(0, Math.round(Number(d.amount_cents) || 0)), dd = /^\d{4}-\d{2}-\d{2}$/.test(d.due || '') ? d.due : '';
          const okDue = dd && Math.abs((at(dd, '12:00') - now) / 864e5) < 150 ? dd : '';
          const ref = String(d.reference || '').replace(/\s/g, ''), refM = ref ? '•••• ' + ref.slice(-4) : '';
          const biller = String(d.biller || msg.getFrom().replace(/<.*>/, '').replace(/"/g, '').trim() || 'Bill').slice(0, 60);
          const bill = { status: 'check', by: 'email', biller: biller, category: BILL_CATS.indexOf(d.category) >= 0 ? d.category : 'Other', amount: amount, due: okDue, reference: refM, period: String(d.period || '').slice(0, 60),
            directDebit: !!d.direct_debit, minDue: Math.max(0, Math.round(Number(d.min_due_cents) || 0)), summary: String(d.summary || '').slice(0, 200), at: msg.getDate().getTime(), date: keyOf(msg.getDate()), fromEmail: fromEmail };
          // the same bill sent again (a reminder): keep a note, don't add it twice
          const dup = bills.find(b => b.status !== 'notbill' && b.status !== 'dup' && normB(b.biller) === normB(bill.biller) && b.amount === bill.amount && b.due === bill.due && bill.amount);
          if (dup) { patch(path + '/' + id, { status: 'dup', dupOf: dup._id, at: bill.at, fromEmail: fromEmail }); seen[id] = 1; continue; }
          // keep a copy in Drive: the attached bill, or the email itself as a PDF
          const blob = atts.length ? atts[0].copyBlob() : Utilities.newBlob('<h2>' + fromEmail.subject + '</h2><p>' + fromEmail.from + ' · ' + msg.getDate() + '</p>' + msg.getBody(), 'text/html', 'bill.html').getAs('application/pdf');
          const ext = atts.length ? ((atts[0].getName().match(/\.[a-z0-9]+$/i) || ['.pdf'])[0]) : '.pdf';
          const file = inbox.createFile(blob).setName(billFileName(bill) + ext);
          bill.pdf = { driveId: file.getId(), link: file.getUrl(), name: file.getName(), folder: '_To file' };
          patch(path + '/' + id, bill); bill._id = id; bills.push(bill); fresh.push(bill); seen[id] = 1; added++;
        }
        t.addLabel(label);
      }
    }
    // 4) the folder list the app offers (refreshed hourly or after filing)
    if (!props.getProperty('BILL_FOLDERS_AT') || now.getTime() - Number(props.getProperty('BILL_FOLDERS_AT')) > 60 * 60e3) {
      const inRoot = [], top = []; listFolders(root, '', 3, inRoot); listFolders(DriveApp.getRootFolder(), '/', 2, top);
      patch('households/' + h._id, { billFolders: inRoot.concat(top.filter(p => p !== '/' + root.getName() && p.indexOf('/' + root.getName() + '/') !== 0)).slice(0, 500), billsRootName: root.getName() });
      props.setProperty('BILL_FOLDERS_AT', String(now.getTime()));
    }
    // 5) the register in Google Sheets
    const live = bills.filter(b => ['check', 'due', 'paid'].indexOf(b.status) >= 0).sort((a, b) => String(b.due || b.date).localeCompare(String(a.due || a.date)));
    const sig = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, JSON.stringify(live.map(b => [b._id, b.status, b.biller, b.amount, b.due, b.paidAt, b.paidHow, b.category, b.pdf && b.pdf.link, b.directDebit]))));
    if (sig !== props.getProperty('BILL_SHEET_SIG_' + h._id)) { const url = writeRegister(h, root, live, props); props.setProperty('BILL_SHEET_SIG_' + h._id, sig); if (url !== h.billSheet) patch('households/' + h._id, { billSheet: url }); }
  } catch (e) { err = String(e && e.message || e).slice(0, 240); if (/permission|authori[sz]/i.test(err)) err = 'The helper needs permission for Gmail, Drive and Sheets: update appsscript.json and run billsCheckNow once (⚙️ → 🧰 Helpers). ' + err; }
  patch('households/' + h._id, { billsHelper: { lastRun: now.getTime(), error: err, added: (prev.added || 0) + added, version: HELPER_VERSION } });
  bills.forEach(b => { if (fresh.indexOf(b) >= 0) b._new = true; });
  return bills;
}
function writeRegister(h, root, live, props) {
  const idKey = 'BILL_SHEET_' + h._id; let ss = null;
  try { const id = props.getProperty(idKey); if (id) ss = SpreadsheetApp.openById(id); } catch (e) { ss = null; }
  if (!ss) { ss = SpreadsheetApp.create('Household Bills Register'); DriveApp.getFileById(ss.getId()).moveTo(root); props.setProperty(idKey, ss.getId()); }
  const fmtD = k => k ? k.split('-').reverse().join('/') : '';
  const rows = [['Due', 'Biller', 'Category', 'Period', 'Amount', 'Direct debit', 'Status', 'Paid on', 'Paid how', 'Reference', 'Received', 'File']].concat(live.map(b => [
    fmtD(b.due), b.biller || '', b.category || '', b.period || '', (b.amount || 0) / 100, b.directDebit ? 'Yes' : '', b.status === 'check' ? 'To check' : b.status === 'due' ? 'To pay' : 'Paid',
    b.paidAt ? fmtD(keyOf(new Date(b.paidAt))) : '', b.paidHow || '', b.reference || '', b.date ? fmtD(b.date) : '', b.pdf && b.pdf.link ? '=HYPERLINK("' + b.pdf.link + '","Open")' : '']));
  const sh = ss.getSheets()[0]; sh.setName('Bills'); sh.clear(); sh.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
  sh.getRange(1, 1, 1, rows[0].length).setFontWeight('bold').setBackground('#fff1c9'); sh.setFrozenRows(1); if (rows.length > 1) sh.getRange(2, 5, rows.length - 1, 1).setNumberFormat('$#,##0.00');
  // by month: what each category cost, from the due dates
  const months = {}, cats = {};
  live.filter(b => b.status !== 'check' && b.due).forEach(b => { const m = b.due.slice(0, 7); months[m] = months[m] || {}; months[m][b.category || 'Other'] = (months[m][b.category || 'Other'] || 0) + (b.amount || 0); cats[b.category || 'Other'] = 1; });
  const cl = Object.keys(cats).sort(), ml = Object.keys(months).sort().reverse();
  const sum = [['Month'].concat(cl).concat(['Total'])].concat(ml.map(m => [m].concat(cl.map(c => (months[m][c] || 0) / 100)).concat([cl.reduce((t, c) => t + (months[m][c] || 0), 0) / 100])));
  const s2 = ss.getSheetByName('By month') || ss.insertSheet('By month'); s2.clear(); s2.getRange(1, 1, sum.length, sum[0].length).setValues(sum);
  s2.getRange(1, 1, 1, sum[0].length).setFontWeight('bold').setBackground('#fff1c9'); s2.setFrozenRows(1); if (sum.length > 1) s2.getRange(2, 2, sum.length - 1, sum[0].length - 1).setNumberFormat('$#,##0.00');
  return ss.getUrl();
}
// a new bill to check: tell everyone's phone once
function billArrivals(h, bills, msgs, already) {
  for (const b of bills || []) { if (!b._new) continue;
    for (const hash of Object.keys(h.devices || {})) { const dev = h.devices[hash]; if (!dev || !dev.token || dev.remind === false) continue;
      const key = 'bn|' + hash + '|' + b._id; if (already(key)) continue;
      msgs.push({ device: hash, key, tag: 'bill' + b._id, title: dev.private ? '🧾 Family Screen' : '🧾 New bill to check: ' + b.biller, body: dev.private ? 'A new bill arrived.' : (b.amount ? money(b.amount) : 'Amount unknown') + (b.due ? ' · due ' + b.due.split('-').reverse().slice(0, 2).join('/') : '') + (b.directDebit ? ' · direct debit' : '') }); } }
}
// run this once by hand from the script editor: it asks for the Gmail, Drive and Sheets permissions, then checks the bills inbox straight away
/* ================= Voice (Alexa) =================
   The Alexa skill posts here with the family's voice key (Helpers → 🔊 Alexa in the app). Everything it says or
   changes goes through this one door: nothing else is exposed, and the key can be changed in the app at any time. */
function doPost(e) {
  const out = o => ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
  let b; try { b = JSON.parse(e.postData.contents); } catch (x) { return out({ error: 'bad request' }); }
  const key = String(b.key || ''); if (key.length < 12) return out({ error: 'not allowed' });
  const h = listDocs('households').filter(x => String(x.voiceKey || '') === key)[0];
  if (!h) return out({ error: 'not allowed' });
  try { return out(voiceDo(h, String(b.action || ''), b)); }
  catch (err) { return out({ speech: 'Sorry, something went wrong at my end. ' + String(err && err.message || err).slice(0, 80) }); }
}
const VOICE_MAX = 55;                                     // keep spoken answers short
function vPeople(h) { return (h.people || []).filter(p => p.id !== 'all'); }
function vFind(h, name) {
  const n = normB(name); if (!n) return null;
  return vPeople(h).filter(p => normB(p.name) === n)[0] || vPeople(h).filter(p => normB(p.name).indexOf(n) === 0 || n.indexOf(normB(p.name)) === 0)[0] || null;
}
// Alexa tells us which voice profile is speaking (if the family set them up). We remember which profile is which
// person the first time they say who they are, so "my jobs" means the right person's jobs afterwards.
function vMe(h, b) {
  const id = String(b.person_id || ''); if (!id) return null;
  const map = h.voiceIds || {}; const pid = map[id]; if (!pid) return null;
  return vPeople(h).filter(function (p) { return p.id === pid; })[0] || null;
}
function vList(a) { a = a.filter(Boolean); return a.length < 2 ? (a[0] || '') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]; }
function vDay(key, now) {
  const t = keyOf(now); if (key === t) return 'today'; if (key === keyOf(addDays(now, 1))) return 'tomorrow'; if (key === keyOf(addDays(now, -1))) return 'yesterday';
  const d = kd(key), days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const diff = Math.round((d - kd(t)) / 864e5);
  const n = d.getDate(), sfx = (n % 10 === 1 && n !== 11) ? 'st' : (n % 10 === 2 && n !== 12) ? 'nd' : (n % 10 === 3 && n !== 13) ? 'rd' : 'th';
  return days[d.getDay()] + (diff > 0 && diff < 7 ? '' : ' the ' + n + sfx + ' of ' + months[d.getMonth()]);
}
function vDate(raw, now) {                                 // Alexa sends 2026-11-13, 2026-W47, 2026-11, or nothing
  const s = String(raw || '').trim(); if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return keyOf(now);
}
const vWeek = function (raw) { return /^\d{4}-(W\d{2}(-WE)?|\d{2})$/.test(String(raw || '').trim()); };   // "this week", "next week", "in November"
function vEventsOn(h, key) {
  const evs = listDocs('households/' + h._id + '/events').filter(e => !e.priv && occursOn(e, key));
  return evs.sort(function (a, c) { return String(a.time || '00:00').localeCompare(String(c.time || '00:00')); });
}
function vSay(e, h) {
  const who = (e.whos || []).filter(function (w) { return w !== 'all'; }).map(function (w) { const p = vPeople(h).filter(function (x) { return x.id === w; })[0]; return p ? p.name : ''; }).filter(Boolean);
  return (e.time ? fmt12(e.time) + ', ' : '') + e.title + (who.length ? ' for ' + vList(who) : '');
}
function voiceDo(h, action, b) {
  const now = new Date(), hid = h._id, today = keyOf(now);
  const newId = function () { return 'v' + now.getTime().toString(36) + Math.random().toString(36).slice(2, 7); };
  if (action === 'ping') return { ok: true, version: HELPER_VERSION, people: vPeople(h).map(function (p) { return p.name; }) };

  if (action === 'shop_add') {
    const item = String(b.item || '').trim(); if (!item) return { speech: 'What should I add?', ask: 'item' };
    const shops = h.shops || [], sup = shops.filter(function (s) { return s.aisles; })[0] || shops[0] || { id: 'super' };
    const name = item.charAt(0).toUpperCase() + item.slice(1);
    patch('households/' + hid + '/groceries/' + newId(), { name: name, shop: sup.id, aisle: '', done: false, voice: true, at: now.getTime() });
    return { speech: 'Added ' + item + ' to the shopping list.' };
  }
  if (action === 'shop_list') {
    const g = listDocs('households/' + hid + '/groceries').filter(function (x) { return !x.done; });
    if (!g.length) return { speech: 'The shopping list is empty.' };
    const names = g.slice(0, 12).map(function (x) { return String(x.name).replace(/\s*\(.*\)$/, ''); });
    return { speech: g.length + ' thing' + (g.length === 1 ? '' : 's') + ' on the list: ' + vList(names) + (g.length > 12 ? ', and ' + (g.length - 12) + ' more' : '') + '.' };
  }
  if (action === 'job_add') {
    const task = String(b.task || '').trim(); if (!task) return { speech: 'What is the job?', ask: 'task' };
    const p = /^(me|myself|i)$/i.test(String(b.person || '').trim()) ? vMe(h, b) : (vFind(h, b.person) || (b.person ? null : vMe(h, b)) || null);
    if (!p && vPeople(h).length > 1 && !b.force) return { speech: 'Who is that job for? ' + vList(vPeople(h).map(function (x) { return x.name; })) + '?', ask: 'person' };
    patch('households/' + hid + '/todos/' + newId(), { title: task.charAt(0).toUpperCase() + task.slice(1), who: p ? p.id : '', done: false, at: now.getTime(), voice: true });
    return { speech: 'Added ' + task + (p ? ' to ' + p.name + "'s jobs" : ' to the jobs list') + '.' };
  }
  if (action === 'identify') {
    const p = vFind(h, b.person);
    if (!p) return { speech: 'I did not catch that name. Who is this? ' + vList(vPeople(h).map(function (x) { return x.name; })) + '?', ask: 'person' };
    if (!b.person_id) return { speech: 'Thanks ' + p.name + ', but this Echo cannot tell voices apart yet. Set up a voice profile in the Alexa app and tell me again.' };
    const map = h.voiceIds || {}; map[b.person_id] = p.id; patch('households/' + hid, { voiceIds: map });
    return { speech: "Got it. I'll know your voice as " + p.name + ' from now on.' };
  }
  if (action === 'jars') {
    const mine = vMe(h, b), p = b.me ? mine : (vFind(h, b.person) || mine);
    if (b.me && !mine) return { speech: 'I am not sure whose voice this is. Say, I am ' + vPeople(h)[0].name + ', and I will remember.', ask: 'person' };
    let jars = listDocs('households/' + hid + '/kids').filter(function (x) { return x.kind === 'jar'; });
    if (p) jars = jars.filter(function (x) { return x.person === p.id; });
    if (!jars.length) return { speech: p ? p.name + ' has no savings jars yet.' : 'There are no savings jars yet.' };
    const tot = function (j) { return (j.log || []).reduce(function (t, x) { return t + (x.amt || 0); }, 0); };
    const bits = jars.slice(0, 4).map(function (j) {
      const t = tot(j), who = p ? '' : (vPeople(h).filter(function (x) { return x.id === j.person; })[0] || {}).name + "'s ";
      return who + j.name + ', ' + money(t) + (j.target ? ' of ' + money(j.target) + ', ' + Math.min(100, Math.round(t / j.target * 100)) + ' per cent' : '');
    });
    return { speech: (p ? p.name + ': ' : '') + vList(bits) + '.' };
  }
  if (action === 'jobs') {
    const mine = vMe(h, b);
    if (b.me && !mine) return { speech: 'I am not sure whose voice this is. Say, I am ' + vPeople(h)[0].name + ', and I will remember.', ask: 'person' };
    const p = b.me ? mine : vFind(h, b.person), lost = !b.me && b.person && !p ? "I'm not sure who " + b.person + ' is, so here are all of them. ' : '';
    let t = listDocs('households/' + hid + '/todos').filter(function (x) { return !x.done && !x.priv; });
    if (p) t = t.filter(function (x) { return x.who === p.id; });
    if (!t.length) return { speech: lost + (p ? p.name + ' has no jobs waiting. Nice.' : 'There are no jobs waiting. Nice.') };
    return { speech: lost + (p ? p.name + ' has ' : 'There are ') + t.length + ' job' + (t.length === 1 ? '' : 's') + ': ' + vList(t.slice(0, 8).map(function (x) { return x.title; })) + '.' };
  }
  if (action === 'event_add') {
    const title = String(b.title || '').trim(); if (!title) return { speech: 'What should I put in the calendar?', ask: 'title' };
    const key = vDate(b.date, now), time = /^\d{2}:\d{2}/.test(String(b.time || '')) ? String(b.time).slice(0, 5) : '';
    const p = vFind(h, b.person);
    patch('households/' + hid + '/events/' + newId(), { title: title.charAt(0).toUpperCase() + title.slice(1), date: key, time: time, dur: time ? 60 : 0, whos: p ? [p.id] : [], voice: true, at: now.getTime() });
    return { speech: 'Put ' + title + ' in the calendar for ' + vDay(key, now) + (time ? ' at ' + fmt12(time) : '') + (p ? ', for ' + p.name : '') + '.' };
  }
  if (action === 'agenda') {
    if (vWeek(b.date)) {                                   // "what's on this week"
      const lines = [];
      for (let i = 0; i < 7; i++) { const k = keyOf(addDays(now, i)), e = vEventsOn(h, k); if (e.length) lines.push(vDay(k, now) + ', ' + vList(e.slice(0, 3).map(function (x) { return vSay(x, h); }))); }
      return { speech: lines.length ? 'This week: ' + lines.join('. ') + '.' : 'Nothing in the calendar for the next week.' };
    }
    const key = vDate(b.date, now), evs = vEventsOn(h, key);
    if (!evs.length) return { speech: 'Nothing in the calendar for ' + vDay(key, now) + '.' };
    return { speech: vDay(key, now).charAt(0).toUpperCase() + vDay(key, now).slice(1) + ': ' + vList(evs.slice(0, 6).map(function (e) { return vSay(e, h); })) + '.' };
  }
  if (action === 'where') {
    const tp = vPeople(h).filter(function (p) { return p.traveller; })[0];
    const asked = vFind(h, b.person);
    if (asked && tp && asked.id !== tp.id) return { speech: 'Only ' + tp.name + "'s flights are tracked, so I can't say where " + asked.name + ' is.' };
    const nm = tp ? tp.name : 'She';
    const fl = listDocs('households/' + hid + '/flights').filter(function (f) { return !tp || f.who === tp.id; });
    const live = h.live || {};
    const lv = function (f) { const l = live[f.id]; return l && !/ancel/i.test(l.status || '') ? l : null; };
    const ms = function (f) { const l = lv(f); return Date.parse((l && l.dep) || f.start); };
    const me2 = function (f) { const l = lv(f); return Date.parse((l && l.arr) || f.end); };
    fl.sort(function (a, c) { return ms(a) - ms(c); });
    const flying = fl.filter(function (f) { return ms(f) <= now.getTime() && me2(f) >= now.getTime(); })[0];
    const next = fl.filter(function (f) { return ms(f) > now.getTime(); })[0];
    const last = fl.filter(function (f) { return me2(f) < now.getTime(); }).pop();
    const home = fl.filter(function (f) { return me2(f) > now.getTime() && ['AKL', 'WLG', 'CHC', 'ZQN'].indexOf(f.to) >= 0; })[0];
    let sp;
    if (flying) sp = nm + ' is in the air, ' + cityOf(flying.from) + ' to ' + cityOf(flying.to) + ', landing ' + vDay(keyOf(new Date(me2(flying))), now) + ' at ' + fmtTime(new Date(me2(flying))) + '.';
    else if (last && ['AKL', 'WLG', 'CHC', 'ZQN'].indexOf(last.to) < 0) sp = nm + ' is away in ' + cityOf(last.to) + '.';
    else if (next) sp = nm + ' is home. Next flight leaves ' + vDay(keyOf(new Date(ms(next))), now) + ' at ' + fmtTime(new Date(ms(next))) + '.';
    else sp = nm + ' is home, and there are no more flights loaded.';
    if (home && !flying && home !== next) sp += ' Back home ' + vDay(keyOf(new Date(me2(home))), now) + ' at ' + fmtTime(new Date(me2(home))) + '.';
    else if (home && flying) sp += home === flying ? '' : ' Back home ' + vDay(keyOf(new Date(me2(home))), now) + '.';
    return { speech: sp };
  }
  if (action === 'bills') {
    const bl = listDocs('households/' + hid + '/bills').filter(function (x) { return x.status === 'due'; }).sort(function (a, c) { return String(a.due).localeCompare(String(c.due)); });
    const chk = listDocs('households/' + hid + '/bills').filter(function (x) { return x.status === 'check'; }).length;
    if (!bl.length) return { speech: 'No bills waiting to be paid.' + (chk ? ' ' + chk + ' new one' + (chk === 1 ? '' : 's') + ' to check in the app.' : '') };
    const tot = bl.reduce(function (t, x) { return t + (x.amount || 0); }, 0);
    return { speech: bl.length + ' bill' + (bl.length === 1 ? '' : 's') + ' to pay, ' + money(tot) + ' in total: ' + vList(bl.slice(0, 5).map(function (x) { return x.biller + ', ' + money(x.amount) + ', due ' + vDay(x.due, now) + (x.directDebit ? ', by direct debit' : ''); })) + '.' };
  }
  if (action === 'renewals') {
    const r = listDocs('households/' + hid + '/renewals').filter(function (x) { return x.due && Math.round((kd(x.due) - kd(today)) / 864e5) <= 45; }).sort(function (a, c) { return String(a.due).localeCompare(String(c.due)); });
    if (!r.length) return { speech: 'Nothing coming up in the next six weeks.' };
    return { speech: vList(r.slice(0, 5).map(function (x) { return x.what + (x.item ? ' for the ' + x.item : '') + ', ' + vDay(x.due, now); })) + '.' };
  }
  if (action === 'meal') {
    const key = vDate(b.date, now), ms2 = listDocs('households/' + hid + '/meals').filter(function (m) { return m.date === key; });
    const dinner = ms2.filter(function (m) { return m.slot === 'dinner'; });
    if (!dinner.length) return { speech: 'Nothing planned for dinner ' + vDay(key, now) + '.' };
    const names = dinner.map(function (m) { if (m.note) return m.note; const r = getDoc('households/' + hid + '/recipes/' + m.rid); return r ? r.name : 'something'; });
    return { speech: 'Dinner ' + vDay(key, now) + ': ' + vList(names) + '.' };
  }
  if (action === 'remember') {
    const text = String(b.text || '').trim(); if (!text) return { speech: 'What should I remember?', ask: 'text' };
    patch('households/' + hid + '/memory/' + newId(), { text: text, title: '', at: now.getTime(), src: 'voice' });
    return { speech: "I'll remember that." };
  }
  if (action === 'ask') {
    const q = String(b.q || '').trim(); if (!q) return { speech: 'What would you like to know?', ask: 'q' };
    const gk = geminiKey(h); if (!gk) return { speech: 'The family AI key is not set up yet. Add it in the app, under settings, A I.' };
    const ctx = voiceContext(h, now);
    const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][now.getDay()];
    const prompt = 'You are the family\'s helper, answering out loud through an Echo speaker in Auckland, New Zealand. Today is ' + dayName + ', ' + today + ', and the time is ' + fmtTime(now) + '. '
      + 'Answer in at most ' + VOICE_MAX + ' words, as one or two spoken sentences. No lists, no markdown, no emoji, no headings. Plain speech only, New Zealand English. '
      + 'Use ONLY the facts below. If the answer is not there, say so in one sentence and suggest where to look in the app.\n\n' + ctx + '\n\nQuestion: ' + q
      + '\n\nReturn JSON only: {"speech":"..."}';
    const txt = gemini(gk, [{ text: prompt }], true);
    let sp = ''; try { sp = JSON.parse(String(txt).replace(/^```(?:json)?|```$/g, '').trim()).speech; } catch (x) { sp = String(txt).replace(/[#*`]/g, '').slice(0, 300); }
    return { speech: String(sp || 'Sorry, I did not catch that.').replace(/[#*`]/g, '') };
  }
  return { speech: 'I am not sure what to do with that.' };
}
// everything the family's helper knows, as plain lines for the AI to read
function voiceContext(h, now) {
  const hid = h._id, out = [], today = keyOf(now);
  const nameOf = function (id) { const p = vPeople(h).filter(function (x) { return x.id === id; })[0]; return p ? p.name : ''; };
  try { out.push('WHERE: ' + voiceDo(h, 'where', {}).speech); } catch (e) {}
  const lines = [];
  for (let i = 0; i < 8; i++) { const k = keyOf(addDays(now, i)), evs = vEventsOn(h, k); if (evs.length) lines.push(vDay(k, now) + ' (' + k + '): ' + evs.map(function (e) { return vSay(e, h); }).join('; ')); }
  if (lines.length) out.push('CALENDAR:\n' + lines.join('\n'));
  const t = listDocs('households/' + hid + '/todos').filter(function (x) { return !x.done && !x.priv; });
  if (t.length) out.push('JOBS: ' + t.slice(0, 25).map(function (x) { return x.title + (x.who ? ' (' + nameOf(x.who) + ')' : ''); }).join('; '));
  const g = listDocs('households/' + hid + '/groceries').filter(function (x) { return !x.done; });
  if (g.length) out.push('SHOPPING LIST: ' + g.slice(0, 50).map(function (x) { return x.name; }).join(', '));
  const meals = listDocs('households/' + hid + '/meals').filter(function (m) { return m.date >= today && m.date <= keyOf(addDays(now, 8)); });
  if (meals.length) out.push('MEAL PLAN: ' + meals.map(function (m) { const r = m.rid ? getDoc('households/' + hid + '/recipes/' + m.rid) : null; return vDay(m.date, now) + ' ' + m.slot + ': ' + (m.note || (r ? r.name : '')); }).join('; '));
  const bills = listDocs('households/' + hid + '/bills').filter(function (x) { return x.status === 'due' || x.status === 'check'; });
  if (bills.length) out.push('BILLS: ' + bills.map(function (x) { return (x.biller || 'Bill') + ' ' + money(x.amount) + (x.due ? ' due ' + x.due : '') + (x.status === 'check' ? ' (to check)' : '') + (x.directDebit ? ' (direct debit)' : ''); }).join('; '));
  const rn = listDocs('households/' + hid + '/renewals').filter(function (x) { return x.due; });
  if (rn.length) out.push('RENEWALS: ' + rn.map(function (x) { return x.what + (x.item ? ' ' + x.item : '') + ' due ' + x.due; }).join('; '));
  const mem = listDocs('households/' + hid + '/memory');
  if (mem.length) out.push('FAMILY NOTES:\n' + mem.slice(0, 30).map(function (x) { return '- ' + (x.title ? x.title + ': ' : '') + String(x.text).replace(/\s+/g, ' ').slice(0, 300); }).join('\n'));
  return out.join('\n\n');
}
function billsCheckNow() {
  const props = PropertiesService.getScriptProperties(), now = new Date();
  for (const h of listDocs('households')) { const out = billsTick(h, props, now, true); Logger.log((h.billEmail || '(no bills address set)') + ': ' + out.length + ' bills. ' + ((getDoc('households/' + h._id).billsHelper || {}).error || 'OK')); }
}

if (typeof module !== 'undefined') module.exports = { planNotifications, occursOn, checkEvery, parseFlight, flightAlerts, trackFlights };
