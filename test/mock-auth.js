let listeners=[];
// email accounts live in localStorage (shared by every page of the test), the signed-in user in sessionStorage (one per page)
const accts=()=>{ try{ return JSON.parse(localStorage.getItem('mockaccts')||'{}'); }catch(e){ return {}; } };
const saveAccts=a=>localStorage.setItem('mockaccts',JSON.stringify(a));
const mkUser=d=>d?Object.assign({},d,{ getIdToken:async()=>'mock-token' }):null;
const cur=()=>{ try{ return mkUser(JSON.parse(sessionStorage.getItem('mockuser'))); }catch(e){ return null; } };
const emit=()=>{ const u=cur(); listeners.forEach(cb=>setTimeout(()=>cb(u),0)); };
const fail=c=>{ const e=new Error(c); e.code=c; return e; };
const setUser=d=>{ sessionStorage.setItem('mockuser',JSON.stringify(d)); emit(); };
export const getAuth=()=>({ get currentUser(){ return cur(); }, useDeviceLanguage(){} });
export const browserLocalPersistence={}; export const setPersistence=()=>Promise.resolve();
export const connectAuthEmulator=()=>{}; export const getRedirectResult=()=>Promise.resolve(null);
export function onAuthStateChanged(a,cb){ listeners.push(cb); setTimeout(()=>cb(cur()),0); return ()=>{ listeners=listeners.filter(x=>x!==cb); }; }
export class GoogleAuthProvider{ setCustomParameters(){} static credential(j){ return JSON.parse(j); } }
export async function signInWithCredential(a,c){ setUser({email:c.email,uid:c.sub,emailVerified:true,providerData:[{providerId:'google.com'}]}); }
export async function signInWithPopup(){ throw fail('auth/popup-closed-by-user'); }
export async function signInWithRedirect(){}
export async function signOut(){ sessionStorage.removeItem('mockuser'); emit(); }
export async function reauthenticateWithPopup(){ return {}; }
/* email and password */
export async function signInWithEmailAndPassword(a,email,pw){ const k=String(email).toLowerCase(), x=accts()[k];
  if(!x||x.pw!==pw) throw fail('auth/invalid-credential');
  setUser({email:k,uid:'pw-'+k,emailVerified:!!x.verified,providerData:[{providerId:'password'}]}); return {user:cur()}; }
export async function createUserWithEmailAndPassword(a,email,pw){ const k=String(email).toLowerCase(), all=accts();
  if(!/^\S+@\S+\.\S+$/.test(k)) throw fail('auth/invalid-email'); if(all[k]) throw fail('auth/email-already-in-use'); if(String(pw).length<6) throw fail('auth/weak-password');
  all[k]={pw,verified:false}; saveAccts(all); setUser({email:k,uid:'pw-'+k,emailVerified:false,providerData:[{providerId:'password'}]}); return {user:cur()}; }
const mail=(kind,to)=>{ const m=JSON.parse(localStorage.getItem('mockmail')||'[]'); m.push({kind,to}); localStorage.setItem('mockmail',JSON.stringify(m)); };
export async function sendEmailVerification(u){ mail('verify',u.email); }
export async function sendPasswordResetEmail(a,email){ mail('reset',String(email).toLowerCase()); }
export async function reload(u){ const x=accts()[u.email]; u.emailVerified=!!(x&&x.verified); if(u.emailVerified){ const d=JSON.parse(sessionStorage.getItem('mockuser')); d.emailVerified=true; sessionStorage.setItem('mockuser',JSON.stringify(d)); } }
export class EmailAuthProvider{ static credential(email,pw){ return {email,pw}; } }
export async function reauthenticateWithCredential(u,c){ const x=accts()[String(c.email).toLowerCase()]; if(!x||x.pw!==c.pw) throw fail('auth/invalid-credential'); return {}; }
