// Family Screen — live sync between the fridge and the family's phones (Firebase Auth + Firestore).
// The UI keeps one in-memory state object S. This module fills S from the household's
// documents, keeps them up to date in real time, and writes back whatever the UI changes.
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult,
  signOut as fbSignOut, connectAuthEmulator, signInWithCredential, browserLocalPersistence, setPersistence } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, connectFirestoreEmulator, doc, collection,
  onSnapshot, query, where, getDocs, addDoc, writeBatch, serverTimestamp, updateDoc, arrayUnion, arrayRemove, deleteField, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { getMessaging, getToken, isSupported } from 'firebase/messaging';

const COLS = ['events', 'flights', 'groceries', 'todos', 'sources'];

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
export const me = () => user && user.email && user.email.toLowerCase();

export async function findHousehold() {
  const q = query(collection(db, 'households'), where('members', 'array-contains', me()));
  const r = await getDocs(q);
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
  synced = { settings: null, cols: Object.fromEntries(COLS.map(c => [c, new Map()])) };
  unsub.push(onSnapshot(doc(db, 'households', hid), snap => {
    if (!snap.exists()) return;
    const d = snap.data(); members = d.members || []; owner = d.owner || null; devices = d.devices || {}; notifier = d.notifier || null;
    const hidden = localHidden();
    if (Array.isArray(d.people)) { mergeArray(S.people, d.people); S.people.forEach(p => p.show = !hidden.includes(p.id)); }
    if (Array.isArray(d.shops)) mergeArray(S.shops, d.shops);
    S.itemShop = d.itemShop || {}; S.override = d.override || null; S.linkHelper = d.linkHelper || null; S.vapidKey = d.vapidKey || ''; S.hideHotels = !!d.hideHotels;
    synced.settings = JSON.stringify(settingsOf(S));
    onChange('settings');
  }, err => onChange('error', err)));
  for (const c of COLS) {
    unsub.push(onSnapshot(collection(db, 'households', hid, c), snap => {
      const list = snap.docs.map(x => Object.assign({ id: x.id }, x.data()));
      mergeArray(S[c], list);
      const m = synced.cols[c]; m.clear(); S[c].forEach(x => m.set(x.id, JSON.stringify(clean(x))));
      onChange(c);
    }, err => onChange('error', err)));
  }
}
export function stop() { unsub.forEach(u => { try { u(); } catch (e) {} }); unsub = []; hid = null; }
const settingsOf = s => clean({ people: stripPeople(s.people), shops: s.shops, itemShop: s.itemShop || {}, override: s.override || null, linkHelper: s.linkHelper || null, vapidKey: s.vapidKey || '', hideHotels: !!s.hideHotels });
function localHidden() { try { return JSON.parse(localStorage.getItem('fs.hidden') || '[]'); } catch (e) { return []; } }

// Write whatever changed since the last sync. Called after every edit; cheap when nothing changed.
export function push() {
  if (!hid || !S) return;
  const ops = [];
  const st = JSON.stringify(settingsOf(S));
  if (st !== synced.settings) { ops.push(['update', doc(db, 'households', hid), JSON.parse(st)]); synced.settings = st; }
  for (const c of COLS) {
    const m = synced.cols[c], seen = new Set();
    for (const x of S[c]) {
      if (!x.id) continue; seen.add(x.id);
      const body = clean(x); delete body.id;
      const j = JSON.stringify(clean(x));
      if (m.get(x.id) !== j) { ops.push(['set', doc(db, 'households', hid, c, x.id), body]); m.set(x.id, j); }
    }
    for (const id of [...m.keys()]) if (!seen.has(id)) { ops.push(['delete', doc(db, 'households', hid, c, id)]); m.delete(id); }
  }
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
  return out;
}
export async function deleteHousehold() {
  const id = hid;
  for (const c of COLS) { const r = await getDocs(collection(db, 'households', id, c)); for (let i = 0; i < r.docs.length; i += 400) { const b = writeBatch(db); r.docs.slice(i, i + 400).forEach(d => b.delete(d.ref || doc(db, 'households', id, c, d.id))); await b.commit(); } }
  stop(); await deleteDoc(doc(db, 'households', id));
}
