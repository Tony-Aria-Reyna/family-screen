/**
 * Family Screen — notification helper (Google Apps Script).
 * Runs every 5 minutes in your own Google account. Reads the family calendar from Firebase and
 * sends reminders to the phones that turned notifications on in Family Screen.
 * Set-up: paste this file, paste appsscript.json, then run setup() once and allow access.
 * Live flight status (optional): add a Script property AERODATABOX_KEY with your free RapidAPI key
 * (⚙️ Project Settings → Script properties). The key stays here in your Google account, never on the website.
 */
const HELPER_VERSION = 37;
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
  let upd = null; try { upd = selfUpdate(props, now, false); } catch (e) { Logger.log('Self-update: ' + e); }
  let homes;
  try { homes = listDocs('households'); healthGlobal(props, now, ''); }
  catch (e) { healthGlobal(props, now, String(e && e.message || e)); throw e; }
  const lent = lentDevices(homes);
  for (const h of homes) {
    const hl = lent[h._id] ? Object.assign({}, h, { devices: Object.assign({}, h.devices || {}, lent[h._id]) }) : h;   // only for calendar reminders
    let err = '', pre = {};
    try {
      // v24: every read this run needs goes out at once (Apps Script otherwise waits about a second for each)
      const hp = 'households/' + h._id, seven = now.getHours() === 7 && now.getMinutes() < 15, nine = now.getHours() === 9 && now.getMinutes() < 15;
      pre = runReads(h, props, now, seven, nine);
      const data = { events: pre.events, todos: pre.todos, flights: pre.flights, renewals: pre.renewals, bills: [] };
      // emails are read once a day (and whenever the app's "check now" button asks)
      if (mailDue(props, 'BILL', h, now)) { try { data.bills = billsTick(h, props, now, true); } catch (e) { Logger.log('Bills: ' + e); } }
      else if (nine) data.bills = pre.bills;
      let inboxNew = []; if (mailDue(props, 'INBOX', h, now)) { try { inboxNew = inboxTick(h, props, now, true); } catch (e) { Logger.log('Inbox: ' + e); } }
      const msgs = planNotifications(hl, data, now, k => !!sent[k]);
      inboxArrivals(h, inboxNew, msgs);
      try { msgPush(h, pre.msgs); } catch (e) { Logger.log('Messages: ' + e); }
      try { wakePrep(h, props, now); } catch (e) { Logger.log('Wake: ' + e); }
      try { agendaPrep(h, props, now); } catch (e) { Logger.log('Agenda: ' + e); }
      try { weekAhead(h, props, now, pre); } catch (e) { Logger.log('Week ahead: ' + e); }
      billArrivals(h, data.bills, msgs, k => !!sent[k]);
      try { trackFlights(hl, data.flights, now, props, msgs); } catch (e) { flightNote.error = String(e && e.message || e).slice(0, 200); }
      for (const m of msgs) { send(hl, m.device, m.title, m.body, m.tag); props.setProperty(m.key, String(now.getTime())); sent[m.key] = '1'; }
      if (h.testPing && h.testPing.hash && (h.devices || {})[h.testPing.hash]) send(h, h.testPing.hash, '🔔 Family Screen', 'Test notification — this phone is all set.', 'test');
    } catch (e) { err = String(e && e.message || e).slice(0, 300); }
    let health = null; try { health = healthAfterRun(h, props, now, err, pre); } catch (e) { Logger.log('Health: ' + e); }
    // the app only needs to know the helper is alive: written every 10 minutes, or straight away when something changed
    const st = { lastRun: now.getTime(), error: err, version: HELPER_VERSION, rules: rules, update: upd, health: health, flights: { key: flightNote.key, used: +(props.getProperty('adb|' + keyOf(now).slice(0, 7)) || 0), budget: FLIGHT_BUDGET, error: flightNote.error } };
    const sig = JSON.stringify([err, rules && rules.error, upd && upd.error, upd && upd.latest, health && [health.fails, health.stale, health.dropped, health.log && health.log.length], flightNote.error]);
    const sk = 'STATUS_' + h._id, last = JSON.parse(props.getProperty(sk) || '{}');
    if (h.testPing || sig !== last.sig || now.getTime() - (last.at || 0) > 9.5 * 60e3 || !h.notifier || (h.notifier.version || 0) !== HELPER_VERSION) {
      const f = { notifier: st }; if (h.testPing) f.testPing = null;
      patch('households/' + h._id, f); props.setProperty(sk, JSON.stringify({ sig: sig, at: now.getTime() }));
    }
  }
  readsFlush(props, now, 'T');
  // tidy up: forget reminders older than 4 days
  const cutoff = now.getTime() - 4 * 864e5;
  Object.keys(sent).forEach(k => { if (+sent[k] > 1 && +sent[k] < cutoff) props.deleteProperty(k); });
}

/* Every read a 5-minute run needs, sent together: the calendar near today and its repeating entries (the family's and each
   member's private ones), new messages, recent flights (kept 30 minutes), and at 9am the renewals and due bills, at 7am the
   calendar feeds. Then the to-dos the calendar has booked, also together. */
function runReads(h, props, now, seven, nine) {
  const hp = 'households/' + h._id, from = keyOf(addDays(now, -3)), to = keyOf(addDays(now, 1)), today = keyOf(now);
  const dateQ = parent => ({ kind: 'query', parent: parent, col: 'events', where: fAnd([fOp('date', 'GREATER_THAN_OR_EQUAL', from), fOp('date', 'LESS_THAN_OR_EQUAL', to)]) });
  const rptQ = parent => ({ kind: 'query', parent: parent, col: 'events', where: fOp('rpt.f', 'IN', ['D', 'W', 'M', 'Y']) });
  const specs = [dateQ(hp), rptQ(hp)], owners = [null, null];
  (h.members || []).forEach(who => { const pp = hp + '/private/' + encodeURIComponent(who); specs.push(dateQ(pp), rptQ(pp)); owners.push(who, who); });
  const nEv = specs.length, slot = {};
  const msgAt = Number(props.getProperty('MSG_AT_' + h._id) || 0);
  slot.msgs = specs.push({ kind: 'query', parent: hp, col: 'msgs', where: fOp('at', 'GREATER_THAN', Math.max(msgAt - 10 * 60e3, now.getTime() - 12 * 3600e3)) }) - 1;
  const cache = typeof CacheService !== 'undefined' ? CacheService.getScriptCache() : null, ck = 'fl|' + hp;
  let flights = null;
  if (seven || props.getProperty('AERODATABOX_KEY')) {
    if (cache) { try { const c = cache.get(ck); if (c) flights = JSON.parse(c); } catch (e) {} }
    if (!flights) slot.fl = specs.push({ kind: 'query', parent: hp, col: 'flights', where: fOp('end', 'GREATER_THAN_OR_EQUAL', new Date(now.getTime() - 3 * 864e5).toISOString()) }) - 1;
  }
  if (nine) { slot.rn = specs.push({ kind: 'list', path: hp + '/renewals' }) - 1; slot.bl = specs.push({ kind: 'query', parent: hp, col: 'bills', where: fOp('status', 'EQUAL', 'due') }) - 1; }
  if (seven) slot.src = specs.push({ kind: 'list', path: hp + '/sources' }) - 1;
  const r = fetchManyLoose(specs);
  if (r[0] instanceof Error) throw r[0]; if (r[1] instanceof Error) throw r[1];
  const events = [], seen = {};
  for (let i = 0; i < nEv; i++) {
    if (!Array.isArray(r[i])) continue;                       // one member's private corner not readable: carry on without it
    r[i].forEach(d => { const k = (owners[i] || '') + '|' + d._id; if (seen[k]) return; seen[k] = 1; if (owners[i]) d._owner = owners[i]; events.push(d); });
  }
  const got = k => (slot[k] !== undefined && Array.isArray(r[slot[k]])) ? r[slot[k]] : null;
  if (slot.fl !== undefined) { flights = got('fl') || []; if (cache) { try { const j = JSON.stringify(flights); if (j.length < 90000) cache.put(ck, j, 1800); } catch (e) {} } }
  // "did it get done?" only ever asks about a to-do booked onto the calendar in the last few days
  const jobs = events.filter(e => e.todoId && !e.done && e.date && e.date >= from && e.date <= today);
  const tr = jobs.length ? fetchManyLoose(jobs.map(e => ({ kind: 'doc', path: (e._owner ? hp + '/private/' + encodeURIComponent(e._owner) : hp) + '/todos/' + e.todoId }))) : [];
  const todos = [];
  tr.forEach((t, i) => { if (!t || t instanceof Error) return; if (!t.id) t.id = t._id; if (jobs[i]._owner) t._owner = jobs[i]._owner; todos.push(t); });
  return { events: events, todos: todos, flights: flights || [], msgs: got('msgs'), renewals: got('rn') || [], bills: got('bl') || [], sources: got('src') };
}

/* ---------- keeping itself up to date ----------
   Every 15 minutes the helper reads helper.gs from the app's site. If that copy has a higher HELPER_VERSION, it saves it
   over this file, makes a new version and points the web app (the Alexa / wake-up song address) at it. The address stays the same.
   One-time switch it needs: script.google.com/home/usersettings → Google Apps Script API → On.
   If a new copy ever needs extra permissions, it does not install itself: the app says so and you paste it once by hand. */
function selfUpdate(props, now, force) {
  const last = JSON.parse(props.getProperty('UPDATE_STATE') || '{}');
  if (!force && last.checked && now.getTime() - last.checked < 14 * 60e3) return last.report || null;
  const report = { checked: now.getTime(), ok: true, at: last.report && last.report.at || 0, error: '', latest: HELPER_VERSION, needsYou: '' };
  try {
    const site = APP_URL.replace(/[^/]*$/, ''), t = '?t=' + now.getTime();
    const r = UrlFetchApp.fetch(site + 'helper.gs' + t, { muteHttpExceptions: true, followRedirects: true });
    if (r.getResponseCode() !== 200) throw new Error('Could not read helper.gs from the app site (' + r.getResponseCode() + ')');
    const code = r.getContentText(), v = +((code.match(/const HELPER_VERSION = (\d+);/) || [])[1] || 0);
    report.latest = v || HELPER_VERSION;
    if (v > HELPER_VERSION) {
      if (!/function tick\(/.test(code) || !/function doPost\(/.test(code) || !/function selfUpdate\(/.test(code)) throw new Error('The new helper.gs does not look right, so it was not installed');
      const src = code.replace("'__PROJECT_ID__'", "'" + PROJECT_ID + "'").replace("'__APP_URL__'", "'" + APP_URL + "'");
      const api = 'https://script.googleapis.com/v1/projects/' + ScriptApp.getScriptId(), H = headers();   // counted against the family's own Firebase project, where the Apps Script API is switched on
      const call = function (method, url, body) {
        const x = UrlFetchApp.fetch(url, { method: method, contentType: 'application/json', headers: H, muteHttpExceptions: true, payload: body ? JSON.stringify(body) : undefined });
        const txt = x.getContentText();
        if (x.getResponseCode() !== 200) {
          if (/has not been used|is disabled|SERVICE_DISABLED|User has not enabled/i.test(txt)) throw new Error(/usersettings|User has not enabled/i.test(txt) ? 'Turn on the Google Apps Script API: script.google.com/home/usersettings' : 'Switch on the Apps Script API for the family project: console.cloud.google.com/apis/library/script.googleapis.com?project=' + PROJECT_ID);
          if (/insufficient authentication scopes/i.test(txt)) throw new Error('Not given permission yet: run updateNow in the editor, click Review permissions, tick Select all, then Continue');
          throw new Error('Apps Script ' + x.getResponseCode() + ': ' + txt.slice(0, 200));
        }
        return JSON.parse(txt || '{}');
      };
      const cur = call('get', api + '/content');
      const mf = cur.files.filter(function (f) { return f.type === 'JSON' && f.name === 'appsscript'; })[0];
      // new permissions need a person to say yes, so leave those for a hand install
      const m = UrlFetchApp.fetch(site + 'helper-manifest.json' + t, { muteHttpExceptions: true, followRedirects: true });
      if (m.getResponseCode() === 200 && mf) {
        const want = JSON.parse(m.getContentText()).oauthScopes || [], have = JSON.parse(mf.source).oauthScopes || [];
        const extra = want.filter(function (x) { return have.indexOf(x) < 0; });
        // a few low-risk permissions may be added here; someone then says yes once by running updateNow in the editor
        const OK_NEW = ['https://www.googleapis.com/auth/photoslibrary.appendonly'];
        if (extra.some(function (x) { return OK_NEW.indexOf(x) < 0; })) { report.needsYou = 'Version ' + v + ' needs new permissions, so paste it in by hand once (⚙️ → 🧰 Helpers).'; throw new Error(report.needsYou); }
        if (extra.length) { mf.source = JSON.stringify(Object.assign(JSON.parse(mf.source), { oauthScopes: have.concat(extra) }), null, 2); report.needsYou = 'Approve the new Google Photos permission: open the helper in Apps Script, choose updateNow, Run, then Review permissions and Allow.'; }
      }
      let done = false;
      cur.files.forEach(function (f) { if (f.type === 'SERVER_JS' && /function tick\(/.test(f.source || '')) { f.source = src; done = true; } });
      if (!done) throw new Error('Could not find the helper file in this project');
      call('put', api + '/content', { files: cur.files.map(function (f) { return { name: f.name, type: f.type, source: f.source }; }) });
      const ver = call('post', api + '/versions', { description: 'Family Screen helper v' + v + ' (updated itself)' });
      const deps = (call('get', api + '/deployments').deployments || []).filter(function (d) {
        return d.deploymentConfig && d.deploymentConfig.versionNumber && (d.entryPoints || []).some(function (e) { return e.entryPointType === 'WEB_APP'; }); });
      deps.forEach(function (d) {
        call('put', api + '/deployments/' + d.deploymentId, { deploymentConfig: { scriptId: ScriptApp.getScriptId(), versionNumber: ver.versionNumber, manifestFileName: 'appsscript', description: 'Family Screen helper v' + v } });
      });
      report.at = now.getTime(); report.from = HELPER_VERSION; report.to = v; report.deployments = deps.length;
    }
  } catch (e) { report.ok = false; report.error = String(e && e.message || e).slice(0, 240); }
  last.checked = now.getTime(); last.report = report;
  props.setProperty('UPDATE_STATE', JSON.stringify(last));
  return report;
}
/* run this by hand in the editor to check for an update straight away */
function updateNow() {
  // Google's permission screen has a tick box for each permission. If one was left unticked, this asks again.
  if (ScriptApp.requireAllScopes) ScriptApp.requireAllScopes(ScriptApp.AuthMode.FULL);
  Logger.log(JSON.stringify(selfUpdate(PropertiesService.getScriptProperties(), new Date(), true))); }

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

/* ---------- what a run reads (v20) ----------
   The free database plan allows 50,000 reads a day, and a run happens 288 times a day, so a run must never read a whole list.
   - calendar: entries dated from 3 days ago to tomorrow, plus the repeating ones
   - booked jobs: only the to-dos those entries point at
   - flights: the ones not long over, remembered for 30 minutes
   - messages: only those newer than the last one handled
   - renewals and bills: at 9am only; emails (bills and the family inbox): once a day */
function nearEvents(parent, now) {
  const seen = {}, out = [];
  const add = d => { if (!seen[d._id]) { seen[d._id] = 1; out.push(d); } };
  runQuery(parent, 'events', fAnd([fOp('date', 'GREATER_THAN_OR_EQUAL', keyOf(addDays(now, -3))), fOp('date', 'LESS_THAN_OR_EQUAL', keyOf(addDays(now, 1)))])).forEach(add);
  runQuery(parent, 'events', fOp('rpt.f', 'IN', ['D', 'W', 'M', 'Y'])).forEach(add);
  return out;
}
// "did it get done?" only ever asks about a to-do booked onto the calendar in the last few days
function jobTodos(hp, events, now) {
  const out = [], today = keyOf(now), from = keyOf(addDays(now, -3));
  events.forEach(e => {
    if (!e.todoId || e.done || !e.date || e.date < from || e.date > today) return;
    try { const t = getDoc((e._owner ? hp + '/private/' + encodeURIComponent(e._owner) : hp) + '/todos/' + e.todoId);
      if (t) { if (!t.id) t.id = t._id; if (e._owner) t._owner = e._owner; out.push(t); } } catch (x) {}
  });
  return out;
}
function recentFlights(hp, now) {
  const cache = typeof CacheService !== 'undefined' ? CacheService.getScriptCache() : null, ck = 'fl|' + hp;
  if (cache) { try { const c = cache.get(ck); if (c) return JSON.parse(c); } catch (e) {} }
  const fl = runQuery(hp, 'flights', fOp('end', 'GREATER_THAN_OR_EQUAL', new Date(now.getTime() - 3 * 864e5).toISOString()));
  if (cache) { try { const j = JSON.stringify(fl); if (j.length < 90000) cache.put(ck, j, 1800); } catch (e) {} }
  return fl;
}
// emails are read once a day, from 6am (or the first run after it). If that read fails, it is tried again each hour.
function mailDue(props, kind, h, now) {
  const addr = String((kind === 'BILL' ? h.billEmail : h.inboxEmail) || '').trim(); if (!addr || now.getHours() < 6) return false;
  const v = String(props.getProperty(kind + '_DAY_' + h._id) || '').split('|');
  return v[0] !== keyOf(now) || (v.length > 1 && now.getHours() > Number(v[1]));
}
function mailDone(props, kind, h, now, err) { props.setProperty(kind + '_DAY_' + h._id, keyOf(now) + (err ? '|' + now.getHours() : '')); }

/* ---------- Sunday 6pm: the week ahead ----------
   A short push to the adults' phones and the full list by email: each day's entries, who is flying, jobs nobody owns,
   what the family inbox added this week, and a line on how Family Screen itself ran. Once a week, Sunday from 6pm. */
function weekAhead(h, props, now, pre) {
  if (now.getDay() !== 0 || now.getHours() < 18 || now.getHours() > 20) return false;
  const wk = 'WEEK_' + h._id; if (props.getProperty(wk) === keyOf(now)) return false;
  props.setProperty(wk, keyOf(now));
  const hp = 'households/' + h._id, d1 = addDays(now, 1), d7 = addDays(now, 7);
  const extra = vPrep(h, keyOf(d1), keyOf(d7), [
    { kind: 'query', parent: hp, col: 'flights', where: fAnd([fOp('start', 'GREATER_THAN_OR_EQUAL', now.toISOString()), fOp('start', 'LESS_THAN_OR_EQUAL', addDays(now, 8).toISOString())]) },
    { kind: 'query', parent: hp, col: 'todos', where: fOp('done', 'EQUAL', false) },
    { kind: 'query', parent: hp, col: 'inbox', where: fOp('at', 'GREATER_THAN_OR_EQUAL', now.getTime() - 7 * 864e5) }]);
  const people = vPeople(h), nameOf = id => (people.filter(p => p.id === id)[0] || {}).name || '';
  const days = [], short = [];
  for (let i = 1; i <= 7; i++) {
    const d = addDays(now, i), k = keyOf(d), ev = vEventsOn(h, k);
    const label = Utilities.formatDate(d, 'Pacific/Auckland', 'EEE d MMM');
    days.push(label + ': ' + (ev.length ? ev.slice(0, 8).map(e => vSay(e, h)).join('; ') : 'nothing on'));
    if (ev.length) short.push(Utilities.formatDate(d, 'Pacific/Auckland', 'EEE') + ' ' + ev.length);
  }
  const fl = (extra[0] || []).sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  const away = fl.map(f => (nameOf(f.who) || 'Flight') + ': ' + (f.flight || '') + ' ' + (f.from || '') + '→' + (f.to || '') + ', ' + Utilities.formatDate(new Date(f.start), 'Pacific/Auckland', 'EEE h:mma').replace('AM', 'am').replace('PM', 'pm'));
  const open = extra[1] || [], noOwner = open.filter(t => !t.who || t.who === 'all');
  const ib = extra[2] || [], added = ib.reduce((n, d) => n + (d.items || []).filter(x => x.state === 'added').length, 0);
  const hs = hRead(props, h._id);
  const healthLine = (hs.failsWeek ? hs.failsWeek + ' failed helper runs this week' : 'No failed helper runs this week') + (hs.readsPeak ? '; database reads peaked at ' + Number(hs.readsPeak).toLocaleString('en-NZ') + ' of the free 50,000 a day' : '') + '.';
  const body = 'The week ahead\n\n' + days.join('\n') + '\n\n' + (away.length ? 'Flights:\n' + away.join('\n') + '\n\n' : '') +
    (noOwner.length ? 'Jobs nobody owns yet (' + noOwner.length + '): ' + noOwner.slice(0, 6).map(t => t.title).join('; ') + '\n\n' : '') +
    (ib.length ? 'From the family inbox this week: ' + added + ' added from ' + ib.length + ' email' + (ib.length === 1 ? '' : 's') + '.\n\n' : '') + 'Family Screen: ' + healthLine;
  const pushText = (short.length ? short.join(' · ') : 'A quiet week') + (away.length ? ' · ' + away.length + ' flight' + (away.length === 1 ? '' : 's') : '') + (noOwner.length ? ' · ' + noOwner.length + ' jobs need an owner' : '');
  // the adults who run the house: whoever set the family up, and the one who flies for work
  const adults = [String(h.owner || '').toLowerCase()].concat(people.filter(p => p.traveller && p.email).map(p => String(p.email).toLowerCase())).filter((e, i, l) => e && l.indexOf(e) === i);
  Object.keys(h.devices || {}).forEach(hash => { const d = h.devices[hash]; if (d && d.token && adults.indexOf(String(d.email || '').toLowerCase()) >= 0) { try { send(h, hash, '🗓️ The week ahead', pushText, 'week'); } catch (e) {} } });
  adults.forEach(em => { try { GmailApp.sendEmail(em, 'Family Screen: the week ahead', body + '\n\n' + APP_URL); } catch (e) { Logger.log('Week email: ' + e); } });
  hs.failsWeek = 0; hs.readsPeak = 0; hSave(props, h._id, hs);
  return { push: pushText, body: body };
}

/* ---------- health: Tony hears about a problem before the family does ----------
   Checked after every run: runs that fail, the database's free daily reads (counted by the helper and the screens, checked once an hour),
   Alexa answers that took too long, calendar feeds that stopped (at 7am), and phones that stopped getting alerts.
   Each kind of alert goes out at most once every few hours: a push to Tony's phones and an email to him. */
const READ_WARN = 30000;   // of the free 50,000 a day
function hRead(props, hid) { try { return JSON.parse(props.getProperty('HEALTH_' + hid) || '{}'); } catch (e) { return {}; } }
function hSave(props, hid, s) { props.setProperty('HEALTH_' + hid, JSON.stringify(s)); }
function healthAlert(h, s, kind, title, body, gapHours, now) {
  s.alerted = s.alerted || {}; const last = Number(s.alerted[kind] || 0);
  if (now.getTime() - last < (gapHours || 6) * 3600e3) return false;
  s.alerted[kind] = now.getTime();
  s.log = [{ kind: kind, title: title, at: now.getTime() }].concat(s.log || []).slice(0, 8);
  const owner = String(h.owner || '').toLowerCase();
  Object.keys(h.devices || {}).forEach(function (hash) { const d = h.devices[hash];
    if (d && d.token && owner && String(d.email || '').toLowerCase() === owner) { try { send(h, hash, '⚠️ ' + title.charAt(0).toUpperCase() + title.slice(1), body.slice(0, 180), 'health-' + kind); } catch (e) {} } });
  try { if (owner && typeof GmailApp !== 'undefined') GmailApp.sendEmail(owner, 'Family Screen: ' + title, body + '\n\n' + APP_URL + '\n\nThis note comes from the Family Screen Reminder helper.'); } catch (e) { Logger.log('Health email: ' + e); }
  return true;
}
// the helper could not even read the family list (the database refused, or its limit was reached): only email can reach Tony then
function healthGlobal(props, now, err) {
  const s = JSON.parse(props.getProperty('HEALTH_GLOBAL') || '{}');
  if (!err) { if (s.fails) { s.fails = 0; props.setProperty('HEALTH_GLOBAL', JSON.stringify(s)); } return; }
  s.fails = (s.fails || 0) + 1;
  const full = /429|quota|RESOURCE_EXHAUSTED/i.test(err);
  if ((full || s.fails >= 3) && now.getTime() - (s.alerted || 0) > 6 * 3600e3) {
    s.alerted = now.getTime();
    try { GmailApp.sendEmail(Session.getEffectiveUser().getEmail(), 'Family Screen: ' + (full ? 'the family database hit its daily limit' : 'the Reminder helper cannot reach the family database'),
      (full ? 'Reminders, messages and Alexa may stop until the limit resets at ' + resetTime(now) + '.' : 'The last ' + s.fails + ' runs failed.') + '\n\nError: ' + err + '\n\n' + APP_URL); } catch (e) { Logger.log('Health email: ' + e); }
  }
  props.setProperty('HEALTH_GLOBAL', JSON.stringify(s));
}
/* v25: database reads are counted here, because Cloud Monitoring only answers once billing is switched on (decision 5 keeps
   the free plan). This helper counts its own reads; each screen counts its own and saves the total now and then in
   usage/reads-<day>. The free 50,000 a day runs by Pacific time, so the count does too. It is an estimate, a little low. */
var RD = 0;
function rd(n) { RD += Math.max(1, Number(n) || 0); }
function pday(now) { return Utilities.formatDate(now, 'America/Los_Angeles', 'yyyy-MM-dd'); }
function readsFlush(props, now, k) {
  if (!RD) return;
  const key = 'RDS_' + k + '_' + pday(now);
  try { props.setProperty(key, String(+(props.getProperty(key) || 0) + RD)); RD = 0;
    if (k === 'T') props.deleteProperty('RDS_T_' + pday(new Date(now.getTime() - 3 * 864e5))), props.deleteProperty('RDS_P_' + pday(new Date(now.getTime() - 3 * 864e5))); } catch (e) {}
}
function readsToday(h, props, now) {
  const day = pday(now); let helper = RD, app = 0;
  ['T', 'P'].forEach(function (k) { helper += +(props.getProperty('RDS_' + k + '_' + day) || 0); });
  const u = getDoc('households/' + h._id + '/usage/reads-' + day);
  if (u) Object.keys(u).forEach(function (k) { const v = u[k]; if (v && typeof v === 'object' && v.n) app += Number(v.n) || 0; });
  return { n: helper + app, helper: helper, app: app, day: day };
}
// when the daily allowance starts again, in NZ time (9pm in the NZ summer, 7pm in winter, 8pm in between)
function resetTime(now) {
  const m = String(Utilities.formatDate(now, 'America/Los_Angeles', 'XXX')).match(/([+-])(\d\d):(\d\d)/); if (!m) return '9pm';
  const d = new Date(now.getTime()); d.setUTCHours(0, (m[1] === '-' ? 1 : -1) * (+m[2] * 60 + +m[3]), 0, 0); if (d.getTime() <= now.getTime()) d.setTime(d.getTime() + 864e5);
  return String(Utilities.formatDate(d, 'Pacific/Auckland', 'h:mm a')).replace(':00', '').replace(' ', '').toLowerCase();
}
function noteDrop(hid, dev) {
  const props = PropertiesService.getScriptProperties(), k = 'DROPS_' + hid, l = JSON.parse(props.getProperty(k) || '[]');
  l.push({ label: String(dev && dev.label || 'a phone').slice(0, 60), email: String(dev && dev.email || ''), at: Date.now() }); props.setProperty(k, JSON.stringify(l.slice(-5)));
}
function noteVoice(h, b, ms, failed) {
  if (b.via !== 'alexa' || (!failed && ms < 7000)) return;
  const props = PropertiesService.getScriptProperties(), s = hRead(props, h._id), day = keyOf(new Date());
  if (!s.slow || s.slow.day !== day) s.slow = { day: day, n: 0, worst: 0 };
  s.slow.n++; s.slow.worst = Math.max(s.slow.worst || 0, ms); s.slow.last = String(b.action || '') + (failed ? ' (error)' : ' (' + Math.round(ms / 100) / 10 + ' s)');
  hSave(props, h._id, s);
}
function healthAfterRun(h, props, now, err, pre) {
  const s = hRead(props, h._id), day = keyOf(now);
  if (err) { s.fails = (s.fails || 0) + 1; s.lastErr = err; s.failsWeek = (s.failsWeek || 0) + 1; } else s.fails = 0;
  const full = /429|quota|RESOURCE_EXHAUSTED/i.test(err || '');
  if (err && (full || s.fails >= 3)) healthAlert(h, s, full ? 'limit' : 'fail', full ? 'the family database hit its daily limit' : 'the Reminder helper is failing',
    full ? 'Reminders, messages and Alexa may stop until the limit resets at ' + resetTime(now) + '. Error: ' + err : 'The last ' + s.fails + ' runs failed. Error: ' + err, 6, now);
  if (!s.readsAt || now.getTime() - s.readsAt > 55 * 60e3) {
    s.readsAt = now.getTime();
    try { const r = readsToday(h, props, now); s.reads = r.n; s.readsHelper = r.helper; s.readsApp = r.app; s.readsDay = r.day; s.readsErr = ''; s.readsPeak = Math.max(s.readsPeak || 0, r.n);
      if (r.n > READ_WARN) healthAlert(h, s, 'reads', 'database reads are high today', 'About ' + r.n.toLocaleString('en-NZ') + ' of the free 50,000 reads a day are used so far (the helper ' + (r.helper || 0).toLocaleString('en-NZ') + ', the screens ' + (r.app || 0).toLocaleString('en-NZ') + '). If it reaches 50,000, the app and reminders stop until ' + resetTime(now) + '.', 20, now); }
    catch (e) { s.readsErr = String(e && e.message || e).slice(0, 160); }
  }
  if (s.slow && s.slow.day === day && s.slow.n >= 2) healthAlert(h, s, 'slow', 'Alexa answers are slow', s.slow.n + ' Alexa answers today took longer than the 8 seconds Alexa allows (worst ' + Math.round((s.slow.worst || 0) / 1000) + ' s, last: ' + (s.slow.last || '') + ').', 20, now);
  if (pre && Array.isArray(pre.sources)) {
    s.stale = pre.sources.filter(function (x) { return x.type !== 'roster' && x.url && (x.err || (x.at && now.getTime() - x.at > 4 * 864e5)); }).map(function (x) { return String(x.label || x.type || 'A calendar').slice(0, 40); });
    if (s.stale.length) healthAlert(h, s, 'feeds', 'a calendar has stopped updating', s.stale.join(', ') + ' has not updated for over 4 days. Open Family Screen, or check the link in ⚙️ Settings → Connect calendars.', 20, now);
  }
  const dk = 'DROPS_' + h._id, drops = JSON.parse(props.getProperty(dk) || '[]');
  if (drops.length) {
    props.deleteProperty(dk); s.dropped = drops.concat(s.dropped || []).slice(0, 5);
    healthAlert(h, s, 'drop', 'a phone stopped getting alerts', drops.map(function (d) { return d.label; }).join(', ') + ' stopped receiving Family Screen alerts. Opening Family Screen on that phone turns them back on.', 1, now);
    drops.forEach(function (d) { const em = String(d.email || '').toLowerCase(); if (!em || em === String(h.owner || '').toLowerCase()) return;
      try { GmailApp.sendEmail(em, 'Family Screen alerts stopped on your phone', 'Your phone stopped getting Family Screen reminders and messages. Open Family Screen on it and tap "Turn on alerts" if it asks.\n\n' + APP_URL); } catch (e) {} });
  }
  hSave(props, h._id, s);
  return { fails: s.fails || 0, lastErr: s.fails ? s.lastErr || '' : '', reads: s.reads == null ? null : s.reads, readsHelper: s.readsHelper || 0, readsApp: s.readsApp || 0, readsDay: s.readsDay || '', readsAt: s.readsAt || 0, readsErr: s.readsErr || '',
    slow: s.slow && s.slow.day === day ? s.slow.n : 0, stale: s.stale || [], dropped: (s.dropped || []).map(function (d) { return d.label; }), log: (s.log || []).slice(0, 5) };
}

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
    if (dev.lent) data = { events: data.events, todos: [], flights: [], renewals: [], bills: [] };   // a linked household's phone: calendar reminders only
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
      // coming home to Auckland: the pick-up (or taxi) moves with the landing, so say the new time
      const tx = Object.assign({ after: 60 }, h.taxi || {}), home = f.to === 'AKL' && tx.after > 0;
      const pick = home ? Utilities.formatDate(new Date(cur.arr + tx.after * 60e3), 'Pacific/Auckland', 'h:mma').toLowerCase() : '';
      const was = home && cur.arrS ? Utilities.formatDate(new Date(cur.arrS + tx.after * 60e3), 'Pacific/Auckland', 'h:mma').toLowerCase() : '';
      out.push({ tag: 'fl' + f.id, title: (late > 0 ? '⏰ ' : '⏩ ') + name + ' running ' + Math.abs(late) + ' min ' + (late > 0 ? 'late' : 'early'),
        body: (who ? who + ' now lands ' : 'Now lands ') + cityOf(f.to) + ' about ' + when + nz + '.' + (home ? ' 🚕 Pick-up now about ' + pick + (was && was !== pick ? ' (was ' + was + ')' : '') + '.' : ''), who: f.who });
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
      if (dev.people && dev.people.length && dev.people.indexOf(a.who) < 0 && (dev.flyers || []).indexOf(a.who) < 0) continue;
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
    const j = JSON.parse(r.getContentText()); rd((j.documents || []).length);
    (j.documents || []).forEach(d => { const o = dec({ mapValue: { fields: d.fields || {} } }); o._id = d.name.split('/').pop(); if (!o.id) o.id = o._id; out.push(o); });
    token = j.nextPageToken || '';
  } while (token);
  return out;
}
// a filtered read: only the documents that match are counted against the daily allowance
function fOp(field, op, val) { return { fieldFilter: { field: { fieldPath: field }, op: op, value: enc(val) } }; }
function fAnd(list) { return { compositeFilter: { op: 'AND', filters: list } }; }
function runQuery(parent, col, where) {
  const r = UrlFetchApp.fetch(BASE + (parent ? '/' + parent : '') + ':runQuery', { method: 'post', contentType: 'application/json', headers: headers(), muteHttpExceptions: true,
    payload: JSON.stringify({ structuredQuery: { from: [{ collectionId: col }], where: where } }) });
  if (r.getResponseCode() !== 200) throw new Error('Reading ' + col + ': ' + r.getResponseCode() + ' ' + r.getContentText().slice(0, 200));
  const out = [];
  JSON.parse(r.getContentText()).forEach(x => { const d = x.document; if (!d) return; const o = dec({ mapValue: { fields: d.fields || {} } }); o._id = d.name.split('/').pop(); if (!o.id) o.id = o._id; out.push(o); });
  rd(out.length); return out;
}
function mkDoc(d) { const o = dec({ mapValue: { fields: d.fields || {} } }); o._id = d.name.split('/').pop(); if (!o.id) o.id = o._id; return o; }
// several reads at once (Apps Script otherwise waits about a second for each): [{kind:'query'|'doc'|'list', ...}] in, an array of results out
function fetchReqs(specs) {
  return specs.map(function (s) {
    if (s.kind === 'query') return { url: BASE + (s.parent ? '/' + s.parent : '') + ':runQuery', method: 'post', contentType: 'application/json', headers: headers(), muteHttpExceptions: true, payload: JSON.stringify({ structuredQuery: { from: [{ collectionId: s.col }], where: s.where } }) };
    return { url: BASE + '/' + s.path + (s.kind === 'list' ? '?pageSize=300' : ''), headers: headers(), muteHttpExceptions: true };
  });
}
function readOne(s, r) {
  const code = r.getResponseCode(), what = s.path || s.col;
  if (s.kind === 'doc' && code === 404) { rd(1); return null; }
  if (code !== 200) throw new Error('Reading ' + what + ': ' + code + ' ' + r.getContentText().slice(0, 120));
  const j = JSON.parse(r.getContentText());
  if (s.kind === 'doc') { rd(1); return mkDoc(j); }
  if (s.kind === 'query') { const l = j.filter(function (x) { return x.document; }).map(function (x) { return mkDoc(x.document); }); rd(l.length); return l; }
  rd((j.documents || []).length);
  return j.nextPageToken ? listDocs(s.path) : (j.documents || []).map(mkDoc);
}
function fetchMany(specs) { return UrlFetchApp.fetchAll(fetchReqs(specs)).map(function (r, i) { return readOne(specs[i], r); }); }
function fetchManyLoose(specs) {
  if (!specs.length) return [];
  return UrlFetchApp.fetchAll(fetchReqs(specs)).map(function (r, i) { try { return readOne(specs[i], r); } catch (e) { return e; } });
}
function patch(path, fields) {
  const mask = Object.keys(fields).map(k => 'updateMask.fieldPaths=' + encodeURIComponent(k)).join('&');
  const body = { fields: {} }; Object.keys(fields).forEach(k => { if (fields[k] !== undefined) body.fields[k] = enc(fields[k]); });
  UrlFetchApp.fetch(BASE + '/' + path + '?' + mask, { method: 'patch', contentType: 'application/json', payload: JSON.stringify(body), headers: headers(), muteHttpExceptions: true });
}
/* linked households: someone listed in a family (by email) who lives in another household with its own phone (Masako)
   gets that family's reminders for entries made for them. Their phone is lent to the family's run for calendar
   reminders only: no morning summary, jobs, bills or flight alerts. */
function lentDevices(homes) {
  const out = {};
  for (const h of homes) {
    const full = (h.members || []).filter(e => (h.limited || []).indexOf(e) < 0);
    for (const p of h.people || []) { const em = String(p.email || '').toLowerCase(); if (!em || full.indexOf(em) >= 0) continue;
      for (const o of homes) { if (o._id === h._id) continue;
        const devs = o.devices || {};
        for (const hash of Object.keys(devs)) { const d = devs[hash]; if (!d || !d.token || String(d.email || '').toLowerCase() !== em) continue;
          // flight alerts for the family's traveller too (Masako picks Reyna up and drops her off)
          const fly = (h.people || []).filter(q => q.traveller).map(q => q.id);
          (out[h._id] = out[h._id] || {})['L-' + o._id + '-' + hash] = { token: d.token, email: em, lang: d.lang || '', label: d.label || '', people: [p.id], flyers: fly, lead: d.lead || 30, remind: true, morning: false, jobs: false, flights: d.flights !== false, lent: true };
        } } }
  }
  return out;
}
function send(h, hash, title, body, tag) {
  const dev = (h.devices || {})[hash]; if (!dev || !dev.token) return;
  if (dev.lang === 'ja') { const j = jaAlert(h, title, body); title = j[0]; body = j[1]; }
  const msg = { message: { token: dev.token, data: { title: String(title), body: String(body), tag: String(tag || ''), url: APP_URL },
    webpush: { headers: { Urgency: 'high', TTL: /^call-/.test(String(tag || '')) ? '60' : '3600' } } } };   // an "is calling" alert is no use a minute later
  const r = UrlFetchApp.fetch('https://fcm.googleapis.com/v1/projects/' + PROJECT_ID + '/messages:send', { method: 'post', contentType: 'application/json', payload: JSON.stringify(msg), headers: headers(), muteHttpExceptions: true });
  const code = r.getResponseCode();
  if (code === 404 || (code === 400 && /UNREGISTERED|INVALID_ARGUMENT/.test(r.getContentText()))) {
    // that phone uninstalled or turned notifications off: forget it, and remember it for the health check
    if (dev.lent) return;   // a phone from a linked household: that household's own run looks after it
    try { noteDrop(h._id, dev); } catch (e) {}
    UrlFetchApp.fetch(BASE + '/households/' + h._id + '?updateMask.fieldPaths=' + encodeURIComponent('devices.`' + hash + '`'), { method: 'patch', contentType: 'application/json', payload: JSON.stringify({ fields: {} }), headers: headers(), muteHttpExceptions: true });
  } else if (code !== 200) throw new Error('Sending: ' + code + ' ' + r.getContentText().slice(0, 200));
}
/* 3.1 alerts for a phone set to Japanese (Masako's): the AI puts the title and text into plain Japanese, kept for a day
   so the same reminder isn't translated twice. Names, times and emoji stay. If the AI can't, the English goes. */
const JA_FIXED = { '⏰ Wake-up': '⏰ おはよう', '💬 Family': '💬 家族' };
function jaAlert(h, title, body) {
  const key = 'JA|' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, title + '\n' + body)), c = CacheService.getScriptCache();
  try { const hit = c.get(key); if (hit) return JSON.parse(hit); } catch (e) {}
  try { if (!aiReady(h)) return [title, body];
    const t = aiCall(h, [{ text: 'Translate this phone notification for a Japanese grandmother into natural, simple Japanese. Keep names, times, numbers and emoji as they are. Reply with JSON only: {"title":"…","body":"…"}\nTitle: ' + title + '\nText: ' + body }], true);
    const j = JSON.parse(String(t).replace(/^[^{]*/, '').replace(/[^}]*$/, '')), out = [String(j.title || JA_FIXED[title] || title).slice(0, 120), String(j.body || body).slice(0, 600)];
    c.put(key, JSON.stringify(out), 86400); return out; } catch (e) { Logger.log('Japanese alert: ' + e); return [JA_FIXED[title] || title, body]; }
}
/* 3.5 a document kept for the family: saved into "Family Screen documents" in this Google Drive, link back to the app */
function docSave(h, b) {
  const data = String(b.data || ''); if (!data || data.length > 13e6) return { error: 'No file, or it is too big' };
  const props = PropertiesService.getScriptProperties(); let folder = null;
  try { const id = props.getProperty('DOCS_FOLDER'); if (id) folder = DriveApp.getFolderById(id); } catch (e) {}
  if (!folder) { folder = DriveApp.createFolder('Family Screen documents'); props.setProperty('DOCS_FOLDER', folder.getId()); }
  const f = folder.createFile(Utilities.newBlob(Utilities.base64Decode(data), String(b.mime || 'application/pdf'), String(b.name || 'Document').replace(/[\\/:*?"<>|]/g, ' ').slice(0, 120)));
  return { ok: true, id: f.getId(), url: f.getUrl() };
}
/* 3.4 the fridge's night-time photo frame: pictures from a Drive folder the family picked, 10 at a time, about 1280 px wide */
// the family album: one Drive folder the helper makes itself, "Family Screen photos"
function albumFolder() {
  const props = PropertiesService.getScriptProperties(); let f = null;
  try { const id = props.getProperty('ALBUM_FOLDER'); if (id) f = DriveApp.getFolderById(id); } catch (e) {}
  if (!f) { f = DriveApp.createFolder('Family Screen photos'); props.setProperty('ALBUM_FOLDER', f.getId()); }
  return f;
}
function photoAdd(b) {
  const data = String(b.data || ''); if (!data || data.length > 12e6) return { error: 'No photo, or it is too big' };
  const f = albumFolder(), name = String(b.name || ('Photo ' + Utilities.formatDate(new Date(), 'Pacific/Auckland', 'yyyy-MM-dd HHmmss'))).replace(/[\\/:*?"<>|]/g, ' ').slice(0, 100);
  const file = f.createFile(Utilities.newBlob(Utilities.base64Decode(data), String(b.mime || 'image/jpeg'), name));
  if (b.by) try { file.setDescription('Added by ' + String(b.by).slice(0, 60) + ' from Family Screen'); } catch (e) {}
  let gp = ''; try { gp = gphotosAdd(file.getBlob(), name, b.by); } catch (e) { gp = String(e.message || e).slice(0, 120); Logger.log('Google Photos: ' + gp); }
  if (/^ok:/.test(gp)) try { file.setDescription((file.getDescription() || '') + ' [gp:' + gp.slice(3) + ']'); } catch (e) {}
  return { ok: true, id: file.getId(), folder: f.getId(), gphotos: /^ok/.test(gp) };
}
/* delete a photo from the family album: the Drive copy goes to the bin (30 days to undo), the Google Photos copy leaves the album */
function photoDel(b) {
  const id = String(b.id || '').replace(/[^\w-]/g, ''); if (!id) return { error: 'No photo' };
  let file; try { file = DriveApp.getFileById(id); } catch (e) { return { ok: true, gone: true }; }
  const folders = [albumFolder().getId()], props = PropertiesService.getScriptProperties(), alt = String(b.folder || '').replace(/[^\w-]/g, '');
  if (alt) folders.push(alt);
  let inAlbum = false; const ps = file.getParents(); while (ps.hasNext()) if (folders.indexOf(ps.next().getId()) >= 0) inAlbum = true;
  if (!inAlbum) return { error: 'That photo isn’t in the family album' };
  const m = /\[gp:([^\]]+)\]/.exec(file.getDescription() || ''), album = props.getProperty('GPHOTOS_ALBUM');
  if (m && album) try { UrlFetchApp.fetch('https://photoslibrary.googleapis.com/v1/albums/' + album + ':batchRemoveMediaItems', { method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken(), 'x-goog-user-project': PROJECT_ID }, payload: JSON.stringify({ mediaItemIds: [m[1]] }) }); } catch (e) {}
  file.setTrashed(true);
  return { ok: true };
}
/* a copy of each album photo goes into a "Family Screen" album in this account's Google Photos (Google only lets apps add, not read) */
function gphotosAdd(blob, name, by) {
  const H = { Authorization: 'Bearer ' + ScriptApp.getOAuthToken(), 'x-goog-user-project': PROJECT_ID }, props = PropertiesService.getScriptProperties(), api = 'https://photoslibrary.googleapis.com/v1/';
  const json = function (r) { const t = r.getContentText(); if (r.getResponseCode() !== 200) throw new Error('Photos ' + r.getResponseCode() + ': ' + t.slice(0, 160)); return JSON.parse(t || '{}'); };
  let album = props.getProperty('GPHOTOS_ALBUM');
  if (!album) {
    album = json(UrlFetchApp.fetch(api + 'albums', { method: 'post', contentType: 'application/json', headers: H, muteHttpExceptions: true, payload: JSON.stringify({ album: { title: 'Family Screen' } }) })).id;
    props.setProperty('GPHOTOS_ALBUM', album);
  }
  const up = UrlFetchApp.fetch(api + 'uploads', { method: 'post', contentType: 'application/octet-stream', muteHttpExceptions: true, payload: blob.getBytes(),
    headers: Object.assign({ 'X-Goog-Upload-Content-Type': blob.getContentType() || 'image/jpeg', 'X-Goog-Upload-Protocol': 'raw' }, H) });
  if (up.getResponseCode() !== 200) throw new Error('Photos upload ' + up.getResponseCode() + ': ' + up.getContentText().slice(0, 160));
  const add = function (alb) { return UrlFetchApp.fetch(api + 'mediaItems:batchCreate', { method: 'post', contentType: 'application/json', headers: H, muteHttpExceptions: true,
    payload: JSON.stringify(Object.assign(alb ? { albumId: alb } : {}, { newMediaItems: [{ description: by ? 'Added by ' + String(by).slice(0, 60) : '', simpleMediaItem: { uploadToken: up.getContentText(), fileName: name } }] })) }); };
  let r = add(album);
  if (r.getResponseCode() === 400 || r.getResponseCode() === 403 || r.getResponseCode() === 404) { props.deleteProperty('GPHOTOS_ALBUM'); json(r); }   // the album was deleted in Google Photos: make a new one next time
  const res = json(r), it = res.newMediaItemResults && res.newMediaItemResults[0] && res.newMediaItemResults[0].mediaItem;
  return it ? 'ok:' + it.id : 'ok';
}
/* a photo picked in Google Photos' own picker that the phone couldn't download itself */
function photoFetch(b) {
  const url = String(b.url || ''); if (!/^https:\/\/[a-z0-9.-]+\.(googleusercontent|google)\.com\//.test(url)) return { error: 'Not a Google Photos link' };
  const r = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + String(b.token || '') }, muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) return { error: 'Google Photos said ' + r.getResponseCode() };
  const blob = r.getBlob();
  return photoAdd({ data: Utilities.base64Encode(blob.getBytes()), mime: blob.getContentType() || 'image/jpeg', name: b.name, by: b.by });
}
function photosPage(b) {
  const id = String(b.folder || '').replace(/[^\w-]/g, '') || albumFolder().getId();
  let files; try { files = DriveApp.getFolderById(id).getFiles(); } catch (e) { return { error: 'That folder can\'t be opened by the helper\'s Google account' }; }
  const all = []; while (files.hasNext() && all.length < 400) { const f = files.next(); if (/^image\//.test(f.getMimeType())) all.push(f); }
  all.sort(function (a, c) { return c.getDateCreated() - a.getDateCreated(); });
  const page = Math.max(0, Math.min(14, Number(b.page) || 0)), slice = all.slice(page * 10, page * 10 + 10), tok = ScriptApp.getOAuthToken(), out = [];
  slice.forEach(function (f) { try {
      const meta = JSON.parse(UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/' + f.getId() + '?fields=thumbnailLink', { headers: { Authorization: 'Bearer ' + tok } }).getContentText());
      let blob = null; if (meta.thumbnailLink) { const r = UrlFetchApp.fetch(meta.thumbnailLink.replace(/=s\d+$/, '=s1280'), { headers: { Authorization: 'Bearer ' + tok }, muteHttpExceptions: true }); if (r.getResponseCode() === 200) blob = r.getBlob(); }
      if (!blob && f.getSize() < 1500000) blob = f.getBlob();
      if (blob) out.push({ id: f.getId(), mime: blob.getContentType() || 'image/jpeg', data: Utilities.base64Encode(blob.getBytes()) });
    } catch (e) { Logger.log('Photo ' + f.getName() + ': ' + e); } });
  return { photos: out, more: all.length > (page + 1) * 10 && page < 14 };
}
/* ================= Family inbox =================
   One address for everything the family gets sent (a plus address of THIS Gmail account, set in the app: 📥 Inbox → Setup):
   the teacher's weekly note, a party invitation, a club newsletter, an appointment confirmation. Forward it there and the AI
   pulls out the dates and the things to do. They show in the app as suggestions: nothing goes on the calendar until someone taps Add.
   A bill sent here is passed on to the bills address, so one address really does do the lot. */
function inboxTick(h, props, now, force) {
  const addr = String(h.inboxEmail || '').toLowerCase().trim(), fresh = [];
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)) return fresh;
  const prev = h.inboxHelper || {};
  if (!force && !mailDue(props, 'INBOX', h, now)) return fresh;
  let err = '', added = 0;
  try {
    const threads = GmailApp.search('to:' + addr + ' newer_than:14d', 0, 15);
    const path = 'households/' + h._id + '/inbox', seen = {}; if (threads.length) listDocs(path).forEach(function (d) { seen[d._id] = 1; });
    if (threads.length && !aiReady(h)) throw new Error('No AI key yet: add it in the app (More → ✨ AI)');
    const label = GmailApp.getUserLabelByName('Family Screen inbox') || GmailApp.createLabel('Family Screen inbox');
    const today = keyOf(now), bills = String(h.billEmail || '').toLowerCase().trim();
    for (const t of threads) {
      for (const msg of t.getMessages()) {
        const id = 'email-' + msg.getId(); if (seen[id]) continue;
        if ((msg.getTo() + ' ' + msg.getCc()).toLowerCase().indexOf(addr) < 0) continue;
        const atts = msg.getAttachments({ includeInlineImages: false }).filter(function (a) { return /pdf|image\//i.test(a.getContentType()) && a.getSize() < 5e6; }).slice(0, 3);
        let text = String(msg.getPlainBody() || ''); if (text.trim().length < 40) text = String(msg.getBody() || '').replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
        const prompt = 'You read an email a New Zealand family forwarded to their family inbox (often a teacher\'s weekly note, a school or club newsletter, an invitation or an appointment). ' +
          'Pull out what the family needs to put on the calendar and what they need to do. Return JSON only: ' +
          '{"kind":"school|club|invitation|appointment|bill|other","from":"who it is really from, short (e.g. Room 5, Mrs Patel)","summary":"one or two plain sentences on what this email is about",' +
          '"events":[{"title":"short, e.g. Swimming sports","date":"YYYY-MM-DD","time":"HH:MM 24-hour, or empty for all day","end":"HH:MM or empty","who":"first name of the family member it is for, or empty for everyone","note":"where, or what to bring, short"}],' +
          '"todos":[{"title":"starts with a verb, e.g. Return the camp permission slip","due":"YYYY-MM-DD or empty","who":"first name of who should do it, or empty","note":"short detail, or empty"}]}. ' +
          'Today is ' + today + ' (' + ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][now.getDay()] + ', Pacific/Auckland). Work out real dates from words like "this Friday" or "Week 6 Tuesday" only when the email makes the date certain; if a date is not certain, make it a to-do without a date and say so in the note. ' +
          'Things to bring, pay, sign, return, wear or book are to-dos. Events are things that happen at a time or on a day. School events are for the child; to-dos are usually for a parent. ' +
          'Leave out general news, thank-yous and anything already past. Never invent anything. At most 12 events and 12 to-dos. If it is a bill or invoice to pay, kind is "bill" and both lists are empty.\n\n' +
          vWho(h) + '\n\nFrom: ' + msg.getFrom() + '\nSubject: ' + msg.getSubject() + '\nSent: ' + msg.getDate() + '\n\n' + text.slice(0, 12000);
        const parts = [{ text: prompt }].concat(atts.map(function (a) { return { inline_data: { mime_type: a.getContentType().split(';')[0], data: Utilities.base64Encode(a.getBytes()) } }; }));
        const fromEmail = { from: String(msg.getFrom()).slice(0, 160), subject: String(msg.getSubject() || '').slice(0, 160), at: msg.getDate().getTime(), link: 'https://mail.google.com/mail/u/0/#all/' + msg.getId() };
        let d; try { const raw = String(aiCall(h, parts) || '{}'); d = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)); }
        catch (e) { if (e.gemini) throw e; d = { kind: 'other', summary: 'Couldn\'t read this one: open the email.', events: [], todos: [] }; }
        if (d.kind === 'bill' && bills && bills !== addr) {
          try { msg.forward(bills); patch(path + '/' + id, { status: 'done', kind: 'bill', at: fromEmail.at, fromEmail: fromEmail, summary: 'This is a bill, so it was passed to Bills.', items: [] }); seen[id] = 1; continue; } catch (e) {}
        }
        const okDate = function (k) { return /^\d{4}-\d{2}-\d{2}$/.test(k || '') && Math.abs((at(k, '12:00') - now) / 864e5) < 400 ? k : ''; };
        const okTime = function (x) { return /^([01]\d|2[0-3]):[0-5]\d$/.test(x || '') ? x : ''; };
        const whoId = function (n) { const p = n ? vFind(h, n) : null; return p ? p.id : ''; };
        const items = [];
        (d.events || []).slice(0, 12).forEach(function (e, i) { const dt = okDate(e.date); if (!e.title) return;
          if (/^\d{4}-\d{2}-\d{2}$/.test(e.date || '') && e.date < today) return;
          if (!dt) { items.push({ id: 't' + i + 'e', type: 'todo', title: String(e.title).slice(0, 90), due: '', who: whoId(e.who), note: String(e.note || 'Date not clear in the email').slice(0, 160), state: 'new' }); return; }
          if (dt < today) return;
          items.push({ id: 'e' + i, type: 'event', title: String(e.title).slice(0, 90), date: dt, time: okTime(e.time), end: okTime(e.end), who: whoId(e.who), note: String(e.note || '').slice(0, 160), state: 'new' }); });
        (d.todos || []).slice(0, 12).forEach(function (x, i) { if (!x.title) return;
          items.push({ id: 't' + i, type: 'todo', title: String(x.title).slice(0, 90), due: okDate(x.due), who: whoId(x.who), note: String(x.note || '').slice(0, 160), state: 'new' }); });
        const doc = { status: items.length ? 'new' : 'none', kind: String(d.kind || 'other').slice(0, 20), sender: String(d.from || '').slice(0, 60), summary: String(d.summary || '').slice(0, 300), at: fromEmail.at, fromEmail: fromEmail, items: items };
        patch(path + '/' + id, doc); seen[id] = 1; added++; doc._id = id; if (items.length) fresh.push(doc);
      }
      t.addLabel(label);
    }
  } catch (e) { err = String(e && e.message || e).slice(0, 240); if (/permission|authori[sz]/i.test(err)) err = 'The helper needs permission for Gmail: run inboxCheckNow once in the helper (⚙️ → 🧰 Helpers).'; }
  mailDone(props, 'INBOX', h, now, err);
  patch('households/' + h._id, { inboxHelper: { lastRun: now.getTime(), error: err, added: (prev.added || 0) + added, version: HELPER_VERSION } });
  return fresh;
}
function inboxArrivals(h, fresh, msgs) {
  if (!fresh.length) return; const devices = h.devices || {};
  fresh.forEach(function (d) { const n = d.items.length;
    Object.keys(devices).forEach(function (hash) { if (!devices[hash] || !devices[hash].token) return;
      msgs.push({ device: hash, key: 'inbox|' + d._id + '|' + hash, tag: 'inbox', title: '📥 ' + (d.sender || d.fromEmail.subject || 'Family inbox'), body: n + (n === 1 ? ' thing' : ' things') + ' to check: ' + d.items.slice(0, 3).map(function (i) { return i.title; }).join(', ') }); }); });
}
/* run this by hand in the editor to read the family inbox straight away (and to approve Gmail the first time) */
function inboxCheckNow() { const props = PropertiesService.getScriptProperties();
  for (const h of listDocs('households')) { const out = inboxTick(h, props, new Date(), true); Logger.log((h.inboxEmail || '(no inbox address set)') + ': ' + out.length + ' new emails with things in them. ' + ((getDoc('households/' + h._id).inboxHelper || {}).error || 'OK')); } }

/* ================= Family messages =================
   The app writes each message to households/{id}/msgs. This sends the notification: to the phones signed in as the person
   it is for (or everyone else, for the family group). The app asks for this the moment a message is sent; the 5-minute tick is the backstop. */
function msgPush(h, pre) {
  const path = 'households/' + h._id + '/msgs', devices = h.devices || {}, people = h.people || [], now = Date.now(); let n = 0;
  // only messages newer than the last one handled are read (10 minutes of overlap covers a phone whose clock is a little off)
  const props = PropertiesService.getScriptProperties(), ck = 'MSG_AT_' + h._id, last = Number(props.getProperty(ck) || 0);
  const recent = Array.isArray(pre) ? pre : runQuery('households/' + h._id, 'msgs', fOp('at', 'GREATER_THAN', Math.max(last - 10 * 60e3, now - 12 * 3600e3)));
  const newest = recent.reduce(function (t, m) { return Math.max(t, Number(m.at) || 0); }, last);
  if (newest > last) props.setProperty(ck, String(Math.min(newest, now)));
  const waiting = recent.filter(function (m) { return !m.pushed && m.at && now - m.at < 12 * 3600e3; }).sort(function (a, b) { return a.at - b.at; });
  waiting.forEach(function (m) {
    const from = people.find(function (p) { return p.id === m.from; }) || { name: 'Family' };
    // written by a linked account: it must speak as itself, or no alert goes out
    if (m.byE && String(from.email || '').toLowerCase() !== String(m.byE).toLowerCase()) { patch(path + '/' + m._id, { pushed: now }); return; }
    const to = m.th === 'fam' ? people.filter(function (p) { return p.id !== m.from && p.id !== 'all'; }) : people.filter(function (p) { return String(m.th).split('|').indexOf(p.id) >= 0 && p.id !== m.from; });
    const off = m.th === 'fam' ? (h.chatOff || []).map(function (e) { return String(e).toLowerCase(); }) : [];   // linked accounts left out of the Family chat
    const emails = to.map(function (p) { return String(p.email || '').toLowerCase(); }).filter(function (e) { return e && off.indexOf(e) < 0; });
    Object.keys(devices).forEach(function (hash) { const dev = devices[hash]; if (!dev || !dev.token || !dev.email || emails.indexOf(String(dev.email).toLowerCase()) < 0) return;
      try { send(h, hash, '💬 ' + from.name + (m.th === 'fam' ? ' → Family' : ''), String(m.text || '').slice(0, 180), 'msg-' + m.th); n++; } catch (e) {} });
    patch(path + '/' + m._id, { pushed: now });
  });
  return n;
}

/* ================= 4.0 Voice and video calls =================
   The call itself runs between the two screens. The app writes a short record to households/{id}/calls and asks for this
   the moment someone calls: it sends "… is calling" to the phones of the person being called (everyone else, for a call
   to Family), so a phone with the app closed still rings. Tapping the alert opens the app on the ringing call. */
function callRing(h, b) {
  const id = String(b.id || '').replace(/[^\w-]/g, ''); if (!id) return { error: 'No call' };
  const c = getDoc('households/' + h._id + '/calls/' + id); if (!c || c.st !== 'ring') return { ok: true, sent: 0 };
  const people = h.people || [], devices = h.devices || {}, from = people.find(function (p) { return p.id === c.from; }) || { name: 'Someone' }; let n = 0;
  const to = c.to === 'fam' ? people.filter(function (p) { return p.id !== c.from && p.id !== 'all'; }) : people.filter(function (p) { return p.id === c.to; });
  const linked = c.to === 'fam' ? (h.limited || []).map(function (e) { return String(e).toLowerCase(); }) : [];   // a call to Family rings this household only, not a linked one
  const emails = to.map(function (p) { return String(p.email || '').toLowerCase(); }).filter(function (e) { return e && linked.indexOf(e) < 0; });
  Object.keys(devices).forEach(function (hash) { const dev = devices[hash]; if (!dev || !dev.token || !dev.email || emails.indexOf(String(dev.email).toLowerCase()) < 0) return;
    try { send(h, hash, '📞 ' + from.name + ' is calling' + (c.to === 'fam' ? ' the family' : ''), (c.kind === 'video' ? 'Video call' : 'Voice call') + ' · tap to answer', 'call-' + String(c.th || '')); n++; } catch (e) {} });
  return { ok: true, sent: n };
}
/* Optional relay for calls that can't connect directly (some hotel and office Wi-Fi blocks direct calls). Off unless the
   two Script properties TURN_KEY_ID and TURN_KEY_TOKEN are set (a Cloudflare Realtime TURN key). The key stays here;
   each screen is handed a pass that lasts a day. */
function callIce() {
  const p = PropertiesService.getScriptProperties(), id = p.getProperty('TURN_KEY_ID'), tok = p.getProperty('TURN_KEY_TOKEN');
  if (!id || !tok) return { ok: true, ice: [], ttl: 43200 };
  const r = UrlFetchApp.fetch('https://rtc.live.cloudflare.com/v1/turn/keys/' + encodeURIComponent(id) + '/credentials/generate-ice-servers', { method: 'post', contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + tok }, payload: JSON.stringify({ ttl: 86400 }), muteHttpExceptions: true });
  if (r.getResponseCode() >= 300) return { ok: false, ice: [], ttl: 3600, error: 'Relay: ' + r.getResponseCode() };
  const ice = (JSON.parse(r.getContentText()).iceServers || []).filter(function (s) { return s && s.username; }).map(function (s) {
    return { urls: [].concat(s.urls || []).filter(function (u) { return !/:53(\?|$)/.test(u); }), username: s.username, credential: s.credential }; });
  return { ok: true, ice: ice, ttl: 86400 };
}

/* ================= Bills by email =================
   Bills sent (or forwarded) to the family's bills address (a plus address of THIS Gmail account, e.g. you+bills@gmail.com,
   set in the app: Bills → Setup) are read once a day (and when the app asks). Gemini reads the email and any PDF, the PDF is saved to
   Google Drive (“Household Bills/_To file”), and the bill appears in the app as “check it”. When you confirm it there,
   the app says which folder it goes in and this moves and renames the file. A Google Sheet register is kept up to date. */
const BILL_CATS = ['Power', 'Gas', 'Internet', 'Phone', 'Water', 'Rates', 'Insurance', 'Car', 'Mortgage', 'Rent', 'Subscriptions', 'Medical', 'School', 'Childcare', 'Credit card', 'Other'];
const money = c => '$' + (Number(c || 0) / 100).toFixed(2);
const normB = x => String(x || '').toLowerCase().replace(/[^a-z0-9]/g, '');
function getDoc(path) {
  const r = UrlFetchApp.fetch(BASE + '/' + path, { headers: headers(), muteHttpExceptions: true }); rd(1);
  if (r.getResponseCode() === 404) return null;
  if (r.getResponseCode() !== 200) throw new Error('Reading ' + path + ': ' + r.getResponseCode());
  const d = JSON.parse(r.getContentText()); const o = dec({ mapValue: { fields: d.fields || {} } }); o._id = d.name.split('/').pop(); return o;
}
function geminiKey(h) { const s = getDoc('households/' + h._id + '/secrets/ai'); return (s && s.gemini) || PropertiesService.getScriptProperties().getProperty('GEMINI_KEY') || ''; }
/* The family picks the AI in the app (⚙️ → ✨ AI): Gemini or Claude, plus Claude's model and effort. Both keys live in the
   family's secrets doc. aiCall is the one door every feature uses; if Claude fails and a Gemini key exists, Gemini answers. */
function setKeys(h, s) { s = s || {}; h._keys = { gemini: s.gemini || PropertiesService.getScriptProperties().getProperty('GEMINI_KEY') || '', claude: s.claude || '' }; }
function aiKeys(h) { if (!h._keys) setKeys(h, getDoc('households/' + h._id + '/secrets/ai')); return h._keys; }
function aiReady(h) { const k = aiKeys(h); return !!(k.gemini || (h.aiProv === 'claude' && k.claude)); }
function aiCall(h, parts, quick) {
  const k = aiKeys(h);
  // Alexa gives a skill about 8 seconds. Claude takes 10 to 16 s here, Gemini 2 to 5 s, so voice requests go to Gemini first when there is a key.
  if (quick && k.gemini) { try { return gemini(k.gemini, parts, quick); } catch (e) { if (!(h.aiProv === 'claude' && k.claude)) throw e; console.log('Gemini failed for voice, using Claude: ' + e.message); } }
  if (h.aiProv === 'claude' && k.claude) { try { return claude(k.claude, h, parts, quick); } catch (e) { if (!k.gemini) throw e; console.log('Claude failed, using Gemini: ' + e.message); } }
  if (!k.gemini) { const e = new Error('No AI key is set up'); e.gemini = true; throw e; }
  return gemini(k.gemini, parts, quick);
}
const CLAUDE_OK = ['claude-haiku-5-5', 'claude-sonnet-5-5', 'claude-opus-5-5', 'claude-fable-5-2'];
function claude(key, h, parts, quick) {
  // voice answers (quick) must be back inside Alexa's 8 seconds: always the fastest model on low effort
  const model = quick ? 'claude-haiku-5-5' : (CLAUDE_OK.indexOf(h.aiClaudeModel) >= 0 ? h.aiClaudeModel : 'claude-sonnet-5-5');
  const effort = quick ? 'low' : (['low', 'medium', 'high'].indexOf(h.aiEffort) >= 0 ? h.aiEffort : 'low');
  const content = [];
  parts.forEach(function (p) { if (p.inline_data) { const mt = p.inline_data.mime_type;
    if (mt === 'application/pdf') content.push({ type: 'document', source: { type: 'base64', media_type: mt, data: p.inline_data.data } });
    else if (/^image\/(jpeg|png|gif|webp)$/.test(mt)) content.push({ type: 'image', source: { type: 'base64', media_type: mt, data: p.inline_data.data } }); } });
  content.push({ type: 'text', text: parts.filter(function (p) { return p.text; }).map(function (p) { return p.text; }).join('\n\n') + '\n\nReply with the JSON only: no other words, no code fence.' });
  const call = function (withEffort) { const body = { model: model, max_tokens: quick ? 2000 : 8000, messages: [{ role: 'user', content: content }] }; if (withEffort) body.output_config = { effort: effort };
    return UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', { method: 'post', contentType: 'application/json', headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' }, muteHttpExceptions: true, payload: JSON.stringify(body) }); };
  let r = call(true);
  if (r.getResponseCode() === 400 && /effort|output_config/i.test(r.getContentText())) r = call(false);
  if (r.getResponseCode() !== 200) { const e = new Error('Claude ' + r.getResponseCode() + ': ' + r.getContentText().slice(0, 160)); e.gemini = true; throw e; }
  const txt = (JSON.parse(r.getContentText()).content || []).filter(function (b) { return b.type === 'text'; }).map(function (b) { return b.text; }).join('').replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, '').trim();
  const m = txt.match(/[\{\[][\s\S]*[\}\]]/); return m ? m[0] : txt;
}
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
  if (r.getResponseCode() !== 200 && /no longer available|update your code to use/i.test(r.getContentText())) {   // retired for new users: Google names the replacement
    const nx = (r.getContentText().match(/use models\/(gemini-[\w.-]*\w)/i) || [])[1];
    if (nx) { model = nx; props.setProperty('GEMINI_MODEL', model); r = call(model, quick); if (quick && r.getResponseCode() === 400 && /think/i.test(r.getContentText())) r = call(model, false); }
  }
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
  let bills = listDocs(path), err = '', added = 0, mail = false; const fresh = [];
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
    // 3) new emails, once a day (or when the app asks)
    if (force || mailDue(props, 'BILL', h, now)) {
      mail = true;
      const seen = {}; bills.forEach(b => seen[b._id] = 1);
      const key = aiReady(h);
      const threads = GmailApp.search('to:' + addr + ' newer_than:30d', 0, 20);
      if (threads.length && !key) throw new Error('No AI key yet: add it in the app (⚙️ → ✨ AI)');
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
          let d; try { d = JSON.parse(aiCall(h, parts) || '{}'); } catch (e) { if (e.gemini) throw e; d = { is_bill: true, summary: 'Couldn\'t read this one: open the email.' }; }
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
  if (mail) mailDone(props, 'BILL', h, now, err);
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
  let h; try { h = listDocs('households').filter(x => String(x.voiceKey || '') === key)[0]; }
  catch (err) { const full = /429|quota/i.test(String(err)), say = full ? 'The family database has reached its free limit for today. Try again later.' : 'I can’t reach the family database right now. Try again in a minute.'; return out({ error: say, speech: say }); }
  if (!h) return out({ error: 'not allowed' });
  const t0 = Date.now(), act = String(b.action || '');
  try { const res = voiceDo(h, act, b); noteVoice(h, b, Date.now() - t0, false); return out(res); }
  catch (err) { noteVoice(h, b, Date.now() - t0, true); return out({ speech: 'Sorry, something went wrong at my end. ' + String(err && err.message || err).slice(0, 80) }); }
  finally { try { readsFlush(PropertiesService.getScriptProperties(), new Date(), 'P'); } catch (e) {} }
}
const VOICE_MAX = 55;                                     // keep spoken answers short
function vPeople(h) { return (h.people || []).filter(p => p.id !== 'all'); }
// every name a person goes by: their own, what the kids call them, and the "also called" list from Who's who
function vAka(p) { const role = String(p.role || '').trim(), r = role && role.split(/\s+/).length <= 2 && !/[,·(]/.test(role) ? [role] : [];
  return [p.name, p.nick].concat(r, String(p.aka || '').split(',')).map(function (x) { return String(x || '').trim(); }).filter(Boolean); }
function vFind(h, name) {
  const n = normB(name); if (!n) return null;
  const all = vPeople(h);
  return all.filter(p => vAka(p).some(a => normB(a) === n))[0] || all.filter(p => normB(p.name).indexOf(n) === 0 || n.indexOf(normB(p.name)) === 0)[0] ||
    // Alexa often mishears a name by a letter or two ("area" for Aria), so accept a close match
    only(all.filter(p => vAka(p).some(a => { const b = normB(a); return b.length >= 4 && n.length >= 4 && vDist(b, n) <= 1; }))) ||
    only(all.filter(p => vAka(p).some(a => { const b = normB(a); return b.length >= 3 && vSound(b) === vSound(n); }))) || null;
}
// only trust a close match when it points at exactly one person
function only(list) { return list.length === 1 ? list[0] : null; }
function vDist(a, b) { if (a === b) return 0; if (Math.abs(a.length - b.length) > 1) return 9;
  const d = []; for (let i = 0; i <= a.length; i++) { d[i] = [i]; } for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i-1][j] + 1, d[i][j-1] + 1, d[i-1][j-1] + (a[i-1] === b[j-1] ? 0 : 1));
  return d[a.length][b.length]; }
// A rough "sounds like" key: drops vowels after the first letter, so Aria, Area, Arya and Ariah all match
function vSound(w) { return w.charAt(0) + w.slice(1).replace(/[aeiouyh]/g, '').replace(/(.)\1+/g, '$1'); }
// Who's who, as plain lines for the AI: who each person is and the names the family uses for them
function vWho(h) {
  const lines = vPeople(h).map(function (p) { const aka = vAka(p).slice(1);
    return '- ' + p.name + (p.role ? ': ' + p.role : '') + (p.traveller ? ' (flies for work as cabin crew, often away)' : '') + (aka.length ? '. Also called: ' + aka.join(', ') : ''); });
  return "WHO'S WHO (a nickname in a calendar entry means that person; \"at X's\" means at their place):\n" + lines.join('\n') + (h.famNote ? '\n' + String(h.famNote).slice(0, 600) : '');
}
// does this calendar entry involve this person? Ticked for them, for everyone, or names them in the title
function vInvolves(e, p) {
  const w = e.whos || []; if (!w.length || w.indexOf('all') >= 0 || w.indexOf(p.id) >= 0) return true;
  const t = ' ' + String(e.title || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ') + ' ';
  return vAka(p).some(function (a) { const k = a.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); return k.length > 1 && t.indexOf(' ' + k + ' ') >= 0; });
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
/* One voice request reads the calendar once, together with whatever else it needs, instead of the whole list for every day it looks at.
   vPrep loads the entries dated fromKey..toKey plus the repeating ones, and the AI keys, in parallel with any extra reads asked for. */
function vPrep(h, fromKey, toKey, extra) {
  const hp = 'households/' + h._id, x = h._ex || (h._ex = { rep: null, by: {} });
  const specs = [{ kind: 'query', parent: hp, col: 'events', where: fAnd([fOp('date', 'GREATER_THAN_OR_EQUAL', fromKey), fOp('date', 'LESS_THAN_OR_EQUAL', toKey)]) }];
  const wantRep = !x.rep, wantKeys = !h._keys;
  if (wantRep) specs.push({ kind: 'query', parent: hp, col: 'events', where: fOp('rpt.f', 'IN', ['D', 'W', 'M', 'Y']) });
  if (wantKeys) specs.push({ kind: 'doc', path: hp + '/secrets/ai' });
  const nx = specs.length; (extra || []).forEach(function (e) { specs.push(e); });
  const r = fetchMany(specs);
  for (let d = kd(fromKey); keyOf(d) <= toKey; d = addDays(d, 1)) x.by[keyOf(d)] = [];
  r[0].forEach(function (e) { if (x.by[e.date]) x.by[e.date].push(e); });
  let i = 1; if (wantRep) x.rep = r[i++]; if (wantKeys) setKeys(h, r[i]);
  return r.slice(nx);
}
function vEventsOn(h, key) {
  if (!h._ex || !(key in h._ex.by)) vPrep(h, key, keyOf(addDays(kd(key), 9)));
  const seen = {}, evs = [];
  (h._ex.by[key] || []).concat(h._ex.rep || []).forEach(function (e) { if (seen[e._id] || e.priv || !occursOn(e, key)) return; seen[e._id] = 1; evs.push(e); });
  return evs.sort(function (a, c) { return String(a.time || '00:00').localeCompare(String(c.time || '00:00')); });
}
function vSay(e, h) {
  const who = (e.whos || []).filter(function (w) { return w !== 'all'; }).map(function (w) { const p = vPeople(h).filter(function (x) { return x.id === w; })[0]; return p ? p.name : ''; }).filter(Boolean);
  return (e.time ? fmt12(e.time) + ', ' : '') + e.title + (who.length ? ' for ' + vList(who) : '');
}
function voiceDo(h, action, b) {
  const now = new Date(), hid = h._id, today = keyOf(now);
  const newId = function () { return 'v' + now.getTime().toString(36) + Math.random().toString(36).slice(2, 7); };
  if (action === 'update') { const u = selfUpdate(PropertiesService.getScriptProperties(), new Date(), true); return { ok: u.ok, version: HELPER_VERSION, update: u, speech: u.ok ? (u.to ? 'Updated to version ' + u.to + '.' : 'Already up to date.') : u.error }; }
  if (action === 'msg_push') { return { ok: true, sent: msgPush(h) }; }
  if (action === 'call_ring') return callRing(h, b);
  if (action === 'call_ice') return callIce();
  if (action === 'msg_send') return voiceMsgSend(h, b, now);
  if (action === 'photos') return photosPage(b);
  if (action === 'photo_add') return photoAdd(b);
  if (action === 'photo_fetch') return photoFetch(b);
  if (action === 'photo_del') return photoDel(b);
  if (action === 'doc_save') return docSave(h, b);
  if (action === 'msg_read') return voiceMsgRead(h, b, now);
  if (action === 'health') { const pr = PropertiesService.getScriptProperties(), st = hRead(pr, h._id); st.readsAt = 0; hSave(pr, h._id, st); return { ok: true, health: healthAfterRun(h, pr, new Date(), '', {}) }; }
  if (action === 'bills_tidy' || action === 'bills_check') { const bl0 = billsTick(h, PropertiesService.getScriptProperties(), new Date(), action === 'bills_check'), nw = bl0.filter(function (x) { return x._new; }).length; return { ok: true, added: nw, speech: action === 'bills_check' ? (nw ? nw + ' new' : 'Nothing new') : 'Done' }; }
  if (action === 'inbox_check') { const fresh = inboxTick(h, PropertiesService.getScriptProperties(), new Date(), true); return { ok: true, added: fresh.length, speech: fresh.length ? fresh.length + ' new' : 'Nothing new' }; }
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
    try { PropertiesService.getScriptProperties().deleteProperty('AGENDA|' + hid); } catch (e) {}
    return { speech: 'Put ' + title + ' in the calendar for ' + vDay(key, now) + (time ? ' at ' + fmt12(time) : '') + (p ? ', for ' + p.name : '') + '.' };
  }
  if (action === 'agenda') {
    // 2.5 worked out ahead on the last run, unless the calendar has changed since (the app stamps evAt when it does)
    const ready = agendaReady(h, now), ak = vWeek(b.date) ? 'week' : vDate(b.date, now);
    if (ready && ready[ak === keyOf(addDays(now, -1)) ? today : ak]) return { speech: ready[ak === keyOf(addDays(now, -1)) ? today : ak], ready: true };
    if (vWeek(b.date)) {                                   // "what's on this week"
      const lines = [];
      for (let i = 0; i < 7; i++) { const k = keyOf(addDays(now, i)), e = vEventsOn(h, k); if (e.length) lines.push(vDay(k, now) + ', ' + vList(e.slice(0, 3).map(function (x) { return vSay(x, h); }))); }
      return { speech: lines.length ? 'This week: ' + lines.join('. ') + '.' : 'Nothing in the calendar for the next week.' };
    }
    let key = vDate(b.date, now);
    // Alexa works out "today" on the device's own clock; one set to an overseas time zone sends yesterday's date
    if (key === keyOf(addDays(now, -1))) key = keyOf(now);
    const evs = vEventsOn(h, key);
    if (!evs.length) return { speech: 'Nothing in the calendar for ' + vDay(key, now) + '.' };
    return { speech: vDay(key, now).charAt(0).toUpperCase() + vDay(key, now).slice(1) + ': ' + vList(evs.slice(0, 6).map(function (e) { return vSay(e, h); })) + '.' };
  }
  if (action === 'where') {
    const tp = vPeople(h).filter(function (p) { return p.traveller; })[0];
    const asked = vFind(h, b.person);
    if (asked && tp && asked.id !== tp.id) return { speech: 'Only ' + tp.name + "'s flights are tracked, so I can't say where " + asked.name + ' is.' };
    const nm = tp ? tp.name : 'She';
    const fl = (h._fl || recentFlights('households/' + hid, now)).filter(function (f) { return !tp || f.who === tp.id; });
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
  if (action === 'wake') {
    const ppl = vPeople(h);
    const p = /^(me|myself)$/i.test(String(b.person || '').trim()) ? vMe(h, b) : (vFind(h, b.person) || (ppl.length === 1 ? ppl[0] : null));
    if (!p) return { speech: 'Who am I waking up? ' + vList(ppl.map(function (x) { return x.name; })) + '?', ask: 'person' };
    const wk = 'WAKEV|' + hid + '|' + p.id, props = PropertiesService.getScriptProperties(), styleWanted = WAKE_STYLES[b.style] ? b.style : (WAKE_STYLES[h.wakeStyle] ? h.wakeStyle : 'funny');
    if (!b.fresh) { let ready = null; try { ready = JSON.parse(props.getProperty(wk) || 'null'); } catch (e) {}
      if (ready && ready.day === today && ready.song && ready.song.style === styleWanted) { props.setProperty(wk, JSON.stringify({ day: today, used: true })); return ready.song; } }
    return wakeSong(h, p, now, b);
  }
  if (action === 'remember') {
    const text = String(b.text || '').trim(); if (!text) return { speech: 'What should I remember?', ask: 'text' };
    patch('households/' + hid + '/memory/' + newId(), { text: text, title: '', at: now.getTime(), src: 'voice' });
    return { speech: "I'll remember that." };
  }
  if (action === 'ask') {
    const q = String(b.q || '').trim(); if (!q) return { speech: 'What would you like to know?', ask: 'q' };
    const gk = aiReady(h); if (!gk) return { speech: 'The family AI key is not set up yet. Add it in the app, under settings, A I.' };
    const ctx = voiceContext(h, now);
    const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][now.getDay()];
    const prompt = 'You are the family\'s helper, answering out loud through an Echo speaker in Auckland, New Zealand. Today is ' + dayName + ', ' + today + ', and the time is ' + fmtTime(now) + '. '
      + 'Answer in at most ' + VOICE_MAX + ' words, as one or two spoken sentences. No lists, no markdown, no emoji, no headings. Plain speech only, New Zealand English. '
      + 'Use the who\'s who to work out who is meant by a nickname or a relationship (for example my mum, Grandma). Use ONLY the facts below. If the answer is not there, say so in one sentence and suggest where to look in the app.\n\n' + ctx + '\n\nQuestion: ' + q
      + '\n\nReturn JSON only: {"speech":"..."}';
    const txt = aiCall(h, [{ text: prompt }], true);
    let sp = ''; try { sp = JSON.parse(String(txt).replace(/^```(?:json)?|```$/g, '').trim()).speech; } catch (x) { sp = String(txt).replace(/[#*`]/g, '').slice(0, 300); }
    return { speech: String(sp || 'Sorry, I did not catch that.').replace(/[#*`]/g, '') };
  }
  return { speech: 'I am not sure what to do with that.' };
}
/* 2.5 "what's on today / tomorrow / this week" are worked out ahead, so Alexa answers at once. They are worked out again
   when the day changes or the calendar changes (the app stamps evAt on the family's record whenever an entry changes,
   and an entry added by voice clears them), so an answer is never older than the calendar. */
function agendaSpeeches(h, now) {
  const today = keyOf(now), tom = keyOf(addDays(now, 1)), out = { day: today, evAt: Number(h.evAt || 0), at: now.getTime() };
  vPrep(h, today, keyOf(addDays(now, 7)));
  [today, tom].forEach(function (k) { const evs = vEventsOn(h, k);
    out[k] = evs.length ? vDay(k, now).charAt(0).toUpperCase() + vDay(k, now).slice(1) + ': ' + vList(evs.slice(0, 6).map(function (e) { return vSay(e, h); })) + '.' : 'Nothing in the calendar for ' + vDay(k, now) + '.'; });
  const lines = []; for (let i = 0; i < 7; i++) { const k = keyOf(addDays(now, i)), e = vEventsOn(h, k); if (e.length) lines.push(vDay(k, now) + ', ' + vList(e.slice(0, 3).map(function (x) { return vSay(x, h); }))); }
  out.week = lines.length ? 'This week: ' + lines.join('. ') + '.' : 'Nothing in the calendar for the next week.';
  return out;
}
function agendaPrep(h, props, now) {
  if (now.getHours() < 5) return false;
  const k = 'AGENDA|' + h._id; let have = null; try { have = JSON.parse(props.getProperty(k) || 'null'); } catch (e) {}
  if (have && have.day === keyOf(now) && Number(have.evAt || 0) === Number(h.evAt || 0)) return false;
  const a = agendaSpeeches(h, now); const j = JSON.stringify(a); if (j.length < 8500) props.setProperty(k, j); return true;
}
function agendaReady(h, now) {
  let a = null; try { a = JSON.parse(PropertiesService.getScriptProperties().getProperty('AGENDA|' + h._id) || 'null'); } catch (e) {}
  return a && a.day === keyOf(now) && Number(a.evAt || 0) === Number(h.evAt || 0) ? a : null;
}
/* 3.2 messages by voice: "Alexa, ask big sis to tell Mummy I love you". The message is from whoever Alexa recognises,
   else the person the family chose in the app (usually Aria). It is pushed to the phones at once. */
function voiceMsgFrom(h, b, to) {
  const ppl = vPeople(h), id = (h.voiceIds || {})[b.person_id];
  const p = ppl.filter(function (x) { return x.id === id; })[0] || ppl.filter(function (x) { return x.id === h.alexaFrom; })[0] || ppl.filter(function (x) { return !x.email && x.id !== to; })[0] || ppl[0];
  return p || null;
}
function voiceMsgSend(h, b, now) {
  const text = String(b.text || '').replace(/^(that|to say|say)\s+/i, '').trim().slice(0, 600);
  if (!text) return { speech: 'What should I say?', ask: 'msg' };
  const ppl = vPeople(h), to = b.to === 'fam' ? null : ppl.filter(function (p) { return p.id === b.to; })[0] || vFind(h, b.to);
  if (b.to !== 'fam' && !to) return { speech: 'I am not sure who that is for.' };
  const from = voiceMsgFrom(h, b, to && to.id); if (!from) return { speech: 'Add the family in the app first.' };
  const th = !to || to.id === from.id ? 'fam' : [from.id, to.id].sort().join('|');
  const id = 'v' + now.getTime().toString(36) + Math.random().toString(36).slice(2, 6), m = { th: th, from: from.id, text: text.charAt(0).toUpperCase() + text.slice(1), at: now.getTime(), seen: [from.id], via: 'alexa' };
  // a linked account (someone with their own household, like Masako) sees only messages marked with its address
  const low = function (e) { return String(e || '').toLowerCase(); }, lim = (h.limited || []).map(low), off = (h.chatOff || []).map(low);
  const em = (h.people || []).filter(function (p) { return p.id !== 'all' && p.email && lim.indexOf(low(p.email)) >= 0 && (th === 'fam' ? off.indexOf(low(p.email)) < 0 : th.split('|').indexOf(p.id) >= 0); }).map(function (p) { return low(p.email); });
  if (em.length) m.em = em;
  patch('households/' + h._id + '/msgs/' + id, m);
  let sent = 0; try { m._id = id; sent = msgPush(h, [m]); } catch (e) { Logger.log('Voice message push: ' + e); }
  return { speech: 'Sent to ' + (to ? (to.nick || to.name) : 'the family') + (sent ? '.' : '. It will be waiting in Family Screen.'), sent: sent };
}
function voiceMsgRead(h, b, now) {
  const ppl = vPeople(h), named = b.person ? vFind(h, b.person) : null, me = named || voiceMsgFrom(h, b, '');
  if (!me) return { speech: 'Add the family in the app first.' };
  const list = runQuery('households/' + h._id, 'msgs', fOp('at', 'GREATER_THAN', now.getTime() - 2 * 864e5))
    .filter(function (m) { return m.from !== me.id && (m.th === 'fam' || String(m.th).split('|').indexOf(me.id) >= 0); })
    .sort(function (a, c) { return a.at - c.at; }).slice(-3);
  if (!list.length) return { speech: 'No new messages for ' + me.name + ' in the last two days.' };
  const nameOf = function (id) { const p = ppl.filter(function (x) { return x.id === id; })[0]; return p ? (p.nick || p.name) : 'Someone'; };
  return { speech: 'For ' + me.name + ': ' + list.map(function (m) { return nameOf(m.from) + ' said, ' + xmlSafe(m.text).slice(0, 140) + (/[.!?]$/.test(m.text) ? '' : '.'); }).join(' ') };
}
/* ---------- the wake-up song: a fresh silly rhyme about that person's actual day ---------- */
const WAKE_STYLES = { funny: 'silly and cheerful, the kind a seven-year-old giggles at', pirate: 'in a jolly pirate voice, with an arr or two', trailer: 'like an over-the-top movie trailer announcer', gentle: 'soft, warm and kind, like a cuddle' };
function wakeWeather(h) {
  try {
    const cache = CacheService.getScriptCache(), lat = +h.homeLat || -36.91, lon = +h.homeLon || 174.65, ck = 'wx|' + lat + '|' + lon;
    const hit = cache.get(ck); if (hit) return hit;
    const r = UrlFetchApp.fetch('https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lon + '&daily=weather_code,temperature_2m_max,precipitation_probability_max&timezone=auto&forecast_days=1', { muteHttpExceptions: true });
    const d = JSON.parse(r.getContentText()).daily, c = d.weather_code[0], hi = Math.round(d.temperature_2m_max[0]), rain = d.precipitation_probability_max[0];
    const sky = c === 0 ? 'sunny' : c <= 2 ? 'mostly sunny' : c === 3 ? 'cloudy' : c <= 48 ? 'foggy' : c <= 57 ? 'drizzly' : c <= 67 ? 'rainy' : c <= 77 ? 'snowy' : c <= 82 ? 'showery' : 'stormy';
    const out = sky + ', a high of ' + hi + ' degrees' + (rain >= 50 ? ', and take a raincoat' : '');
    cache.put(ck, out, 1800); return out;
  } catch (e) { return ''; }
}
const xmlSafe = function (t) { return String(t || '').replace(/[#*`<>]/g, '').replace(/&/g, 'and').replace(/\s+/g, ' ').trim(); };
/* Alexa gives a skill about 8 seconds and a freshly written verse can take longer, so each person's next verse is written ahead of time
   (from 4am, and again a few minutes after one is used) and played at once when asked. If none is ready it is written on the spot. */
function wakePrep(h, props, now) {
  if (now.getHours() < 4) return 0; const today = keyOf(now), todo = vPeople(h).filter(function (p) {
    let have = null; try { have = JSON.parse(props.getProperty('WAKEV|' + h._id + '|' + p.id) || 'null'); } catch (e) {}
    return !(have && have.day === today && !have.used); });
  if (!todo.length || !aiReady(h)) return 0; let made = 0;
  for (const p of todo) {
    const song = wakeSong(h, p, now, { slow: true });
    if (song.aiNote) { Logger.log('Wake verse for ' + p.name + ' not stored: ' + song.aiNote); continue; }   // a built-in rhyme is not kept: try again next run
    props.setProperty('WAKEV|' + h._id + '|' + p.id, JSON.stringify({ day: today, at: now.getTime(), song: { speech: song.speech, ssml: song.ssml, verse: song.verse, then: song.then, name: song.name, style: song.style } })); made++;
  }
  return made;
}
function wakeSong(h, p, now, b) {
  const hid = h._id, today = keyOf(now);
  const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][now.getDay()];
  const tomorrowK = keyOf(addDays(now, 1)), tp0 = vPeople(h).filter(function (x) { return x.traveller; })[0];
  h._fl = vPrep(h, today, tomorrowK, tp0 ? [{ kind: 'query', parent: 'households/' + hid, col: 'flights', where: fOp('end', 'GREATER_THAN_OR_EQUAL', new Date(now.getTime() - 3 * 864e5).toISOString()) }] : [])[0] || [];
  const all = vEventsOn(h, today), mine = all.filter(function (e) { return vInvolves(e, p); });
  const others = all.filter(function (e) { return mine.indexOf(e) < 0; }), tmrw = vEventsOn(h, keyOf(addDays(now, 1)));
  const line = function (e) { return vSay(e, h); };
  const first = mine.filter(function (e) { return e.time; })[0] || mine[0];
  const tp = vPeople(h).filter(function (x) { return x.traveller; })[0];
  let where = ''; if (tp && tp.id !== p.id) { try { where = voiceDo(h, 'where', {}).speech; } catch (e) {} }
  const wx = wakeWeather(h);
  const style = WAKE_STYLES[b.style] ? b.style : (WAKE_STYLES[h.wakeStyle] ? h.wakeStyle : 'funny');
  const then = [wx ? 'Today is ' + wx + '.' : '', mine.length ? 'On today: ' + vList(mine.slice(0, 3).map(function (e) { return e.title + (e.time ? ' at ' + fmt12(e.time) : ''); })) + '.' : 'Nothing in the calendar today.'].filter(Boolean).join(' ');
  // rhymes that always work, for when the AI is slow or not set up: a different one each time
  const N = p.name, F = first ? first.title.replace(/[.!?]+$/, '') : '';
  const spare = [
    ['Wakey wakey, ' + N + ', open up your eyes,', 'It is ' + dayName + ' morning, time to rise!', 'The birds are up, the kettle too,', 'And all of us are waiting for you!'],
    ['Rise and shine, ' + N + ', the night is done,', dayName + ' is here and so is the fun!', 'Wiggle your toes and stretch up high,', 'Then wave your sleepy dreams goodbye!'],
    ['Knock knock, ' + N + ', it is ' + dayName + ' calling,', 'Out of that bed with no more stalling!', 'Your pillow says it needs a rest,', 'So up you get and do your best!'],
    ['Good morning, ' + N + ', the sun says hi,', 'Your blanket is sad but do not cry!', 'Feet on the floor, one, two, three,', 'Breakfast is waiting, come and see!'],
    ['Hello, hello, is ' + N + ' in there?', 'I see a nose and sleepy hair!', 'It is ' + dayName + ', a brand new day,', 'So hop on up and come and play!']];
  const props = PropertiesService.getScriptProperties(), pk = 'wake|' + hid + '|' + p.id;
  let past = []; try { past = JSON.parse(props.getProperty(pk) || '[]'); } catch (e) {}
  const fresh = spare.filter(function (v) { return past.indexOf(v.join(' ')) < 0; });
  let verse = (fresh.length ? fresh : spare)[Math.floor(Math.random() * (fresh.length ? fresh : spare).length)];
  if (F) verse = verse.concat(['First up today: ' + F + '!']);
  let aiNote = '';
  const gk = aiReady(h);
  if (!gk) aiNote = 'No AI key is set up, so this is a built-in rhyme. Add one in More, AI.';
  if (gk) {
    try {
      const facts = ['The song is for: ' + p.name, 'Day: ' + dayName,
        mine.length ? p.name + "'s day today: " + mine.slice(0, 6).map(line).join('; ') : 'Nothing in ' + p.name + "'s calendar today",
        others.length ? 'Other entries today (ticked for someone else, but judge from the wording whether ' + p.name + ' is part of it): ' + others.slice(0, 5).map(line).join('; ') : '',
        tmrw.length ? 'Tomorrow: ' + tmrw.slice(0, 4).map(line).join('; ') : '',
        where ? 'Family news: ' + where : '', wx ? 'Weather: ' + wx : '', vWho(h)].filter(Boolean).join('\n');
      const angles = ['a sports commentator calling the big moment', 'the bed and pillow complaining they need a break', 'a silly animal (pick an unusual New Zealand one) delivering the news', 'a countdown to blast-off', 'breakfast foods calling out from the kitchen', 'a royal announcement for Your Majesty', 'a detective solving the mystery of who is still asleep', 'the weather itself doing the talking', 'a very excited tour guide to the day ahead', 'socks and shoes arguing about who goes first', 'a secret mission briefing', 'a rhyme built around one ridiculous made-up word'];
      const angle = angles[Math.floor(Math.random() * angles.length)];
      const prompt = 'Write a brand new wake-up rhyme for someone in a New Zealand family, to be spoken aloud by a smart speaker. Style: ' + WAKE_STYLES[style] + '. '
        + 'Today\'s angle, to keep it fresh: ' + angle + '. '
        + 'Four to six short lines that rhyme in pairs, bouncy rhythm, under 60 words in total. Use their name. '
        + 'Work in the two or three most exciting real things about THEIR day from the facts below: a sleepover, a party, a trip or a visitor beats an ordinary lesson. Say each thing in your own playful words; never paste a calendar entry in as written. '
        + "Use the who's who to get people right: call relatives what this person would call them (their mum is Mum or Mummy, their grandmother by the family's name for her), and never explain the relationship. "
        + 'Only use facts that are given; do not invent plans. Kind and funny, never mean, nothing scary, no brand names, and do not copy any existing song. '
        + 'Be surprising: do not open with "wakey wakey" or "rise and shine", and avoid the rhymes eyes/rise and day/play/way. '
        + (past.length ? 'These were used on recent mornings. Do not reuse their opening, their rhymes or their jokes:\n' + past.map(function (x) { return '- ' + x; }).join('\n') + '\n' : '')
        + 'Plain words only: no emoji, no markdown, no stage directions.\n\n' + facts + '\n\nReturn JSON only: {"lines":["...","...","...","..."]}';
      const raw = String(aiCall(h, [{ text: prompt }], !b.slow)), cut = raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1);   // written ahead (slow) = your chosen AI; on the spot = the fast one
      const j = JSON.parse(cut);
      const ls = (j.lines || []).map(function (x) { return String(x || '').trim(); }).filter(Boolean).slice(0, 6);
      if (ls.length >= 2) verse = ls; else aiNote = 'The AI sent back an empty song, so this is a built-in rhyme.';
    } catch (e) { aiNote = 'The AI did not answer (' + String(e.message || e).slice(0, 140) + '), so this is a built-in rhyme.'; console.log('wake: ' + e.message); }
  }
  try { props.setProperty(pk, JSON.stringify([verse.join(' ')].concat(past).slice(0, 5))); } catch (e) {}
  verse = verse.map(xmlSafe);
  const fx = h.wakeSfx === false ? '' : '<audio src="soundbank://soundlibrary/animals/amzn_sfx_rooster_crow_01"/> ';
  const ssml = fx + '<prosody rate="95%" pitch="+12%">' + verse.join(' <break time="350ms"/> ') + '</prosody> <break time="700ms"/> ' + xmlSafe(then);
  const out = { speech: verse.join(' ') + ' ' + then, ssml: ssml, verse: verse, then: then, name: p.name, style: style };
  if (aiNote) out.aiNote = aiNote;
  return out;
}
// everything the family's helper knows, as plain lines for the AI to read
function voiceContext(h, now) {
  const hid = h._id, out = [], today = keyOf(now);
  const nameOf = function (id) { const p = vPeople(h).filter(function (x) { return x.id === id; })[0]; return p ? p.name : ''; };
  const pre = vPrep(h, today, keyOf(addDays(now, 8)), [
    { kind: 'list', path: 'households/' + hid + '/todos' }, { kind: 'list', path: 'households/' + hid + '/groceries' }, { kind: 'list', path: 'households/' + hid + '/meals' },
    { kind: 'query', parent: 'households/' + hid, col: 'bills', where: fOp('status', 'IN', ['due', 'check']) }, { kind: 'list', path: 'households/' + hid + '/renewals' }, { kind: 'list', path: 'households/' + hid + '/memory' },
    { kind: 'query', parent: 'households/' + hid, col: 'flights', where: fOp('end', 'GREATER_THAN_OR_EQUAL', new Date(now.getTime() - 3 * 864e5).toISOString()) }]);
  h._fl = pre[6];
  out.push(vWho(h));
  try { out.push('WHERE: ' + voiceDo(h, 'where', {}).speech); } catch (e) {}
  const lines = [];
  for (let i = 0; i < 8; i++) { const k = keyOf(addDays(now, i)), evs = vEventsOn(h, k); if (evs.length) lines.push(vDay(k, now) + ' (' + k + '): ' + evs.map(function (e) { return vSay(e, h); }).join('; ')); }
  if (lines.length) out.push('CALENDAR:\n' + lines.join('\n'));
  const t = pre[0].filter(function (x) { return !x.done && !x.priv; });
  if (t.length) out.push('JOBS: ' + t.slice(0, 25).map(function (x) { return x.title + (x.who ? ' (' + nameOf(x.who) + ')' : ''); }).join('; '));
  const g = pre[1].filter(function (x) { return !x.done; });
  if (g.length) out.push('SHOPPING LIST: ' + g.slice(0, 50).map(function (x) { return x.name; }).join(', '));
  const meals = pre[2].filter(function (m) { return m.date >= today && m.date <= keyOf(addDays(now, 8)); });
  if (meals.length) out.push('MEAL PLAN: ' + meals.map(function (m) { const r = m.rid ? getDoc('households/' + hid + '/recipes/' + m.rid) : null; return vDay(m.date, now) + ' ' + m.slot + ': ' + (m.note || (r ? r.name : '')); }).join('; '));
  const bills = pre[3].filter(function (x) { return x.status === 'due' || x.status === 'check'; });
  if (bills.length) out.push('BILLS: ' + bills.map(function (x) { return (x.biller || 'Bill') + ' ' + money(x.amount) + (x.due ? ' due ' + x.due : '') + (x.status === 'check' ? ' (to check)' : '') + (x.directDebit ? ' (direct debit)' : ''); }).join('; '));
  const rn = pre[4].filter(function (x) { return x.due; });
  if (rn.length) out.push('RENEWALS: ' + rn.map(function (x) { return x.what + (x.item ? ' ' + x.item : '') + ' due ' + x.due; }).join('; '));
  const mem = pre[5];
  if (mem.length) out.push('FAMILY NOTES:\n' + mem.slice(0, 30).map(function (x) { return '- ' + (x.title ? x.title + ': ' : '') + String(x.text).replace(/\s+/g, ' ').slice(0, 300); }).join('\n'));
  return out.join('\n\n');
}
function billsCheckNow() {
  const props = PropertiesService.getScriptProperties(), now = new Date();
  for (const h of listDocs('households')) { const out = billsTick(h, props, now, true); Logger.log((h.billEmail || '(no bills address set)') + ': ' + out.length + ' bills. ' + ((getDoc('households/' + h._id).billsHelper || {}).error || 'OK')); }
}

if (typeof module !== 'undefined') module.exports = { planNotifications, occursOn, checkEvery, parseFlight, flightAlerts, trackFlights, tick, nearEvents, jobTodos, mailDue };
