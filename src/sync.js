// Family Screen — live sync between the fridge and the family's phones (Firebase Auth + Firestore).
// The UI keeps one in-memory state object S. This module fills S from the household's
// documents, keeps them up to date in real time, and writes back whatever the UI changes.
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, reauthenticateWithPopup,
  signOut as fbSignOut, connectAuthEmulator, signInWithCredential, browserLocalPersistence, setPersistence,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail, reload,
  EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, connectFirestoreEmulator, doc, collection,
  onSnapshot, query, where, getDocs, addDoc, writeBatch, serverTimestamp, updateDoc, arrayUnion, arrayRemove, deleteField, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { getMessaging, getToken, isSupported } from 'firebase/messaging';

const COLS = ['events', 'flights', 'groceries', 'todos', 'sources', 'recipes', 'meals', 'renewals', 'bills', 'memory', 'kids', 'inbox', 'msgs'];
// gift ideas: only the people picked in Settings can read them, so a 'no' here is normal, not an error
const SOFT = ['gifts'];
// newer lists: if the database rules haven't been updated yet, they just don't sync (and we say so) rather than locking the app
const NEWER = ['recipes', 'meals', 'renewals', 'bills', 'memory', 'kids', 'inbox', 'msgs'];
let rulesOld = false; const denied = new Set();   // a list the database rules don't allow yet is skipped on its own, so the others keep syncing
export const needsRules = () => rulesOld;

let app, auth, db, hid = null, unsub = [], S = null, onChange = () => {}, synced = null, user = null, members = [], owner = null, devices = {}, notifier = null;

const clean = o => JSON.parse(JSON.stringify(o));                 // drops undefined + functions
const stripPeople = ps => ps.map(p => { const c = Object.assign({}, p); delete c.show; return c; });

// keep object identity stable so open screens keep editing the live object
function mergeArray(target, incoming) {
  const byId = new Map(target.map(x => [x.id, x]));
  const out = incoming.map(n => {
    const ex = byId.get(n.id);
    if (!ex) return n;
    for (const k of Object.keys(ex)) if (!(k in n) && k !== 'show') delete ex[k];
    return Object.assign(ex, n);
  });
  target.length = 0; out.forEach(x => target.push(x));
}

export function init(config, opts = {}) {
  app = initializeApp(config);
  auth = getAuth(app);
  db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }), ignoreUndefinedProperties: true });
  if (opts.emulator) { connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true }); connectFirestoreEmulator(db, '127.0.0.1', 8080); }
  setPersistence(auth, browserLocalPersistence).catch(() => {});
  getRedirectResult(auth).catch(() => {});
}
export function watchAuth(cb) { return onAuthStateChanged(auth, u => { user = u; cb(u); }); }
export async function signIn() {
  const p = new GoogleAuthProvider(); p.setCustomParameters({ prompt: 'select_account' });
  try { await signInWithPopup(auth, p); }
  catch (e) { if (e && /popup-blocked|operation-not-supported/.test(e.code || '')) return signInWithRedirect(auth, p); throw e; }
}
export async function testSignIn(email) { // emulator only
  const cred = GoogleAuthProvider.credential(JSON.stringify({ sub: email, email, email_verified: true }));
  await signInWithCredential(auth, cred);
}
export function signOut() { stop(); return fbSignOut(auth); }

/* ---------- sign in with any email address (Outlook, iCloud...) and a password ----------
   For family members without a Google account. The address must be confirmed by a link in an email before the
   family's data opens (the database rules ask for a confirmed address). Emails go out in the phone's own language. */
export const usesPassword = () => !!(user && (user.providerData || []).some(p => p.providerId === 'password'));
export const needsVerify = () => usesPassword() && !user.emailVerified;
export async function signInEmail(email, password) { await signInWithEmailAndPassword(auth, String(email || '').trim(), password || ''); }
export async function createEmailAccount(email, password) {
  auth.useDeviceLanguage();
  const c = await createUserWithEmailAndPassword(auth, String(email || '').trim(), password || '');
  try { await sendEmailVerification(c.user); } catch (e) {}
}
export async function resendVerification() { auth.useDeviceLanguage(); await sendEmailVerification(auth.currentUser); }
export async function resetPassword(email) { auth.useDeviceLanguage(); await sendPasswordResetEmail(auth, String(email || '').trim()); }
// after the link in the email is tapped (often in another app), check again and fetch a fresh pass that says so
export async function refreshVerified() {
  const u = auth.currentUser; if (!u) return false;
  await reload(u); if (!u.emailVerified) return false;
  await u.getIdToken(true); user = u; return true;
}
export const me = () => user && user.email && user.email.toLowerCase();

/* Reads this screen causes, so the helper can warn before the free 50,000 a day run out (Cloud Monitoring would need
   billing switched on). The allowance runs by Pacific time. Saved now and then to usage/reads-<day>, one line per screen. */
const pday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(new Date());
let rc = { day: '', n: 0, sent: 0 };
try { rc = Object.assign(rc, JSON.parse(localStorage.getItem('fs.reads') || '{}')); } catch (e) {}
function tally(n) {
  const d = pday(); if (rc.day !== d) rc = { day: d, n: 0, sent: 0 };
  rc.n += Math.max(1, n || 0); try { localStorage.setItem('fs.reads', JSON.stringify(rc)); } catch (e) {}
}
// a listener's first answer from the server is billed in full; after that, only the entries that changed
function listen(ref, next, fail) {
  let first = true;
  return onSnapshot(ref, snap => {
    if (!(snap.metadata && snap.metadata.fromCache)) { tally(!snap.docs ? 1 : first || typeof snap.docChanges !== 'function' ? snap.docs.length : snap.docChanges().length); first = false; }
    next(snap);
  }, fail);
}
export const readsToday = () => (rc.day === pday() ? rc.n : 0);
export async function sendReads() {
  if (!hid || !me() || !rc.day || rc.n === rc.sent) return false;
  let id = ''; try { id = localStorage.getItem('fs.rdev') || ''; if (!id) { id = Math.random().toString(36).slice(2, 10); localStorage.setItem('fs.rdev', id); } } catch (e) { id = 'screen'; }
  try { await setDoc(doc(db, 'households', hid, 'usage', 'reads-' + rc.day), { [id]: { n: rc.n, by: me(), dev: deviceKind, at: Date.now() } }, { merge: true });
    rc.sent = rc.n; localStorage.setItem('fs.reads', JSON.stringify(rc)); return true; } catch (e) { return false; }
}

export async function findHousehold() {
  const q = query(collection(db, 'households'), where('members', 'array-contains', me()));
  const r = await getDocs(q); if (!(r.metadata && r.metadata.fromCache)) tally(r.docs.length);
  return r.empty ? null : r.docs[0].id;
}
export async function createHousehold(starter) {
  const d = await addDoc(collection(db, 'households'), Object.assign(clean({
    people: stripPeople(starter.people), shops: starter.shops, itemShop: {}, override: null
  }), { members: [me()], owner: me(), created: serverTimestamp() }));
  return d.id;
}
export const getMembers = () => members.slice();
export const getOwner = () => owner;
export const addMember = email => updateDoc(doc(db, 'households', hid), { members: arrayUnion(email.trim().toLowerCase()) });
export const removeMember = email => updateDoc(doc(db, 'households', hid), { members: arrayRemove(email) });

export function start(householdId, state, changed) {
  stop(); hid = householdId; S = state; onChange = changed;
  denied.clear(); rulesOld = false;
  synced = { settings: null, cols: Object.fromEntries(COLS.concat(SOFT).map(c => [c, new Map()])), priv: { events: new Map(), todos: new Map() } };
  privOk = true;
  unsub.push(listen(doc(db, 'households', hid), snap => {
    if (!snap.exists()) return;
    const d = snap.data(); members = d.members || []; owner = d.owner || null; devices = d.devices || {}; notifier = d.notifier || null;
    const hidden = localHidden();
    if (Array.isArray(d.people)) { mergeArray(S.people, d.people); S.people.forEach(p => p.show = !hidden.includes(p.id)); }
    if (Array.isArray(d.shops)) mergeArray(S.shops, d.shops);
    S.itemShop = d.itemShop || {}; S.override = d.override || null; S.linkHelper = d.linkHelper || null; S.vapidKey = d.vapidKey || ''; S.hideHotels = !!d.hideHotels; S.pinHash = d.pinHash || ''; S.live = d.live || {}; S.taxi = d.taxi || null; S.cards = d.cards || []; S.visited = d.visited || {}; S.wish = d.wish || []; S.tvOff = d.tvOff || []; S.favs = d.favs || []; S.recHide = d.recHide || []; S.mealAway = d.mealAway || {}; S.giftViewers = d.giftViewers || []; S.aiKeyTail = d.aiKeyTail || ''; S.aiKeyAt = d.aiKeyAt || 0; S.voiceKey = d.voiceKey || ''; S.voiceUrl = d.voiceUrl || ''; S.voiceName = d.voiceName || ''; S.famNote = d.famNote || ''; S.aiProv = d.aiProv || ''; S.aiClaudeModel = d.aiClaudeModel || ''; S.aiEffort = d.aiEffort || ''; S.claudeKeyTail = d.claudeKeyTail || ''; S.wakeStyle = d.wakeStyle || ''; S.wakeSfx = d.wakeSfx !== false; S.billEmail = d.billEmail || ''; S.inboxEmail = d.inboxEmail || ''; S.inboxHelper = d.inboxHelper || null; S.billsRoot = d.billsRoot || ''; S.billFolders = d.billFolders || []; S.billsRootName = d.billsRootName || ''; S.billsHelper = d.billsHelper || null; S.billSheet = d.billSheet || ''; S.alexaFrom = d.alexaFrom || ''; S.evAt = d.evAt || 0; if (S.giftViewers.includes(me()) && !softOk.gifts && hid) setTimeout(() => { if (!softOk.gifts) listenSoft('gifts'); }, 800);
    synced.settings = JSON.stringify(settingsOf(S));
    onChange('settings');
  }, err => onChange('error', err)));
  SOFT.forEach(listenSoft); if (me()) watchKey();
  for (const c of COLS) {
    S[c] = S[c] || [];
    unsub.push(listen(collection(db, 'households', hid, c), snap => {
      let list = snap.docs.map(x => Object.assign({ id: x.id }, x.data()));
      if (PRIV.includes(c)) list = list.filter(e => !e.priv).concat(S[c].filter(e => e.priv));   // keep my private ones
      mergeArray(S[c], list);
      const m = synced.cols[c]; m.clear(); S[c].forEach(x => { if (!(PRIV.includes(c) && x.priv)) m.set(x.id, JSON.stringify(clean(x))); });
      onChange(c);
    }, err => { if (NEWER.includes(c) && err && err.code === 'permission-denied') { denied.add(c); console.warn(c + ': database rules need updating'); onChange('rulesold', c); } else onChange('error', err); }));
  }
  // my private entries: households/{id}/private/{my email}/{events|todos} — the rules let only me read or write them
  if (me()) for (const c of PRIV) unsub.push(listen(collection(db, 'households', hid, 'private', me(), c), snap => {
    const mine = snap.docs.map(x => Object.assign({ id: x.id }, x.data(), { priv: true }));
    mergeArray(S[c], S[c].filter(e => !e.priv).concat(mine));
    synced.priv[c].clear(); mine.forEach(x => synced.priv[c].set(x.id, JSON.stringify(clean(x))));
    privOk = true; onChange(c);
  }, err => { privOk = false; console.warn('private entries unavailable', err && err.code); onChange('privoff'); }));
}
const PRIV = ['events', 'todos'];
let privOk = true; const softOk = {}, softUnsub = {};
function listenSoft(c) {
  if (softUnsub[c]) { try { softUnsub[c](); } catch (e) {} }
  S[c] = S[c] || []; softOk[c] = false;
  softUnsub[c] = listen(collection(db, 'households', hid, c), snap => {
    softOk[c] = true; mergeArray(S[c], snap.docs.map(x => Object.assign({ id: x.id }, x.data())));
    const m = synced.cols[c]; m.clear(); S[c].forEach(x => m.set(x.id, JSON.stringify(clean(x)))); onChange(c);
  }, () => { softOk[c] = false; mergeArray(S[c], []); synced.cols[c].clear(); onChange(c); });
  unsub.push(softUnsub[c]);
}
// call after changing who can see gift ideas (the database only re-checks when we ask again)
export function retrySoft() { if (hid) SOFT.forEach(listenSoft); }
export const canSee = c => !!softOk[c];
export const privateOk = () => privOk;
export function stop() { unsub.forEach(u => { try { u(); } catch (e) {} }); unsub = []; hid = null; }
const settingsOf = s => clean({ people: stripPeople(s.people), shops: s.shops, itemShop: s.itemShop || {}, override: s.override || null, linkHelper: s.linkHelper || null, vapidKey: s.vapidKey || '', hideHotels: !!s.hideHotels, pinHash: s.pinHash || '', taxi: s.taxi || null, cards: s.cards || [], visited: s.visited || {}, wish: s.wish || [], tvOff: s.tvOff || [], favs: s.favs || [], recHide: s.recHide || [], mealAway: s.mealAway || {}, giftViewers: s.giftViewers || [], aiKeyTail: s.aiKeyTail || '', aiKeyAt: s.aiKeyAt || 0, voiceKey: s.voiceKey || '', voiceUrl: s.voiceUrl || '', voiceName: s.voiceName || '', famNote: s.famNote || '', aiProv: s.aiProv || '', aiClaudeModel: s.aiClaudeModel || '', aiEffort: s.aiEffort || '', claudeKeyTail: s.claudeKeyTail || '', wakeStyle: s.wakeStyle || '', wakeSfx: s.wakeSfx !== false, billEmail: s.billEmail || '', inboxEmail: s.inboxEmail || '', billsRoot: s.billsRoot || '', alexaFrom: s.alexaFrom || '' });
function localHidden() { try { return JSON.parse(localStorage.getItem('fs.hidden') || '[]'); } catch (e) { return []; } }

/* ---------- who did what (v1.5) ----------
   Each new calendar entry, job or shopping item is stamped with the account that added it and the kind of screen
   (phone or fridge); a job or item ticked off gets who and when. Set once, never overwritten. */
let deviceKind = 'phone';
export const setDevice = k => { deviceKind = k === 'fridge' ? 'fridge' : 'phone'; };
const STAMPED = ['events', 'todos', 'groceries'];
function stamp(c, x, before) {
  if (!STAMPED.includes(c) || !me()) return false;
  let ch = false;
  if (before === undefined && !x.by) { x.by = me(); x.dev = deviceKind; if (!x.at) x.at = Date.now(); ch = true; }
  if (x.done && !x.doneBy) { let was = false; try { was = before !== undefined && !!JSON.parse(before).done; } catch (e) {}
    if (!was) { x.doneBy = me(); x.doneAt = Date.now(); ch = true; } }
  if (!x.done && x.doneBy) { delete x.doneBy; delete x.doneAt; ch = true; }
  return ch;
}
// once a day each screen notes that it was opened, so the family can see whether Family Screen is really in use
export async function markOpen(day) {
  if (!hid || !me()) return false;
  try { await setDoc(doc(db, 'households', hid, 'usage', day), { [me()]: { [deviceKind]: Date.now() } }, { merge: true }); return true; } catch (e) { return false; }
}
export async function refreshToken() { try { if (auth.currentUser) await auth.currentUser.getIdToken(true); } catch (e) {} }

// Write whatever changed since the last sync. Called after every edit; cheap when nothing changed.
export function push() {
  if (!hid || !S) return;
  const ops = [];
  const st = JSON.stringify(settingsOf(S));
  if (st !== synced.settings) { ops.push(['update', doc(db, 'households', hid), JSON.parse(st)]); synced.settings = st; }
  // my private entries go to their own place (a separate batch, so a problem there never blocks the rest)
  const pops = [];
  if (me()) for (const c of PRIV) {
    const pm = synced.priv[c], pseen = new Set();
    for (const x of S[c]) {
      if (!x.id || !x.priv) continue; pseen.add(x.id);
      stamp(c, x, pm.get(x.id));
      const body = clean(x); delete body.id; const j = JSON.stringify(clean(x));
      if (pm.get(x.id) !== j) { pops.push(['set', doc(db, 'households', hid, 'private', me(), c, x.id), body]); pm.set(x.id, j); }
    }
    for (const id of [...pm.keys()]) if (!pseen.has(id)) { pops.push(['delete', doc(db, 'households', hid, 'private', me(), c, id)]); pm.delete(id); }
  }
  if (pops.length) { const b = writeBatch(db); pops.forEach(([k, ref, data]) => k === 'set' ? b.set(ref, data) : b.delete(ref)); b.commit().catch(e => { privOk = false; onChange('privoff', e); }); }
  const nops = [];
  for (const c of COLS.concat(SOFT.filter(c => softOk[c]))) {
    if (NEWER.includes(c) && (rulesOld || denied.has(c))) continue;
    const ops0 = ops, ops1 = NEWER.includes(c) || SOFT.includes(c) ? nops : ops0;
    const m = synced.cols[c], seen = new Set();
    for (const x of (S[c] || [])) {
      if (!x.id) continue; if (PRIV.includes(c) && x.priv) continue; seen.add(x.id);
      if (m.get(x.id) !== JSON.stringify(clean(x))) stamp(c, x, m.get(x.id));
      const body = clean(x); delete body.id;
      const j = JSON.stringify(clean(x));
      if (m.get(x.id) !== j) { ops1.push(['set', doc(db, 'households', hid, c, x.id), body]); m.set(x.id, j); }
    }
    for (const id of [...m.keys()]) if (!seen.has(id)) { ops1.push(['delete', doc(db, 'households', hid, c, id)]); m.delete(id); }
  }
  if (nops.length) { const b = writeBatch(db); nops.slice(0, 450).forEach(([k, ref, data]) => k === 'set' ? b.set(ref, data) : b.delete(ref)); b.commit().catch(e => { if (e && e.code === 'permission-denied') { rulesOld = true; onChange('rulesold'); } else console.warn(e); }); }
  // 2.5 tells the helper its prepared "what's on" answers are out of date
  if (ops.some(o => o[1] && o[1].path && o[1].path.indexOf('/events/') > 0 && o[1].path.indexOf('/private/') < 0)) ops.push(['update', doc(db, 'households', hid), { evAt: Date.now() }]);
  for (let i = 0; i < ops.length; i += 400) {
    const b = writeBatch(db);
    ops.slice(i, i + 400).forEach(([k, ref, data]) => k === 'set' ? b.set(ref, data) : k === 'update' ? b.update(ref, data) : b.delete(ref));
    b.commit().catch(e => onChange('error', e));
  }
}

/* ---------- phone notifications ---------- */
export async function pushSupported() { try { return await isSupported(); } catch (e) { return false; } }
export async function pushToken(vapidKey, reg) { return getToken(getMessaging(app), { vapidKey, serviceWorkerRegistration: reg }); }
export const getDevices = () => devices;
export const getNotifier = () => notifier;
// the Gemini key: saved here for the family's devices and the helper (only signed-in family members can read it)
export const saveSecret = data => setDoc(doc(db, 'households', hid, 'secrets', 'ai'), clean(data), { merge: true }).then(() => { if (data.gemini !== undefined) S.aiKey = data.gemini || ''; if (data.claude !== undefined) S.claudeKey = data.claude || ''; });
// the family's own Gemini key: kept in the database where only signed-in family members can read it, so the app can
// talk to Gemini directly (fast, word by word) instead of going through the Google helper
let keyUnsub = null;
function watchKey() {
  if (keyUnsub) { try { keyUnsub(); } catch (e) {} }
  keyUnsub = listen(doc(db, 'households', hid, 'secrets', 'ai'), d => { S.aiKey = (d.exists() && d.data().gemini) || ''; S.claudeKey = (d.exists() && d.data().claude) || ''; onChange('aikey'); }, () => { S.aiKey = ''; S.claudeKey = ''; });
  unsub.push(keyUnsub);
}
export const saveDevice = (hash, data) => updateDoc(doc(db, 'households', hid), { ['devices.' + hash]: clean(data) });
export const removeDevice = hash => updateDoc(doc(db, 'households', hid), { ['devices.' + hash]: deleteField() });
export const requestTest = hash => updateDoc(doc(db, 'households', hid), { testPing: { hash, at: Date.now() } });

/* ---------- invite-only: who may start a new family ---------- */
export async function isInvited(admin) {
  if (me() && admin && me() === admin.toLowerCase()) return true;
  try { const d = await getDoc(doc(db, 'invites', me())); return d.exists(); } catch (e) { return false; }
}
export async function listInvites() { const r = await getDocs(collection(db, 'invites')); return r.docs.map(d => Object.assign({ email: d.id }, d.data())); }
export const addInvite = email => setDoc(doc(db, 'invites', email.trim().toLowerCase()), { by: me(), at: Date.now() });
export const removeInvite = email => deleteDoc(doc(db, 'invites', email));
export async function useInvite() { try { await deleteDoc(doc(db, 'invites', me())); } catch (e) {} }

/* ---------- a family's own data: download and delete ---------- */
export async function exportHousehold() {
  const out = { exported: new Date().toISOString() };
  const h = await getDoc(doc(db, 'households', hid)); const hd = Object.assign({}, h.data()); delete hd.devices; delete hd.linkHelper; out.family = hd;
  for (const c of COLS) { const r = await getDocs(collection(db, 'households', hid, c)); out[c] = r.docs.map(d => Object.assign({ id: d.id }, d.data())); }
  for (const c of ['events', 'todos']) try { const r = await getDocs(collection(db, 'households', hid, 'private', me(), c)); out['myPrivate_' + c] = r.docs.map(d => Object.assign({ id: d.id }, d.data())); } catch (e) {}
  return out;
}
export async function deleteHousehold() {
  const id = hid;
  for (const c of COLS) { const r = await getDocs(collection(db, 'households', id, c)); for (let i = 0; i < r.docs.length; i += 400) { const b = writeBatch(db); r.docs.slice(i, i + 400).forEach(d => b.delete(d.ref || doc(db, 'households', id, c, d.id))); await b.commit(); } }
  for (const c of ['events', 'todos']) try { const r = await getDocs(collection(db, 'households', id, 'private', me(), c)); const b = writeBatch(db); r.docs.forEach(d => b.delete(d.ref)); await b.commit(); } catch (e) {}
  stop(); await deleteDoc(doc(db, 'households', id));
}

/* confirm it's really a family member (for resetting a forgotten PIN) */
export async function reauth(password) {
  if (usesPassword()) { await reauthenticateWithCredential(auth.currentUser, EmailAuthProvider.credential(auth.currentUser.email, password || '')); return true; }
  const p = new GoogleAuthProvider(); p.setCustomParameters({ login_hint: me() || '' }); await reauthenticateWithPopup(auth.currentUser, p); return true;
}
export const householdId = () => hid;
